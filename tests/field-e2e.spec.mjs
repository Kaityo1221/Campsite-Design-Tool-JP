import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

const csvA = [
  'name,latitude,longitude,gameEntity,guid',
  '公園入口,35.680000,139.760000,Pokestop,guid-a',
  '中央広場,35.681000,139.761000,Gym,guid-b',
  ''
].join('\n');

const csvB = [
  'name,latitude,longitude,gameEntity,guid',
  '公園入口（重複）,35.680000,139.760000,Pokestop,guid-a',
  '北側広場,35.682000,139.762000,Power Spot,guid-c',
  ''
].join('\n');

const surveyPolygon = [
  [35.6790, 139.7590],
  [35.6790, 139.7630],
  [35.6830, 139.7630],
  [35.6830, 139.7590]
];

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

function folderBody(kmlText, folderName) {
  const escaped = folderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = kmlText.match(new RegExp(`<Folder>\\s*<name>${escaped}<\\/name>([\\s\\S]*?)<\\/Folder>`));
  return match?.[1] || '';
}

function folderPointNames(kmlText, folderName) {
  return [...folderBody(kmlText, folderName).matchAll(/<Placemark>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<Point>/g)].map(item => item[1]);
}

function folderPlacemarkNames(kmlText, folderName) {
  return [...folderBody(kmlText, folderName).matchAll(/<Placemark>[\s\S]*?<name>([^<]+)<\/name>/g)].map(item => item[1]);
}

function expectLayerOrder(kmlText, layerNames) {
  let previousIndex = -1;
  for (const layerName of layerNames) {
    const index = kmlText.indexOf(`<name>${layerName}</name>`);
    expect(index, `完成KMZに「${layerName}」レイヤーがありません`).toBeGreaterThan(-1);
    expect(index, `「${layerName}」のレイヤー順が崩れています`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

async function savePreparedSurveyAndReload(page) {
  await page.evaluate(async polygon => {
    const core = window.FieldPrep.getState();
    await window.FieldPrepSession.save({
      core,
      survey: { polygon }
    });
  }, surveyPolygon);

  await page.reload();
  await expect(page.locator('#fieldPrepRestoreNote')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('#fieldPrepInsideCount')).toHaveText('3');
  await expect(page.locator('#fieldPrepOutsideCount')).toHaveText('0');
  await expect(page.locator('#fieldPrepStartFieldModeButton')).toBeEnabled();
}

async function addNewPoi(page, typeLabel) {
  await expect(page.locator('#fieldPoiTypeButton')).toContainText(typeLabel);
  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('この位置に設置');
  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText(`${typeLabel} 1`);
}

async function createThreePointArea(page) {
  await page.locator('#fieldModeCreativeButton').click();
  const areaTool = page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect.poll(() => areaTool.isEnabled()).toBe(true);
  await areaTool.click();

  const add = page.locator('[data-area-action="add"]');
  await add.click();
  await page.evaluate(() => map.panBy([70, 0], { animate: false }));
  await add.click();
  await page.evaluate(() => map.panBy([0, 70], { animate: false }));
  await add.click();
  await expect(page.locator('[data-area-action="confirm"]')).toBeEnabled();
  await page.locator('[data-area-action="confirm"]').click();
  await expect(page.locator('#fieldModeSelectionDetail')).toContainText('Polygon');
}

async function downloadFinalKml(page) {
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#fieldModeSaveButton').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const zip = await JSZip.loadAsync(fs.readFileSync(downloadPath));
  const doc = zip.file('doc.kml');
  expect(doc).not.toBeNull();
  return doc.async('string');
}

test('調査ファイルから調査範囲・現地作業・完成KMZまで一気通しできる', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.goto('/field-prep.html');
  await page.locator('#fieldPrepFiles').setInputFiles([
    { name: 'nearby-wayspots-2026-08-09 7.csv', mimeType: 'text/csv', buffer: Buffer.from(csvA) },
    { name: 'nearby-wayspots-2026-08-09 8.csv', mimeType: 'text/csv', buffer: Buffer.from(csvB) }
  ]);
  await expect(page.locator('.field-prep-file-remove')).toHaveCount(2);
  await page.locator('#fieldPrepAnalyzeButton').click();
  await expect(page.locator('#fieldPrepUniqueCount')).toHaveText('3');
  await expect(page.locator('#fieldPrepDuplicateCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepPokestopCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepGymCount')).toHaveText('1');
  await expect(page.locator('#fieldPrepPowerCount')).toHaveText('1');

  await savePreparedSurveyAndReload(page);

  await page.locator('#fieldPrepStartFieldModeButton').click();
  await expect(page).toHaveURL(/\/field-mode\.html(?:\?|$)/, { timeout: 12000 });
  await expect(page).not.toHaveURL(/handoff=/, { timeout: 12000 });
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み', { timeout: 12000 });
  await expect.poll(() => page.evaluate(() => window.FieldModeSession?.hasSource?.() || false)).toBe(true);
  await expect(page.locator('#fieldModeNewPoiButton')).toBeEnabled();
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();

  await addNewPoi(page, 'ポケストップ');

  await expect(page.locator('#fieldPoi30mToggle')).toBeVisible();
  await page.locator('#fieldPoi30mToggle').click();
  await expect(page.locator('#fieldPoi30mToggle')).toContainText('追加する');

  await page.locator('#fieldPoiTypeButton').click();
  await addNewPoi(page, 'ジム');

  await page.locator('#fieldPoiTypeButton').click();
  await addNewPoi(page, 'パワースポット');

  await createThreePointArea(page);

  const kml = await downloadFinalKml(page);

  expect(folderPointNames(kml, '既存のポケストップ')).toContain('公園入口');
  expect(folderPointNames(kml, '既存のジム')).toContain('中央広場');
  expect(folderPointNames(kml, '既存のパワースポット')).toContain('北側広場');

  expect(folderPointNames(kml, '追加希望ポケスト')).toContain('ポケストップ 1');
  expect(folderPointNames(kml, '追加希望ジム')).toContain('ジム 1');
  expect(folderPointNames(kml, '追加希望パワスポ')).toContain('パワースポット 1');

  const circles40 = folderPlacemarkNames(kml, '40m円（基本距離）');
  expect(circles40).toEqual(expect.arrayContaining([
    '公園入口_40m円',
    '中央広場_40m円',
    '北側広場_40m円',
    'ポケストップ 1_40m円',
    'ジム 1_40m円',
    'パワースポット 1_40m円'
  ]));
  expect(circles40).toHaveLength(6);

  expect(folderPlacemarkNames(kml, '30m円（調整用）')).toEqual(['ポケストップ 1_30m円']);
  expect(kml).toContain('<name>活動範囲 1</name>');

  expectLayerOrder(kml, [
    '既存のポケストップ',
    '既存のジム',
    '既存のパワースポット',
    '追加希望ポケスト',
    '追加希望ジム',
    '追加希望パワスポ',
    '40m円（基本距離）',
    '30m円（調整用）'
  ]);

  for (const forbiddenLayer of [
    '調査範囲',
    '追加希望POI',
    '現地モード_30m円',
    '現地モード_40m円',
    '現地モード_距離円'
  ]) {
    expect(kml).not.toContain(`<name>${forbiddenLayer}</name>`);
  }

  expect(pageErrors).toEqual([]);
});
