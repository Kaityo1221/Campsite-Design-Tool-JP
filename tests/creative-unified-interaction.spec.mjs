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

async function engineDiagnostics(page) {
  return page.evaluate(() => cmCandidateShadowRenderer.getDiagnostics().map(item => ({
    key: item.key,
    origin: item.origin,
    leafletId: item.leafletId,
    renderKind: item.renderKind,
    markerKind: item.markerKind,
    lat: Number(item.leafletLatLng.lat.toFixed(6)),
    lng: Number(item.leafletLatLng.lng.toFixed(6))
  })));
}

function byKey(items, key) {
  return items.find(item => item.key === key);
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

  const state = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(state.ready).toBe(true);
  expect(state.unified).toBe(true);
  expect(state.unifiedVisible).toBe(true);
  expect(state.interactive).toBe(true);
  expect(state.interactionOwner).toBe('map-engine');
  expect(state.rendered).toEqual({ markers:5, circles50:5, circles40:5, circles30:5 });

  await expect(page.locator('.cm-engine-existing-icon')).toHaveCount(4);
  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-legacy-existing')).toHaveCount(4);
  await expect(page.locator('.cm-engine-legacy-candidate')).toHaveCount(1);

  expect(await page.locator('.cm-engine-legacy-existing').first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await page.locator('.cm-engine-legacy-candidate').first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('none');
  expect(await page.locator('.cm-engine-existing-icon').first().evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');
  expect(await page.locator('.cm-engine-candidate-icon').evaluate(el => getComputedStyle(el).pointerEvents)).toBe('auto');

  const candidateKey = 'marker:candidate:c-stop';
  const existingKey = 'marker:poi:guid-stop';
  const initialDiagnostics = await engineDiagnostics(page);
  const initialCandidate = byKey(initialDiagnostics, candidateKey);
  const initialExisting = byKey(initialDiagnostics, existingKey);
  expect(initialCandidate).toBeTruthy();
  expect(initialExisting).toBeTruthy();
  expect(initialCandidate.origin).toBe('candidate');
  expect(initialExisting.origin).toBe('existing');

  // Existing POI tap must be handed back to the current read-only Creative sheet.
  await page.locator('.cm-engine-existing-icon').first().click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('.cm-sheet')).toContainText('既存POI（閲覧のみ）');
  await page.locator('.cm-sheet-close').click();
  await expect(page.locator('.cm-sheet')).toHaveCount(0);

  // Candidate tap must open the current editor, not a new Map Engine editor.
  await page.locator('.cm-engine-candidate-icon').click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmMove')).toBeVisible();
  await expect(page.locator('#cmType')).toBeVisible();
  await expect(page.locator('#cmDelete')).toBeVisible();

  await page.locator('#cmName').fill('Candidate Stop Edited');
  await expect.poll(() => page.evaluate(() => records.find(r => r.id === 'c-stop')?.title || '')).toBe('Candidate Stop Edited');

  // Start the legacy move flow from the sheet, then finish its Leaflet drag session.
  await page.locator('#cmMove').click();
  await expect.poll(() => page.evaluate(() => typeof cmMoveSession !== 'undefined' && !!cmMoveSession && cmMoveSession.r?.id === 'c-stop')).toBe(true);

  const moved = [35.68310, 139.76910];
  await page.evaluate(to => {
    cmMoveSession.marker.setLatLng(to);
    cmMoveSession.marker.fire('drag');
    cmMoveSession.marker.fire('dragend');
  }, moved);

  await expect.poll(async () => {
    const item = byKey(await engineDiagnostics(page), candidateKey);
    return item ? [item.lat, item.lng] : null;
  }).toEqual(moved);
  let movedDiagnostics = await engineDiagnostics(page);
  expect(byKey(movedDiagnostics, candidateKey).leafletId).toBe(initialCandidate.leafletId);
  expect(byKey(movedDiagnostics, existingKey).leafletId).toBe(initialExisting.leafletId);

  // Move flow reopens the sheet. Close it before using the global Undo/Redo controls.
  await page.locator('.cm-sheet-close').click();
  await page.locator('#undo').click();
  await expect.poll(async () => {
    const item = byKey(await engineDiagnostics(page), candidateKey);
    return item ? [item.lat, item.lng] : null;
  }).toEqual([35.6826, 139.7688]);
  let undoDiagnostics = await engineDiagnostics(page);
  expect(byKey(undoDiagnostics, candidateKey).leafletId).toBe(initialCandidate.leafletId);
  expect(byKey(undoDiagnostics, existingKey).leafletId).toBe(initialExisting.leafletId);

  await page.locator('#redo').click();
  await expect.poll(async () => {
    const item = byKey(await engineDiagnostics(page), candidateKey);
    return item ? [item.lat, item.lng] : null;
  }).toEqual(moved);
  let redoDiagnostics = await engineDiagnostics(page);
  expect(byKey(redoDiagnostics, candidateKey).leafletId).toBe(initialCandidate.leafletId);
  expect(byKey(redoDiagnostics, existingKey).leafletId).toBe(initialExisting.leafletId);

  // Delete through the real sheet to prove mutation ownership remains legacy Creative Mode.
  await page.locator('.cm-engine-candidate-icon').click();
  await expect(page.locator('#cmDelete')).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#cmDelete').click();

  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow.getState().rendered.markers)).toBe(4);
  const deletedDiagnostics = await engineDiagnostics(page);
  expect(byKey(deletedDiagnostics, candidateKey)).toBeUndefined();
  expect(byKey(deletedDiagnostics, existingKey).leafletId).toBe(initialExisting.leafletId);
  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(0);
  await expect(page.locator('.cm-engine-existing-icon')).toHaveCount(4);

  expect(browserErrors).toEqual([]);
});
