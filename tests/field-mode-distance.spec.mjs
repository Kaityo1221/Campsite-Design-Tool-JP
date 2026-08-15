import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const sampleKml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder><name>既存POI</name><Placemark><name>既存地点</name><Point><coordinates>139.7666,35.6810,0</coordinates></Point></Placemark></Folder>
    <Folder><name>追加希望POI</name><Placemark><name>追加候補A</name><Point><coordinates>139.7677,35.6815,0</coordinates></Point></Placemark></Folder>
  </Document>
</kml>`;

test.beforeEach(async({page})=>{
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
});

async function openFieldMode(page){
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/field-mode.html');
  await page.locator('#fieldModeFile').setInputFiles({name:'distance.kml',mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect.poll(()=>page.evaluate(()=>!!window.FieldModeDistance&&!!window.FieldModeToolReturn)).toBe(true);
  return pageErrors;
}

async function openPalette(page){
  if(!(await page.locator('#fieldModeCreativeHotbar').evaluate(el=>el.classList.contains('is-open')))){
    await page.locator('#fieldModeCreativeButton').click();
  }
  await expect(page.locator('#fieldModeCreativeHotbar')).toHaveClass(/is-open/);
}

test('距離ツールは始点から十字までをリアルタイム計測し、終了で道具箱へ戻る',async({page})=>{
  const pageErrors=await openFieldMode(page);
  await openPalette(page);
  const distance=page.locator('#fieldModeCreativeHotbar [data-tool="distance"]');
  await expect(distance).toBeEnabled();
  await distance.click();
  await expect(page.locator('#fieldModeDistanceActions')).toBeVisible();
  await expect(page.locator('#fieldModeMeasureBadge')).toBeVisible();
  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();

  await page.locator('[data-distance-action="start"]').click();
  await page.evaluate(()=>map.panBy([100,0],{animate:false}));
  await expect(page.locator('#fieldModeMeasureBadge')).toContainText('m');
  const measured=await page.locator('#fieldModeMeasureBadge').textContent();
  expect(Number.parseFloat(measured.replace(/[^0-9.]/g,''))).toBeGreaterThan(0);

  await page.locator('[data-distance-action="exit"]').click();
  await expect(page.locator('#fieldModeCreativeHotbar')).toHaveClass(/is-open/);
  await expect(page.locator('#fieldModeDistanceActions')).toBeHidden();
  await expect(page.locator('#fieldModeMeasureBadge')).toBeHidden();
  await expect(page.locator('#fieldModeCrosshair')).toBeHidden();
  expect(await page.evaluate(()=>window.FieldCreative.activeTool())).toBe(null);
  expect(pageErrors).toEqual([]);
});

test('距離判定は30m・40mを参考境界、50mを確保境界として共通化する',async({page})=>{
  const pageErrors=await openFieldMode(page);
  const bands=await page.evaluate(()=>[29.9,30,39.9,40,49.9,50].map(distance=>({
    distance,
    policy:window.CampsitePoiSpacingPolicy.distanceBand(distance),
    tool:window.FieldModeDistance.bandForDistance(distance)
  })));
  expect(bands).toEqual([
    {distance:29.9,policy:'danger',tool:'danger'},
    {distance:30,policy:'caution',tool:'caution'},
    {distance:39.9,policy:'caution',tool:'caution'},
    {distance:40,policy:'near',tool:'near'},
    {distance:49.9,policy:'near',tool:'near'},
    {distance:50,policy:'ok',tool:'ok'}
  ]);
  expect(pageErrors).toEqual([]);
});

test('範囲作成をやめると下書きを破棄して道具箱へ戻る',async({page})=>{
  const pageErrors=await openFieldMode(page);
  await openPalette(page);
  const area=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect(area).toBeEnabled();
  await area.click();
  await page.locator('[data-area-action="add"]').click();
  await expect(page.locator('[data-area-action="cancel"]')).toHaveText('× 範囲作成をやめる');
  await page.locator('[data-area-action="cancel"]').click();
  await expect(page.locator('#fieldModeCreativeHotbar')).toHaveClass(/is-open/);
  await expect(page.locator('#fieldModeAreaActions')).toBeHidden();
  await expect(page.locator('#fieldModeCrosshair')).toBeHidden();
  expect(await page.evaluate(()=>window.FieldCreative.activeTool())).toBe(null);
  expect(pageErrors).toEqual([]);
});

test('消去をやめると対象選択を解除して道具箱へ戻る',async({page})=>{
  const pageErrors=await openFieldMode(page);
  await openPalette(page);
  const eraser=page.locator('#fieldModeCreativeHotbar [data-tool="eraser"]');
  await expect(eraser).toBeEnabled();
  await eraser.click();
  await expect(page.locator('#fieldModeEraserActions')).toBeVisible();
  await expect(page.locator('[data-eraser-action="exit"]')).toHaveText('× 消去をやめる');
  await page.locator('[data-eraser-action="exit"]').click();
  await expect(page.locator('#fieldModeCreativeHotbar')).toHaveClass(/is-open/);
  await expect(page.locator('#fieldModeEraserActions')).toBeHidden();
  expect(await page.evaluate(()=>window.FieldCreative.activeTool())).toBe(null);
  expect(pageErrors).toEqual([]);
});

test('位置調整をやめると微調整状態も解除して道具箱へ戻る',async({page})=>{
  const pageErrors=await openFieldMode(page);
  await page.evaluate(()=>selectAddedPoi(poiRecords.find(record=>record.added&&!record.fieldDeleted)));
  await openPalette(page);
  const adjust=page.locator('#fieldModeCreativeHotbar [data-tool="adjust"]');
  await expect(adjust).toBeEnabled();
  await adjust.click();
  await page.locator('#fieldModeFineTuneButton').click();
  expect(await page.evaluate(()=>fineTuneMode)).toBe(true);
  await expect(page.locator('#fieldModeAdjustCancel')).toHaveText('× 位置調整をやめる');
  await page.locator('#fieldModeAdjustCancel').click();
  await expect(page.locator('#fieldModeCreativeHotbar')).toHaveClass(/is-open/);
  expect(await page.evaluate(()=>fineTuneMode)).toBe(false);
  await expect(page.locator('#fieldModeCrosshair')).toBeHidden();
  expect(await page.evaluate(()=>window.FieldCreative.activeTool())).toBe(null);
  expect(pageErrors).toEqual([]);
});
