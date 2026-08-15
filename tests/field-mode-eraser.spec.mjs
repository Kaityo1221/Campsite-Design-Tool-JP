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
  await page.locator('#fieldModeFile').setInputFiles({name:'eraser.kml',mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect.poll(()=>page.evaluate(()=>!!window.FieldModeEraser)).toBe(true);
  return pageErrors;
}

async function openEraser(page){
  await page.locator('#fieldModeCreativeButton').click();
  const eraser=page.locator('#fieldModeCreativeHotbar [data-tool="eraser"]');
  await expect(eraser).toBeVisible();
  await expect(eraser).toBeEnabled();
  await eraser.click();
  await expect(page.locator('#fieldModeEraserActions')).toBeVisible();
}

test('共通消しゴムで追加予定POIを選択・削除しUndo/Redoできる',async({page})=>{
  const pageErrors=await openFieldMode(page);
  await openEraser(page);

  await page.evaluate(()=>{
    const record=poiRecords.find(item=>item.added&&!item.fieldDeleted);
    record.marker.fire('click');
  });
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('削除候補');
  await page.locator('[data-eraser-action="delete"]').click();
  expect(await page.evaluate(()=>poiRecords.find(item=>item.added)?.fieldDeleted)).toBe(true);

  await page.locator('#fieldModeUndoButton').click();
  expect(await page.evaluate(()=>poiRecords.find(item=>item.added)?.fieldDeleted)).toBe(false);
  await page.locator('#fieldModeRedoButton').click();
  expect(await page.evaluate(()=>poiRecords.find(item=>item.added)?.fieldDeleted)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('共通消しゴムで現地作成した活動範囲を削除しUndo/Redoできる',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await page.locator('#fieldModeCreativeButton').click();
  const area=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect(area).toBeEnabled();
  await area.click();
  const add=page.locator('[data-area-action="add"]');
  await add.click();
  await page.evaluate(()=>map.panBy([70,0],{animate:false}));
  await add.click();
  await page.evaluate(()=>map.panBy([0,70],{animate:false}));
  await add.click();
  await page.locator('[data-area-action="confirm"]').click();
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords().filter(record=>!record.deleted).length)).toBe(1);

  await openEraser(page);
  await page.evaluate(()=>window.FieldModeArea.getRecords().find(record=>!record.deleted).layer.fire('click'));
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('削除候補');
  await page.locator('[data-eraser-action="delete"]').click();
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords()[0].deleted)).toBe(true);

  await page.locator('#fieldModeUndoButton').click();
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords()[0].deleted)).toBe(false);
  await page.locator('#fieldModeRedoButton').click();
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords()[0].deleted)).toBe(true);
  expect(pageErrors).toEqual([]);
});
