import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const sourceKml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Folder><name>既存のポケストップ</name><Placemark><name>既存地点</name><Point><coordinates>139.7666,35.6810,0</coordinates></Point></Placemark></Folder>
<Folder><name>既存のジム</name></Folder>
<Folder><name>既存のパワースポット</name></Folder>
<Folder><name>追加希望ポケスト</name></Folder>
<Folder><name>追加希望ジム</name></Folder>
<Folder><name>追加希望パワスポ</name></Folder>
<Folder><name>活動範囲</name></Folder>
<Folder><name>40m円（基本距離）</name></Folder>
<Folder><name>30m円（調整用）</name></Folder>
</Document></kml>`;

test.beforeEach(async({page})=>{
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
});

async function openFieldMode(page){
  await page.goto('/field-mode.html');
  await page.locator('#fieldModeFile').setInputFiles({
    name:'formal-source.kml',
    mimeType:'application/vnd.google-earth.kml+xml',
    buffer:Buffer.from(sourceKml)
  });
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeNewPoiButton')).toBeEnabled();
  await expect(page.locator('#fieldPoiTypeButton')).toBeVisible();
}

async function addCurrentTypePoi(page){
  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('この位置に設置');
  await page.locator('#fieldModeNewPoiButton').click();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('新規設置');
  await expect(page.locator('#fieldPoi30mToggle')).toBeVisible();
}

async function addAllThreeTypes(page){
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoiTypeButton').click();
  await expect(page.locator('#fieldPoiTypeButton')).toContainText('ジム');
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoiTypeButton').click();
  await expect(page.locator('#fieldPoiTypeButton')).toContainText('パワースポット');
  await addCurrentTypePoi(page);
}

async function downloadedKml(page){
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#fieldModeSaveButton').click();
  const download=await downloadPromise;
  const downloadPath=await download.path();
  const zip=await JSZip.loadAsync(fs.readFileSync(downloadPath));
  const doc=zip.file('doc.kml');
  expect(doc).not.toBeNull();
  return doc.async('string');
}

function folderBody(kmlText,folderName){
  const escaped=folderName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=kmlText.match(new RegExp(`<Folder>\\s*<name>${escaped}<\\/name>([\\s\\S]*?)<\\/Folder>`));
  return match?.[1]||'';
}

function folderPointNames(kmlText,folderName){
  return [...folderBody(kmlText,folderName).matchAll(/<Placemark>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<Point>/g)].map(item=>item[1]);
}

function folderPlacemarkNames(kmlText,folderName){
  return [...folderBody(kmlText,folderName).matchAll(/<Placemark>[\s\S]*?<name>([^<]+)<\/name>/g)].map(item=>item[1]);
}

test('通常保存は新規POIを種類ごとの正式レイヤーへ振り分け、40m円だけを基本出力する',async({page})=>{
  await openFieldMode(page);
  await addAllThreeTypes(page);

  const kml=await downloadedKml(page);
  expect(folderPointNames(kml,'追加希望ポケスト')).toContain('ポケストップ 1');
  expect(folderPointNames(kml,'追加希望ジム')).toContain('ジム 1');
  expect(folderPointNames(kml,'追加希望パワスポ')).toContain('パワースポット 1');
  expect(folderPlacemarkNames(kml,'40m円（基本距離）')).toEqual(expect.arrayContaining([
    'ポケストップ 1_40m円','ジム 1_40m円','パワースポット 1_40m円'
  ]));
  expect(folderPlacemarkNames(kml,'30m円（調整用）')).toEqual([]);
  expect(kml).not.toContain('<name>追加希望POI</name>');
});

test('30m調整円はONにした新規POIだけ出力する',async({page})=>{
  await openFieldMode(page);
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoi30mToggle').click();
  await expect(page.locator('#fieldPoi30mToggle')).toContainText('追加する');

  await page.locator('#fieldPoiTypeButton').click();
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoiTypeButton').click();
  await addCurrentTypePoi(page);

  const kml=await downloadedKml(page);
  expect(folderPlacemarkNames(kml,'30m円（調整用）')).toEqual(['ポケストップ 1_30m円']);
  expect(folderPlacemarkNames(kml,'40m円（基本距離）')).toEqual(expect.arrayContaining([
    'ポケストップ 1_40m円','ジム 1_40m円','パワースポット 1_40m円'
  ]));
});

test('30m調整円の選択は同じ端末の作業復元後も残る',async({page})=>{
  await openFieldMode(page);
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoi30mToggle').click();
  await expect(page.locator('#fieldPoi30mToggle')).toContainText('追加する');
  await page.evaluate(()=>window.FieldModeCircleOptions.saveNow());
  await expect(page.locator('#fieldModeSessionStatus')).toContainText('自動保存済み',{timeout:5000});

  await page.reload();
  await expect(page.locator('#fieldModeResumePanel')).toHaveClass(/active/,{timeout:5000});
  await page.locator('#fieldModeResumeButton').click();
  await expect.poll(()=>page.evaluate(()=>{
    const restored=poiRecords.find(record=>record?.isNew&&!record.fieldDeleted);
    return restored?.include30mCircle===true;
  }),{timeout:8000}).toBe(true);
});

test('活動範囲込み保存でも正式POIレイヤーと30m選択を維持する',async({page})=>{
  await openFieldMode(page);
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoi30mToggle').click();
  await page.locator('#fieldPoiTypeButton').click();
  await addCurrentTypePoi(page);
  await page.locator('#fieldPoiTypeButton').click();
  await addCurrentTypePoi(page);

  await page.locator('#fieldModeCreativeButton').click();
  const areaTool=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect(areaTool).toBeEnabled();
  await areaTool.click();
  const add=page.locator('[data-area-action="add"]');
  await add.click();
  await page.evaluate(()=>map.panBy([60,0],{animate:false}));
  await add.click();
  await page.evaluate(()=>map.panBy([0,60],{animate:false}));
  await add.click();
  await page.locator('[data-area-action="confirm"]').click();

  const kml=await downloadedKml(page);
  expect(folderPointNames(kml,'追加希望ポケスト')).toContain('ポケストップ 1');
  expect(folderPointNames(kml,'追加希望ジム')).toContain('ジム 1');
  expect(folderPointNames(kml,'追加希望パワスポ')).toContain('パワースポット 1');
  expect(folderPlacemarkNames(kml,'30m円（調整用）')).toEqual(['ポケストップ 1_30m円']);
  expect(kml).toContain('<name>活動範囲 1</name>');
  expect(kml).not.toContain('<name>追加希望POI</name>');
});
