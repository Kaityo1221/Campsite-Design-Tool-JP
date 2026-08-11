import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const sampleKml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <Folder>
      <name>既存POI</name>
      <Placemark><name>既存地点</name><Point><coordinates>139.7666,35.6810,0</coordinates></Point></Placemark>
    </Folder>
    <Folder>
      <name>追加希望POI</name>
      <Placemark><name>追加候補A</name><Point><coordinates>139.7677,35.6815,0</coordinates></Point></Placemark>
    </Folder>
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
  await expect(page.locator('#fieldModeMap')).toBeVisible();
  await page.locator('#fieldModeFile').setInputFiles({
    name:'smoke.kml',
    mimeType:'application/vnd.google-earth.kml+xml',
    buffer:Buffer.from(sampleKml)
  });
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeNewPoiButton')).toBeEnabled();
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();
  expect(pageErrors).toEqual([]);
  return pageErrors;
}

test('新規設置は道具箱で取消でき、パレットは再タップで閉じる',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('body')).toHaveClass(/field-creative-active/);
  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('この位置に設置');

  await page.locator('#fieldModeCreativeButton').click();
  await expect(page.locator('#fieldModeCrosshair')).toBeHidden();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('新規設置');
  await expect(page.locator('#fieldModeCreativeHotbar')).toBeVisible();
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="poi"]')).toBeVisible();

  await page.locator('#fieldModeCreativeButton').click();
  await expect(page.locator('#fieldModeCreativeHotbar')).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/field-creative-active/);

  await page.locator('#fieldModeCreativeClose').click();
  await expect(page.locator('body')).not.toHaveClass(/field-creative-active/);
  expect(pageErrors).toEqual([]);
});

test('新規POIを確定後、戻る・進むでUndo/Redoできる',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();
  await page.locator('#fieldModeNewPoiButton').click();

  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  await page.locator('#fieldModeUndoButton').click();
  await expect(page.locator('#fieldModeRedoButton')).toBeEnabled();
  await page.locator('#fieldModeRedoButton').click();
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('現地作業はリロード後に続きから再開でき、履歴も復元される',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();
  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('ポケストップ 1');
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();

  await page.evaluate(async()=>{
    await window.FieldModeSession.saveNow();
  });
  await expect(page.locator('#fieldModeSessionStatus')).toContainText('自動保存済み');

  await page.reload();
  await expect(page.locator('#fieldModeResumePanel')).toHaveClass(/active/);
  await expect(page.locator('#fieldModeResumeDetail')).toContainText('smoke.kml');
  await page.locator('#fieldModeResumeButton').click();

  await expect(page.locator('#fieldModeSessionStatus')).toContainText('復元しました');
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('ポケストップ 1');
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();

  await page.locator('#fieldModeUndoButton').click();
  await expect(page.locator('#fieldModeRedoButton')).toBeEnabled();
  await page.locator('#fieldModeRedoButton').click();
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
