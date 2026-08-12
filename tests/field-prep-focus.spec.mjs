import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');

const points = [
  { name: '入口', lat: 35.6800, lng: 139.7600, type: 'Pokestop', gameStatus: '' },
  { name: '広場', lat: 35.6810, lng: 139.7610, type: 'Gym', gameStatus: '' },
  { name: '北側', lat: 35.6820, lng: 139.7620, type: 'Power Spot', gameStatus: '' }
];

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

async function openPreparedMap(page) {
  await page.goto('/field-prep.html');
  await page.evaluate(preparedPoints => {
    window.dispatchEvent(new CustomEvent('fieldprep:datachanged', {
      detail: { state: { uniquePoints: preparedPoints } }
    }));
  }, points);
  await expect(page.locator('#fieldPrepSurveySection')).toBeVisible();
  await expect(page.locator('#fieldPrepStartAreaButton')).toBeEnabled();
}

test('通常時は地図を確認用にし、調査範囲設定時だけ集中モードへ入る', async ({ page }) => {
  await openPreparedMap(page);

  await expect(page.locator('.field-prep-map-gate')).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('#fieldPrepAddVertexButton')).toBeHidden();

  await page.locator('#fieldPrepStartAreaButton').click();

  await expect(page.locator('body')).toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('.field-prep-focus-exit')).toBeVisible();
  await expect(page.locator('#fieldPrepStartAreaButton')).toBeHidden();
  await expect(page.locator('#fieldPrepAddVertexButton')).toBeVisible();
  await expect(page.locator('#fieldPrepUndoVertexButton')).toBeVisible();
  await expect(page.locator('#fieldPrepConfirmAreaButton')).toBeVisible();
});

test('集中モードを閉じても未確定の頂点を保ち、編集を再開できる', async ({ page }) => {
  await openPreparedMap(page);
  await page.locator('#fieldPrepStartAreaButton').click();
  await page.locator('#fieldPrepAddVertexButton').click();
  await expect(page.locator('#fieldPrepVertexCount')).toHaveText('1');

  await page.locator('.field-prep-focus-exit').click();
  await expect(page.locator('body')).not.toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('#fieldPrepStartAreaButton')).toContainText('編集を続ける');
  await expect(page.locator('#fieldPrepVertexCount')).toHaveText('1');

  await page.locator('#fieldPrepStartAreaButton').click();
  await expect(page.locator('body')).toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('#fieldPrepVertexCount')).toHaveText('1');
});

test('範囲を確定すると集中モードを抜けて通常スクロール画面へ戻る', async ({ page }) => {
  await openPreparedMap(page);
  await page.locator('#fieldPrepStartAreaButton').click();

  await page.locator('#fieldPrepAddVertexButton').click();
  await page.evaluate(() => {
    const mapNode = document.getElementById('fieldPrepMap');
    mapNode.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  });
  await page.locator('#fieldPrepAddVertexButton').click();
  await page.locator('#fieldPrepAddVertexButton').click();
  await expect(page.locator('#fieldPrepConfirmAreaButton')).toBeEnabled();

  await page.locator('#fieldPrepConfirmAreaButton').click();
  await expect(page.locator('body')).not.toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('.field-prep-map-gate')).toBeVisible();
  await expect(page.locator('#fieldPrepStartAreaButton')).toContainText('調査範囲を編集');
});
