import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

const project = {
  source: 'bridge',
  projectId: 'phase5-d12-final-gate',
  phase: 'design',
  createdAt: '2026-09-30T12:25:00.000Z',
  updatedAt: '2026-09-30T12:25:00.000Z',
  circleRadii: [50, 40, 30],
  polygon: [
    [35.6810, 139.7670],
    [35.6810, 139.7690],
    [35.6830, 139.7690],
    [35.6830, 139.7670]
  ],
  selectedPois: [
    { id:'e-stop', guid:'guid-stop', title:'Existing Stop', lat:35.6816, lng:139.7676, gameEntity:'POKESTOP', gameStatus:'ACTIVE', layer:'existing-pokestop', role:'existing' },
    { id:'c-stop', guid:'', title:'Candidate Stop', lat:35.6822, lng:139.7682, gameEntity:'POKESTOP', gameStatus:'UNKNOWN', layer:'new-pokestop', role:'added' }
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

async function installRoutes(page) {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status:200, contentType:'text/css', body:leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status:200, contentType:'application/javascript', body:jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/, route => route.fulfill({ status:204, body:'' }));
  await page.route('**/js/ca-access-bootstrap.js*', route => route.fulfill({
    status: 200,
    contentType: 'application/javascript',
    body: 'window.CampsiteCaAccess=Object.freeze({test:true});'
  }));
  await page.addInitScript(value => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(value));
  }, project);
}

async function workspaceRecord(page, selector) {
  const query = typeof selector === 'string' ? { id:selector } : selector;
  return page.evaluate(criteria => {
    const snapshot = window.CampsiteCreativeWorkspace?.getSnapshot?.();
    const record = snapshot?.records?.find(item => {
      if (!item) return false;
      if (criteria?.id) return item.id === criteria.id;
      if (criteria?.layer) return item.layer === criteria.layer && item.deleted !== true;
      return false;
    });
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
  }, query);
}

test('Phase 5-D11 normal dev URL defaults to Unified interactive renderer', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await installRoutes(page);

  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow?.getState?.()?.interactionOwner || ''), { timeout:15000 }).toBe('map-engine');

  const state = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(state.ready).toBe(true);
  expect(state.unifiedVisible).toBe(true);
  expect(state.interactive).toBe(true);
  expect(state.interactionOwner).toBe('map-engine');
  expect(state.devDefaultUnified).toBe(true);
  expect(state.legacyOverride).toBe(false);
  expect(state.rendered.markers).toBe(2);

  const engineCandidate = page.locator('.cm-engine-candidate-icon');
  await expect(engineCandidate).toHaveCount(1);
  expect(await engineCandidate.evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');
  expect(await page.locator('.cm-engine-legacy-candidate').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');

  await engineCandidate.click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmDelete')).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('Phase 5-D11 rendererMode=legacy restores legacy visual and interaction ownership', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await installRoutes(page);

  await page.goto('/creative/index.html?campsiteProject=bridge&rendererMode=legacy');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow?.getState?.()?.interactionOwner || ''), { timeout:15000 }).toBe('legacy');
  await expect.poll(() => page.evaluate(() => !!window.__cmD11LegacyProbe?.getCandidateTarget?.()), { timeout:15000 }).toBe(true);

  const state = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(state.ready).toBe(true);
  expect(state.unifiedVisible).toBe(false);
  expect(state.interactive).toBe(false);
  expect(state.interactionOwner).toBe('legacy');
  expect(state.devDefaultUnified).toBe(false);
  expect(state.legacyOverride).toBe(true);
  expect(state.rendered.markers).toBe(2);

  const engineCandidate = page.locator('.cm-engine-candidate-icon');
  await expect(engineCandidate).toHaveCount(1);
  expect(Number(await engineCandidate.evaluate(el => getComputedStyle(el).opacity))).toBe(0);

  const legacyMarker = await page.evaluate(() => window.__cmD11LegacyProbe.getCandidateTarget());
  expect(legacyMarker).toBeTruthy();
  expect(legacyMarker.layer).toBe('new-pokestop');
  expect(legacyMarker.inMap).toBe(true);
  expect(legacyMarker.width).toBeGreaterThan(0);
  expect(legacyMarker.height).toBeGreaterThan(0);
  expect(legacyMarker.pointerEvents).not.toBe('none');
  expect(legacyMarker.opacity).toBeGreaterThan(0);

  await page.mouse.click(legacyMarker.x, legacyMarker.y);
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmDelete')).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('Phase 5-D12 normal dev URL survives the complete legacy mutation flow', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await installRoutes(page);

  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow?.getState?.()?.interactionOwner || ''), { timeout:15000 }).toBe('map-engine');
  await expect.poll(() => page.evaluate(() => typeof window.CampsiteCreativeWorkspace?.getSnapshot === 'function'), { timeout:15000 }).toBe(true);

  const initialState = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(initialState.ready).toBe(true);
  expect(initialState.unified).toBe(true);
  expect(initialState.unifiedVisible).toBe(true);
  expect(initialState.interactive).toBe(true);
  expect(initialState.interactionOwner).toBe('map-engine');
  expect(initialState.rendered).toEqual({ markers:2, circles50:2, circles40:2, circles30:2 });

  const engineExisting = page.locator('.cm-engine-existing-icon');
  const engineCandidate = page.locator('.cm-engine-candidate-icon');
  await expect(engineExisting).toHaveCount(1);
  await expect(engineCandidate).toHaveCount(1);
  await expect(page.locator('.cm-engine-legacy-existing')).toHaveCount(1);
  await expect(page.locator('.cm-engine-legacy-candidate')).toHaveCount(1);
  expect(await page.locator('.cm-engine-legacy-existing').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await page.locator('.cm-engine-legacy-candidate').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');

  const existingBefore = await workspaceRecord(page, { layer:'existing-pokestop' });
  const candidateBefore = await workspaceRecord(page, 'c-stop');
  expect(existingBefore).toBeTruthy();
  expect(candidateBefore).toBeTruthy();
  const initialPosition = candidateBefore.latlng;

  await engineExisting.click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('.cm-sheet')).toContainText('既存POI（閲覧のみ）');
  await page.locator('.cm-sheet-close').click();
  await expect(page.locator('.cm-sheet')).toHaveCount(0);

  await engineCandidate.click();
  await expect(page.locator('#cmMove')).toBeVisible();
  await expect(page.locator('#cmDelete')).toBeVisible();
  await page.locator('#cmName').fill('Candidate Stop D12');
  await expect.poll(async () => (await workspaceRecord(page, 'c-stop'))?.title || '').toBe('Candidate Stop D12');

  await page.locator('#cmMove').click();
  await expect(page.locator('#cmMoveCrosshair')).toBeVisible();
  await expect(page.locator('#cmMoveBar')).toBeVisible();

  const mapSurface = page.locator('.leaflet-container').first();
  const box = await mapSurface.boundingBox();
  expect(box).toBeTruthy();
  const startX = box.x + box.width * 0.50;
  const startY = box.y + box.height * 0.45;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 64, startY - 48, { steps:12 });
  await page.mouse.up();
  await page.locator('#cmMoveConfirm').click();

  await expect(page.locator('#cmMoveBar')).toHaveCount(0);
  const movedCandidate = await workspaceRecord(page, 'c-stop');
  expect(movedCandidate.latlng).not.toEqual(initialPosition);
  const movedPosition = movedCandidate.latlng;
  await expect.poll(() => page.evaluate(() => {
    const m=window.__cmCandidateShadow?.getState?.()?.sync?.markers;
    return m ? [m.created,m.reused,m.removed] : null;
  })).toEqual([0,2,0]);

  await page.locator('#undo').click();
  await expect.poll(async () => (await workspaceRecord(page, 'c-stop'))?.latlng).toEqual(initialPosition);
  await page.locator('#redo').click();
  await expect.poll(async () => (await workspaceRecord(page, 'c-stop'))?.latlng).toEqual(movedPosition);

  const existingAfterMove = await workspaceRecord(page, { layer:'existing-pokestop' });
  expect(existingAfterMove).toEqual(existingBefore);

  await engineCandidate.dispatchEvent('click');
  await expect(page.locator('#cmDelete')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#cmDelete').click();

  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow.getState().rendered.markers)).toBe(1);
  const deletedCandidate = await workspaceRecord(page, 'c-stop');
  expect(deletedCandidate?.deleted).toBe(true);
  await expect(engineCandidate).toHaveCount(0);
  await expect(engineExisting).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => {
    const state=window.__cmCandidateShadow?.getState?.();
    return state ? [state.rendered.markers,state.rendered.circles50,state.rendered.circles40,state.rendered.circles30] : null;
  })).toEqual([1,1,1,1]);
  await expect.poll(() => page.evaluate(() => {
    const m=window.__cmCandidateShadow?.getState?.()?.sync?.markers;
    return m ? [m.created,m.reused,m.removed] : null;
  })).toEqual([0,1,1]);

  const existingAfterDelete = await workspaceRecord(page, { layer:'existing-pokestop' });
  expect(existingAfterDelete).toEqual(existingBefore);
  expect(browserErrors).toEqual([]);
});
