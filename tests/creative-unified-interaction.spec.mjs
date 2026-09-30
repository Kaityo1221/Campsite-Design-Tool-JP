import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

const project = {
  source: 'bridge',
  projectId: 'phase5-d10-interactive-e2e',
  phase: 'design',
  createdAt: '2026-09-30T11:55:00.000Z',
  updatedAt: '2026-09-30T11:55:00.000Z',
  circleRadii: [50, 40, 30],
  polygon: [
    [35.6808, 139.7668],
    [35.6808, 139.7692],
    [35.6832, 139.7692],
    [35.6832, 139.7668]
  ],
  selectedPois: [
    { id:'e-stop', guid:'guid-stop', title:'Existing Stop', lat:35.68140, lng:139.76720, gameEntity:'POKESTOP', gameStatus:'ACTIVE', layer:'existing-pokestop', role:'existing' },
    { id:'e-gym', guid:'guid-gym', title:'Existing Gym', lat:35.68170, lng:139.76760, gameEntity:'GYM', gameStatus:'ACTIVE', layer:'existing-gym', role:'existing' },
    { id:'e-power', guid:'guid-power', title:'Existing Power', lat:35.68200, lng:139.76800, gameEntity:'POWERSPOT', gameStatus:'ACTIVE', layer:'existing-power', role:'existing' },
    { id:'e-inactive', guid:'guid-inactive', title:'Inactive Power', lat:35.68230, lng:139.76840, gameEntity:'POWERSPOT', gameStatus:'INACTIVE', layer:'existing-power', role:'existing' },
    { id:'c-stop', guid:'', title:'Candidate Stop', lat:35.68260, lng:139.76880, gameEntity:'POKESTOP', gameStatus:'UNKNOWN', layer:'new-pokestop', role:'added', description:'D10 interactive candidate' }
  ]
};
project.currentPois = project.selectedPois.map(item => ({ ...item }));

function collectBrowserErrors(page) {
  const browserErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  return browserErrors;
}

async function workspaceRecord(page, id) {
  return page.evaluate(recordId => {
    const snapshot = window.CampsiteCreativeWorkspace?.getSnapshot?.();
    const record = snapshot?.records?.find(item => item?.id === recordId);
    if (!record) return null;
    return {
      id: record.id,
      title: record.title || '',
      layer: record.layer || '',
      deleted: record.deleted === true,
      latlng: Array.isArray(record.latlng)
        ? record.latlng.map(value => Number(Number(value).toFixed(6)))
        : null
    };
  }, id);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status:200, contentType:'text/css', body:leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/, route => route.fulfill({ status:204, body:'' }));
});

test('Phase 5-D10 real Creative Mode delegates engine taps to legacy edit flows on iPhone/WebKit', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);

  await page.route('**/js/ca-access-bootstrap.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.CampsiteCaAccess=Object.freeze({test:true});'
  }));

  await page.addInitScript(value => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(value));
  }, project);

  await page.goto('/creative/index.html?campsiteProject=bridge&unifiedRenderer=interactive');

  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(5);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow?.getState?.()?.interactionOwner || ''), { timeout:15000 }).toBe('map-engine');
  await expect.poll(() => page.evaluate(() => typeof window.CampsiteCreativeWorkspace?.getSnapshot === 'function'), { timeout:15000 }).toBe(true);

  const state = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(state.ready).toBe(true);
  expect(state.unified).toBe(true);
  expect(state.unifiedVisible).toBe(true);
  expect(state.interactive).toBe(true);
  expect(state.interactionOwner).toBe('map-engine');
  expect(state.rendered).toEqual({ markers:5, circles50:5, circles40:5, circles30:5 });

  const engineExisting = page.locator('.cm-engine-existing-icon');
  const engineCandidate = page.locator('.cm-engine-candidate-icon');
  await expect(engineExisting).toHaveCount(4);
  await expect(engineCandidate).toHaveCount(1);
  await expect(page.locator('.cm-engine-legacy-existing')).toHaveCount(4);
  await expect(page.locator('.cm-engine-legacy-candidate')).toHaveCount(1);

  expect(await page.locator('.cm-engine-legacy-existing').first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await page.locator('.cm-engine-legacy-candidate').first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await engineExisting.first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');
  expect(await engineCandidate.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');

  const initialCandidate = await workspaceRecord(page, 'c-stop');
  expect(initialCandidate).toBeTruthy();
  expect(initialCandidate.layer).toBe('new-pokestop');
  expect(initialCandidate.deleted).toBe(false);
  const initialPosition = initialCandidate.latlng;

  // Existing POI tap must be handed back to the current read-only Creative sheet.
  await engineExisting.first().click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('.cm-sheet')).toContainText('既存POI（閲覧のみ）');
  await page.locator('.cm-sheet-close').click();
  await expect(page.locator('.cm-sheet')).toHaveCount(0);

  // Candidate tap must open the current editor, not a new Map Engine editor.
  await engineCandidate.click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmMove')).toBeVisible();
  await expect(page.locator('#cmType')).toBeVisible();
  await expect(page.locator('#cmDelete')).toBeVisible();

  await page.locator('#cmName').fill('Candidate Stop Edited');
  await expect.poll(async () => (await workspaceRecord(page, 'c-stop'))?.title || '').toBe('Candidate Stop Edited');

  // Start the current move flow: pan the map under the fixed crosshair, then confirm.
  await page.locator('#cmMove').click();
  await expect(page.locator('#cmMoveCrosshair')).toBeVisible();
  await expect(page.locator('#cmMoveBar')).toBeVisible();
  await expect(page.locator('#cmMoveConfirm')).toContainText('移動確定');

  const mapSurface = page.locator('.leaflet-container').first();
  const box = await mapSurface.boundingBox();
  expect(box).toBeTruthy();
  const startX = box.x + box.width * 0.50;
  const startY = box.y + box.height * 0.45;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 24, startY - 18, { steps:8 });
  await page.mouse.up();

  await page.locator('#cmMoveConfirm').click();
  await expect(page.locator('#cmMoveBar')).toHaveCount(0);
  await expect(page.locator('#cmMoveCrosshair')).toBeHidden();
  const movedCandidate = await workspaceRecord(page, 'c-stop');
  expect(movedCandidate.latlng).not.toEqual(initialPosition);
  const movedPosition = movedCandidate.latlng;
  await expect.poll(() => page.evaluate(() => {
    const m=window.__cmCandidateShadow?.getState?.()?.sync?.markers;
    return m ? [m.created,m.reused,m.removed] : null;
  })).toEqual([0,5,0]);

  // The current move flow returns directly to the map, so Undo/Redo are immediately available.
  await page.locator('#undo').click();
  await expect.poll(async () => (await workspaceRecord(page, 'c-stop'))?.latlng).toEqual(initialPosition);
  await expect.poll(() => page.evaluate(() => {
    const m=window.__cmCandidateShadow?.getState?.()?.sync?.markers;
    return m ? [m.created,m.reused,m.removed] : null;
  })).toEqual([0,5,0]);

  await page.locator('#redo').click();
  await expect.poll(async () => (await workspaceRecord(page, 'c-stop'))?.latlng).toEqual(movedPosition);
  await expect.poll(() => page.evaluate(() => {
    const m=window.__cmCandidateShadow?.getState?.()?.sync?.markers;
    return m ? [m.created,m.reused,m.removed] : null;
  })).toEqual([0,5,0]);

  // Re-open through the real rendered marker after the smaller move keeps it on screen.
  await engineCandidate.click();
  await expect(page.locator('#cmDelete')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#cmDelete').click();

  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow.getState().rendered.markers)).toBe(4);
  const deletedCandidate = await workspaceRecord(page, 'c-stop');
  expect(deletedCandidate?.deleted).toBe(true);
  await expect(engineCandidate).toHaveCount(0);
  await expect(engineExisting).toHaveCount(4);
  await expect.poll(() => page.evaluate(() => {
    const m=window.__cmCandidateShadow?.getState?.()?.sync?.markers;
    return m ? [m.created,m.reused,m.removed] : null;
  })).toEqual([0,4,1]);

  expect(browserErrors).toEqual([]);
});
