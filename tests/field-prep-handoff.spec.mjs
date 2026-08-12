import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

test('準備KMLを直接現地モードへ渡し、既存セッション経路で読み込む', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/field-prep.html');
  const handoffId = await page.evaluate(async () => {
    const kml = window.FieldPrepSurvey.buildFieldKml([
      { name: '入口', lat: 35.6800, lng: 139.7600, type: 'Pokestop', gameStatus: '' },
      { name: '広場', lat: 35.6810, lng: 139.7610, type: 'Gym', gameStatus: '' },
      { name: '北側', lat: 35.6820, lng: 139.7620, type: 'Power Spot', gameStatus: '' }
    ]);
    const handoff = await window.FieldPrepSession.createHandoff({
      kml,
      sourceName: 'auto-handoff.kml',
      pointCount: 3
    });
    return handoff.id;
  });

  await page.goto(`/field-mode.html?handoff=${encodeURIComponent(handoffId)}`);

  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み', { timeout: 12000 });
  await expect(page).not.toHaveURL(/handoff=/);
  await expect.poll(() => page.evaluate(() => window.FieldModeSession?.hasSource?.() || false)).toBe(true);
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();

  const handoffStillExists = await page.evaluate(async id => {
    const request = indexedDB.open('campsite-field-prep', 1);
    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readonly');
        const get = tx.objectStore('state').get(`handoff:${id}`);
        get.onsuccess = () => resolve(Boolean(get.result));
        get.onerror = () => reject(get.error);
      });
    } finally {
      db.close();
    }
  }, handoffId);

  expect(handoffStillExists).toBe(false);
  expect(pageErrors).toEqual([]);
});

test('引き継ぎIDが不正でも通常のKML/KMZ選択を残す', async ({ page }) => {
  await page.goto('/field-mode.html?handoff=missing-id');
  await expect(page.locator('#fieldModeFileStatus')).toContainText('手動で選択できます', { timeout: 12000 });
  await expect(page.locator('#fieldModeFile')).toBeVisible();
  await expect(page.locator('#fieldModeFile')).toBeEnabled();
});
