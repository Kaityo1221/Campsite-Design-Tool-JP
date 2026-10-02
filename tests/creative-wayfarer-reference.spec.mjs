import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

const project = {
  source: 'bridge',
  projectId: 'wm3c-reference-browser-gate',
  phase: 'design',
  createdAt: '2026-10-02T06:10:00.000Z',
  updatedAt: '2026-10-02T06:10:00.000Z',
  circleRadii: [50, 40, 30],
  polygon: [
    [35.6810, 139.7670],
    [35.6810, 139.7690],
    [35.6830, 139.7690],
    [35.6830, 139.7670]
  ],
  selectedPois: [
    { id:'e-stop', guid:'guid-stop', title:'Editable Stop', lat:35.6815, lng:139.7675, gameEntity:'POKESTOP', gameStatus:'ACTIVE', layer:'existing-pokestop', role:'existing' },
    { id:'c-stop', guid:'', title:'Candidate Stop', lat:35.6820, lng:139.7680, gameEntity:'POKESTOP', gameStatus:'UNKNOWN', layer:'new-pokestop', role:'added' }
  ],
  wayfarerObservation: {
    version: '0.2.0',
    observedAt: '2026-10-02T06:09:00.000Z',
    polygon: [
      [35.6810, 139.7670],
      [35.6810, 139.7690],
      [35.6830, 139.7690],
      [35.6830, 139.7670]
    ],
    zones: {
      interior: [
        { guid:'guid-stop', title:'Duplicate Editable Stop', lat:35.6815, lng:139.7675, poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE' },
        { guid:'observed-inside', title:'Observed Inside Gym', lat:35.6824, lng:139.7684, poiKind:'GYM', gameEntity:'GYM', gameStatus:'ACTIVE' }
      ],
      reference100: [
        { guid:'observed-outer', title:'Observed Outer Stop', lat:35.6834, lng:139.7686, poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE' }
      ],
      reserve200: [
        { guid:'observed-reserve', title:'Reserve Power', lat:35.6840, lng:139.7690, poiKind:'POWERSPOT', gameEntity:'POWERSPOT', gameStatus:'ACTIVE' }
      ]
    },
    counts: {
      interior: { total:2 },
      reference100: { total:1 },
      reserve200: { total:1 }
    }
  }
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

async function workspaceSnapshot(page) {
  return page.evaluate(() => {
    const snapshot = window.CampsiteCreativeWorkspace?.getSnapshot?.();
    return (snapshot?.records || []).map(record => ({
      id: record.id || '',
      guid: record.guid || '',
      title: record.title || '',
      layer: record.layer || '',
      deleted: record.deleted === true,
      latlng: Array.isArray(record.latlng) ? record.latlng.map(Number) : null
    }));
  });
}

test('WM-3C real Creative renders read-only Wayfarer references without entering records', async ({ page }) => {
  const browserErrors = collectBrowserErrors(page);
  await installRoutes(page);

  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.count || 0), { timeout:15000 }).toBe(2);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow?.getState?.()?.interactionOwner || ''), { timeout:15000 }).toBe('map-engine');
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference?.getState?.()?.ready === true), { timeout:15000 }).toBe(true);

  const beforeRecords = await workspaceSnapshot(page);
  expect(beforeRecords).toHaveLength(2);

  const refState = await page.evaluate(() => window.__cmWayfarerReference.getState());
  expect(refState).toMatchObject({ ready:true, display:2, reserve:1, suppressed:1, invalid:0, lastError:'' });

  const rendererState = await page.evaluate(() => window.__cmCandidateShadow.getState());
  expect(rendererState.rendered).toEqual({ markers:4, circles50:4, circles40:2, circles30:2 });

  const referenceIcons = page.locator('.cm-engine-reference-icon');
  await expect(referenceIcons).toHaveCount(2);
  await expect(page.locator('.cm-engine-existing-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-candidate-icon')).toHaveCount(1);
  await expect(page.locator('.cm-engine-reference-icon.leaflet-interactive')).toHaveCount(0);

  const referenceScene = await page.evaluate(() => window.__cmWayfarerReference.getScene());
  const referenceItems = referenceScene.items.filter(item => item.origin === 'reference');
  expect(referenceItems.filter(item => item.layerKey === 'marker')).toHaveLength(2);
  expect(referenceItems.filter(item => item.layerKey === 'circle-50')).toHaveLength(2);
  expect(referenceItems.some(item => String(item.ownerKey).includes('observed-reserve'))).toBe(false);
  expect(referenceItems.some(item => String(item.ownerKey).includes('guid-stop'))).toBe(false);
  expect(referenceItems.every(item => item.readOnly === true)).toBe(true);

  const insideMarker = referenceItems.find(item => item.key === 'marker:reference:observed-inside');
  const outerMarker = referenceItems.find(item => item.key === 'marker:reference:observed-outer');
  expect(insideMarker).toBeTruthy();
  expect(outerMarker).toBeTruthy();
  expect(Number(outerMarker.style.opacity)).toBeLessThan(Number(insideMarker.style.opacity));

  const afterInitialRender = await workspaceSnapshot(page);
  expect(afterInitialRender).toEqual(beforeRecords);

  await page.evaluate(() => {
    const current = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    current.wayfarerObservation.zones.reference100.push({
      guid:'observed-outer-2',
      title:'Observed Outer Gym 2',
      lat:35.6835,
      lng:139.7688,
      poiKind:'GYM',
      gameEntity:'GYM',
      gameStatus:'ACTIVE'
    });
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('campsite:wayfarer-observation-saved', { detail:{ observedAt:'2026-10-02T06:12:00.000Z' } }));
  });

  await expect(referenceIcons).toHaveCount(3);
  await expect.poll(() => page.evaluate(() => window.__cmWayfarerReference.getState().display)).toBe(3);
  await expect.poll(() => page.evaluate(() => window.__cmCandidateShadow.getState().rendered.markers)).toBe(5);
  const afterRefreshRecords = await workspaceSnapshot(page);
  expect(afterRefreshRecords).toEqual(beforeRecords);

  expect(browserErrors).toEqual([]);
});
