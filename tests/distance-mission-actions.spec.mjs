import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

function fixture() {
  const lat = 35.6812;
  const lng = 139.7671;
  const existing = {
    id: 'existing-a', guid: 'existing-a', title: '既存A', name: '既存A',
    lat, lng, role: 'existing', gameEntity: 'POKESTOP', description: ''
  };
  const added = {
    id: 'added-a', guid: 'added-a', title: '新規A', name: '新規A',
    lat: lat + 0.00036, lng, role: 'added', gameEntity: 'POKESTOP',
    description: '現地で動線を確認済み'
  };
  return {
    schemaVersion: '1.0',
    projectId: 'distance-actions-e2e',
    source: 'bridge',
    phase: 'design',
    circleRadii: [50, 40, 30],
    polygon: [
      [lat - 0.001, lng - 0.001],
      [lat - 0.001, lng + 0.001],
      [lat + 0.001, lng + 0.001],
      [lat + 0.001, lng - 0.001]
    ],
    sourcePois: [existing],
    selectedPois: [existing],
    currentPois: [existing, added],
    addedPois: [added],
    deletedPois: [],
    edits: [],
    siteEnvironment: {
      traffic: 'easy',
      plaza: true,
      circulation: true,
      waiting: true
    },
    distanceResult: null
  };
}

async function openAndRun(page) {
  await page.addInitScript(project => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
  }, fixture());
  await page.goto('/bridge-distance.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => Boolean(window.CampsiteDistanceProject && typeof window.runDistanceCheck === 'function')), {
    timeout: 15000
  }).toBe(true);
  await page.evaluate(async () => window.runDistanceCheck());
  await expect(page.locator('.campsite-mission-shell')).toHaveCount(1, { timeout: 12000 });
}

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

test('MISSION UIの下でもセーブ・修正・提出前チェックの3導線が残る', async ({ page }) => {
  await openAndRun(page);

  await expect(page.locator('[data-distance-checkpoint-save]')).toBeVisible();
  await expect(page.locator('[data-project-rework]')).toBeVisible();
  await expect(page.locator('[data-go-pre-submit]')).toBeVisible();
  await expect(page.locator('[data-distance-checkpoint-save]')).toHaveText('💾 セーブする');
  await expect(page.locator('[data-project-rework]')).toContainText('✏️ CREATIVE MODEに戻って修正');
  await expect(page.locator('[data-go-pre-submit]')).toContainText('提出前チェックリストへ進む');
});

test('セーブするKMZはdoc.kmlとcampsite-project.jsonを保持する', async ({ page }) => {
  await openAndRun(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-distance-checkpoint-save]').click()
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const zip = await JSZip.loadAsync(fs.readFileSync(downloadPath));
  expect(Object.keys(zip.files)).toContain('doc.kml');
  expect(Object.keys(zip.files)).toContain('campsite-project.json');

  const project = JSON.parse(await zip.file('campsite-project.json').async('string'));
  expect(project.projectId).toBe('distance-actions-e2e');
  expect(project.siteEnvironment).toEqual({
    traffic: 'easy',
    plaza: true,
    circulation: true,
    waiting: true
  });
});

test('MISSION完了時は提出前チェックへ進める', async ({ page }) => {
  await openAndRun(page);
  await expect(page.getByText('🟢 準備完了！')).toBeVisible();

  await page.locator('[data-go-pre-submit]').dispatchEvent('click');

  await expect.poll(() => page.evaluate(() => {
    return JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.phase || null;
  })).toBe('pre-submit');
  const preSubmit = await page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    return project?.preSubmit || null;
  });
  expect(preSubmit?.source).toBe('campsiteProject.v1');
});
