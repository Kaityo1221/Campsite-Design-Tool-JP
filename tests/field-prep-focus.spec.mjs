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
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: '' }));
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

test('Campsite Labから現地準備へ迷わず入れる', async ({ page }) => {
  await page.goto('/lab.html');
  const entry = page.locator('#labFieldPrepEntry');
  await expect(entry).toBeVisible();
  await expect(entry).toContainText('現地準備');
  await entry.click();
  await expect(page).toHaveURL(/\/field-prep\.html$/);
  await expect(page.getByRole('heading', { name: '現地モード準備' })).toBeVisible();
});

test('通常時も地図を触れ、範囲設定時だけ集中モードへ入る', async ({ page }) => {
  await openPreparedMap(page);

  await expect(page.locator('.field-prep-map-gate')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('#fieldPrepAddVertexButton')).toBeHidden();

  const normalMapStyle = await page.locator('#fieldPrepMap').evaluate(el => ({
    pointerEvents: getComputedStyle(el).pointerEvents,
    touchAction: getComputedStyle(el).touchAction
  }));
  expect(normalMapStyle.pointerEvents).not.toBe('none');
  expect(normalMapStyle.touchAction).toBe('none');

  const crosshairStyle = await page.locator('.field-prep-crosshair').evaluate(el => ({
    width: getComputedStyle(el).width,
    height: getComputedStyle(el).height,
    border: getComputedStyle(el).borderTopWidth,
    background: getComputedStyle(el).backgroundColor,
    fontSize: getComputedStyle(el).fontSize
  }));
  expect(crosshairStyle.width).toBe('22px');
  expect(crosshairStyle.height).toBe('22px');
  expect(crosshairStyle.border).toBe('0px');
  expect(crosshairStyle.background).toBe('rgba(0, 0, 0, 0)');
  expect(crosshairStyle.fontSize).toBe('0px');

  await page.locator('#fieldPrepStartAreaButton').click();

  await expect(page.locator('body')).toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('.field-prep-focus-exit')).toBeVisible();
  await expect(page.locator('#fieldPrepStartAreaButton')).toBeHidden();
  await expect(page.locator('#fieldPrepAddVertexButton')).toBeVisible();
  await expect(page.locator('#fieldPrepUndoVertexButton')).toBeVisible();
  await expect(page.locator('#fieldPrepConfirmAreaButton')).toBeVisible();
});

test('集中モードを閉じても未確定の頂点を保ち、地図位置へ戻って編集を再開できる', async ({ page }) => {
  await openPreparedMap(page);
  await page.locator('#fieldPrepStartAreaButton').scrollIntoViewIfNeeded();

  await page.locator('#fieldPrepStartAreaButton').click();
  await page.locator('#fieldPrepAddVertexButton').click();
  await expect(page.locator('#fieldPrepVertexCount')).toHaveText('1');

  await page.locator('.field-prep-focus-exit').click();
  await expect(page.locator('body')).not.toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('#fieldPrepStartAreaButton')).toContainText('編集を続ける');
  await expect(page.locator('#fieldPrepVertexCount')).toHaveText('1');

  const mapInViewport = await page.locator('.field-prep-map-shell').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
  expect(mapInViewport).toBe(true);

  await page.locator('#fieldPrepStartAreaButton').click();
  await expect(page.locator('body')).toHaveClass(/field-prep-map-focus/);
  await expect(page.locator('#fieldPrepVertexCount')).toHaveText('1');
});

test('範囲を確定すると集中モードを抜け、地図が見える位置へ戻る', async ({ page }) => {
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
  await expect(page.locator('.field-prep-map-gate')).toHaveCount(0);
  await expect(page.locator('#fieldPrepStartAreaButton')).toContainText('調査範囲を編集');

  const mapInViewport = await page.locator('.field-prep-map-shell').evaluate(el => {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
  expect(mapInViewport).toBe(true);
});
