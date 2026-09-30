import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

const project = {
  source: 'bridge',
  projectId: 'phase5-d11-dev-default',
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
  expect(await page.locator('.cm-engine-legacy-candidate').evaluate(el => getComputedStyle(el).pointerEvents)).not.toBe('none');

  await page.locator('.cm-engine-legacy-candidate').click();
  await expect(page.locator('.cm-sheet')).toBeVisible();
  await expect(page.locator('#cmDelete')).toBeVisible();
  expect(browserErrors).toEqual([]);
});
