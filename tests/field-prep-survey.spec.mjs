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

test('調査範囲の内外判定ができ、境界上も範囲内として扱う', async ({ page }) => {
  await page.goto('/field-prep.html');

  const result = await page.evaluate(() => {
    const polygon = [
      [35.6800, 139.7600],
      [35.6800, 139.7640],
      [35.6840, 139.7640],
      [35.6840, 139.7600]
    ];

    return {
      inside: window.FieldPrepSurvey.pointInPolygon({ lat: 35.6820, lng: 139.7620 }, polygon),
      outside: window.FieldPrepSurvey.pointInPolygon({ lat: 35.6860, lng: 139.7620 }, polygon),
      boundary: window.FieldPrepSurvey.pointInPolygon({ lat: 35.6800, lng: 139.7620 }, polygon)
    };
  });

  expect(result.inside).toBe(true);
  expect(result.outside).toBe(false);
  expect(result.boundary).toBe(true);
});

test('現地モード用KMLは正式フォルダと50m円を含み、調査範囲は出力しない', async ({ page }) => {
  await page.goto('/field-prep.html');

  const kml = await page.evaluate(() => window.FieldPrepSurvey.buildFieldKml([
    { name: '入口', lat: 35.6800, lng: 139.7600, type: 'Pokestop', gameStatus: '' },
    { name: '広場', lat: 35.6810, lng: 139.7610, type: 'Gym', gameStatus: '' },
    { name: '北側', lat: 35.6820, lng: 139.7620, type: 'Power Spot', gameStatus: '' }
  ]));

  for (const folderName of [
    '既存のポケストップ',
    '既存のジム',
    '既存のパワースポット',
    '追加希望ポケスト',
    '追加希望ジム',
    '追加希望パワスポ',
    '活動範囲',
    '50m円（目安）',
    '40m円（参考距離）',
    '30m円（参考距離）'
  ]) {
    expect(kml).toContain(`<name>${folderName}</name>`);
  }

  expect(kml).toContain('入口_50m円');
  expect(kml).toContain('広場_50m円');
  expect(kml).toContain('北側_50m円');
  expect(kml).not.toContain('<name>調査範囲</name>');
});

test('準備専用IndexedDBへ保存して復元できる', async ({ page }) => {
  await page.goto('/field-prep.html');

  const saved = await page.evaluate(async () => {
    await window.FieldPrepSession.clear();
    await window.FieldPrepSession.save({
      core: {
        rawPoints: [{ name: '保存POI', lat: 35.68, lng: 139.76 }],
        uniquePoints: [{ name: '保存POI', lat: 35.68, lng: 139.76 }],
        duplicateCount: 0,
        fileResults: [{ name: 'saved.csv', count: 1, error: '' }]
      },
      survey: { polygon: [[35.67, 139.75], [35.67, 139.77], [35.69, 139.76]] }
    });
    return window.FieldPrepSession.load();
  });

  expect(saved.version).toBe(1);
  expect(saved.core.uniquePoints).toHaveLength(1);
  expect(saved.core.uniquePoints[0].name).toBe('保存POI');
  expect(saved.survey.polygon).toHaveLength(3);
});

test('準備画面が生成したKMLをCREATIVE MODEがそのまま読み込める', async ({ page }) => {
  await page.goto('/field-prep.html');

  const kml = await page.evaluate(() => window.FieldPrepSurvey.buildFieldKml([
    { name: '入口', lat: 35.6800, lng: 139.7600, type: 'Pokestop', gameStatus: '' },
    { name: '広場', lat: 35.6810, lng: 139.7610, type: 'Gym', gameStatus: '' },
    { name: '北側', lat: 35.6820, lng: 139.7620, type: 'Power Spot', gameStatus: '' }
  ]));

  await page.goto('/field-mode.html');
  await expect(page.locator('#fieldModeEntry')).toBeVisible();
  await expect(page.locator('#fieldModeMap')).toBeHidden();
  await page.locator('#fieldModeFile').setInputFiles({
    name: 'field-prep-generated.kml',
    mimeType: 'application/vnd.google-earth.kml+xml',
    buffer: Buffer.from(kml)
  });

  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({ timeout: 3000 });
  await expect(page.locator('#fieldModeMap')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toBeHidden();
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();
  await expect.poll(() => page.evaluate(() => window.FieldModeApacV4?.additionalCount?.() ?? -1)).toBe(0);
});
