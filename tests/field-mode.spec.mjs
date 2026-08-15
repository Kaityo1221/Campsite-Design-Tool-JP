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

async function startCreativeMode(page){
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect(page.locator('body')).toHaveClass(/field-mode-entry-started/);
}

async function openFieldMode(page){
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/field-mode.html');
  await expect(page.locator('#fieldModeEntry')).toBeVisible();
  await expect(page.locator('.field-mode-stage')).toBeHidden();
  await page.locator('#fieldModeFile').setInputFiles({
    name:'smoke.kml',
    mimeType:'application/vnd.google-earth.kml+xml',
    buffer:Buffer.from(sampleKml)
  });
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await startCreativeMode(page);
  await expect(page.locator('.field-mode-stage')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toBeEnabled();
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();
  await expect.poll(()=>page.locator('#fieldModeCreativeHotbar [data-tool="area"]').isEnabled()).toBe(true);
  expect(pageErrors).toEqual([]);
  return pageErrors;
}

async function openPalette(page){
  const hotbar=page.locator('#fieldModeCreativeHotbar');
  if(!(await hotbar.evaluate(el=>el.classList.contains('is-open'))))await page.locator('#fieldModeCreativeButton').click();
  await expect(hotbar).toHaveClass(/is-open/);
}

async function beginNewPoiPlacement(page){
  await openPalette(page);
  const poi=page.locator('#fieldModeCreativeHotbar [data-tool="poi"]');
  await expect(poi).toBeEnabled();
  await poi.click();
  await expect(page.locator('#fieldModeNewPoiButton')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('この位置に設置');
  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();
}

async function createThreePointArea(page){
  await page.locator('#fieldModeCreativeButton').click();
  const areaTool=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect(areaTool).toBeEnabled();
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="line"]')).toBeDisabled();
  await areaTool.click();
  const add=page.locator('[data-area-action="add"]');
  await add.click();
  await page.evaluate(()=>map.panBy([70,0],{animate:false}));
  await add.click();
  await page.evaluate(()=>map.panBy([0,70],{animate:false}));
  await add.click();
  await page.locator('[data-area-action="confirm"]').click();
  await expect(page.locator('#fieldModeSelectionDetail')).toContainText('Polygon');
}

test('新規設置は道具箱で取消でき、パレットは再タップで閉じる',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await beginNewPoiPlacement(page);
  await expect(page.locator('body')).toHaveClass(/field-creative-active/);

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

  await beginNewPoiPlacement(page);
  await page.locator('#fieldModeNewPoiButton').click();

  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  await page.locator('#fieldModeUndoButton').click();
  await expect(page.locator('#fieldModeRedoButton')).toBeEnabled();
  await page.locator('#fieldModeRedoButton').click();
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('範囲ツールは3点以上を置き、最後を最初へ閉じてUndo/Redoできる',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await page.locator('#fieldModeCreativeButton').click();
  const areaTool=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect(areaTool).toBeEnabled();
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="line"]')).toBeDisabled();
  await areaTool.click();

  await expect(page.locator('#fieldModeCrosshair')).toBeVisible();
  await expect(page.locator('#fieldModeAreaActions')).toBeVisible();
  const add=page.locator('[data-area-action="add"]');
  const back=page.locator('[data-area-action="back"]');
  const confirm=page.locator('[data-area-action="confirm"]');
  await expect(confirm).toBeDisabled();

  await add.click();
  await page.evaluate(()=>map.panBy([70,0],{animate:false}));
  await add.click();
  await expect(confirm).toBeDisabled();
  await page.evaluate(()=>map.panBy([0,70],{animate:false}));
  await add.click();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('3点');
  await expect(confirm).toBeEnabled();

  await page.evaluate(()=>map.panBy([-35,0],{animate:false}));
  await add.click();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('4点');
  await back.click();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('3点');
  await confirm.click();

  await expect(page.locator('#fieldModeSelectionDetail')).toContainText('閉じた範囲');
  await expect(page.locator('#fieldModeSelectionDetail')).toContainText('Polygon');
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords().filter(record=>!record.deleted).length)).toBe(1);
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords()[0].points.length)).toBe(3);

  await page.locator('#fieldModeUndoButton').click();
  await expect(page.locator('#fieldModeRedoButton')).toBeEnabled();
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords().filter(record=>!record.deleted).length)).toBe(0);

  await page.locator('#fieldModeRedoButton').click();
  expect(await page.evaluate(()=>window.FieldModeArea.getRecords().filter(record=>!record.deleted).length)).toBe(1);
  expect(pageErrors).toEqual([]);
});

test('確定した活動範囲はリロード後に続きから再開でき、Undoも復元される',async({page})=>{
  const pageErrors=await openFieldMode(page);
  await createThreePointArea(page);
  await expect.poll(()=>page.evaluate(()=>window.FieldModeArea.getRecords().filter(record=>!record.deleted).length)).toBe(1);

  await page.evaluate(async()=>{await window.FieldModeSession.saveNow();});
  await expect(page.locator('#fieldModeSessionStatus')).toContainText('自動保存済み');
  await page.waitForTimeout(250);

  await page.reload();
  await expect(page.locator('#fieldModeResumePanel')).toHaveClass(/active/);
  await page.locator('#fieldModeResumeButton').click();
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled({timeout:5000});
  await startCreativeMode(page);

  await expect.poll(()=>page.evaluate(()=>window.FieldModeArea?.getRecords().filter(record=>!record.deleted).length||0)).toBe(1);
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  await page.locator('#fieldModeUndoButton').click();
  await expect.poll(()=>page.evaluate(()=>window.FieldModeArea.getRecords().filter(record=>!record.deleted).length)).toBe(0);
  await expect(page.locator('#fieldModeRedoButton')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});

test('現地作業はリロード後に続きから再開でき、履歴も復元される',async({page})=>{
  const pageErrors=await openFieldMode(page);

  await beginNewPoiPlacement(page);
  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('ポケストップ 1');
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();

  await page.evaluate(async()=>{await window.FieldModeSession.saveNow();});
  await expect(page.locator('#fieldModeSessionStatus')).toContainText('自動保存済み');

  await page.reload();
  await expect(page.locator('#fieldModeResumePanel')).toHaveClass(/active/);
  await expect(page.locator('#fieldModeResumeDetail')).toContainText('smoke.kml');
  await page.locator('#fieldModeResumeButton').click();
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled({timeout:5000});
  await startCreativeMode(page);

  await expect(page.locator('#fieldModeResumePanel')).not.toHaveClass(/active/);
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText('ポケストップ 1');
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  await expect(page.locator('#fieldModeSessionStatus')).toContainText(/復元しました|自動保存済み/);

  await page.locator('#fieldModeUndoButton').click();
  await expect(page.locator('#fieldModeRedoButton')).toBeEnabled();
  await page.locator('#fieldModeRedoButton').click();
  await expect(page.locator('#fieldModeUndoButton')).toBeEnabled();
  expect(pageErrors).toEqual([]);
});
