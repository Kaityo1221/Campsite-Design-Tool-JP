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
<Folder><name>50m円（目安）</name></Folder>
<Folder><name>40m円（参考距離）</name></Folder>
<Folder><name>30m円（参考距離）</name></Folder>
</Document></kml>`;

const legacyCircleSourceKml=sourceKml
  .replace('50m円（目安）','50m円（基本距離）')
  .replace('40m円（参考距離）','40m円（基本距離）')
  .replace('30m円（参考距離）','30m円（調整用）');

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
}

async function openFieldMode(page,kml=sourceKml){
  await page.goto('/field-mode.html');
  await page.locator('#fieldModeFile').setInputFiles({
    name:'formal-source.kml',
    mimeType:'application/vnd.google-earth.kml+xml',
    buffer:Buffer.from(kml)
  });
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await startCreativeMode(page);
  await expect(page.locator('#fieldModeNewPoiButton')).toBeHidden();
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();
}

async function openPalette(page){
  const hotbar=page.locator('#fieldModeCreativeHotbar');
  if(!(await hotbar.evaluate(el=>el.classList.contains('is-open'))))await page.locator('#fieldModeCreativeButton').click();
  await expect(hotbar).toHaveClass(/is-open/);
}

async function selectPoiType(page,typeLabel){
  const typeButton=page.locator('#fieldPoiTypeButton');
  await expect(typeButton).toBeVisible();
  for(let i=0;i<3;i+=1){
    if((await typeButton.textContent())?.includes(typeLabel))break;
    await typeButton.click();
  }
  await expect(typeButton).toContainText(typeLabel);
}

async function addCurrentTypePoi(page,typeLabel='ポケストップ'){
  await openPalette(page);
  const poi=page.locator('#fieldModeCreativeHotbar [data-tool="poi"]');
  await expect(poi).toBeEnabled();
  await poi.click();
  await selectPoiType(page,typeLabel);
  const confirm=page.locator('#fieldModeNewPoiButton');
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('この位置に設置');
  await confirm.click();
  await expect(confirm).toBeHidden();
  await expect(page.locator('#fieldModeSelectionTitle')).toContainText(`${typeLabel} 1`);
  await expect(page.locator('#fieldPoi40mToggle')).toBeVisible();
  await expect(page.locator('#fieldPoi30mToggle')).toBeVisible();
}

async function addAllThreeTypes(page){
  await addCurrentTypePoi(page,'ポケストップ');
  await addCurrentTypePoi(page,'ジム');
  await addCurrentTypePoi(page,'パワースポット');
}

async function downloadedKml(page){
  page.on('dialog',dialog=>dialog.accept());
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#fieldModeSaveButton').click();
  const download=await downloadPromise;
  const downloadPath=await download.path();
  const downloaded=await JSZip.loadAsync(fs.readFileSync(downloadPath));
  let kmz=downloaded;
  let doc=kmz.file('doc.kml');
  if(!doc){
    const nestedName=Object.keys(downloaded.files).find(name=>name.toLowerCase().endsWith('.kmz'));
    expect(nestedName,'APAC提出用ZIP内に完成KMZがありません').toBeTruthy();
    const nestedBytes=await downloaded.file(nestedName).async('nodebuffer');
    kmz=await JSZip.loadAsync(nestedBytes);
    doc=kmz.file('doc.kml');
  }
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

test('通常保存は新規POIを種類ごとの正式レイヤーへ振り分け、50m円を必須出力する',async({page})=>{
  await openFieldMode(page);
  await addAllThreeTypes(page);

  const kml=await downloadedKml(page);
  expect(folderPointNames(kml,'追加希望ポケスト')).toContain('ポケストップ 1');
  expect(folderPointNames(kml,'追加希望ジム')).toContain('ジム 1');
  expect(folderPointNames(kml,'追加希望パワスポ')).toContain('パワースポット 1');
  expect(folderPlacemarkNames(kml,'50m円（目安）')).toEqual(expect.arrayContaining([
    '既存地点_50m円','ポケストップ 1_50m円','ジム 1_50m円','パワースポット 1_50m円'
  ]));
  expect(folderPlacemarkNames(kml,'40m円（参考距離）')).toEqual([]);
  expect(folderPlacemarkNames(kml,'30m円（参考距離）')).toEqual([]);
  expect(kml).not.toContain('<name>追加希望POI</name>');
});

test('30m・40m参考円はONにした新規POIだけ出力する',async({page})=>{
  await openFieldMode(page);
  await addCurrentTypePoi(page,'ポケストップ');
  await page.locator('#fieldPoi40mToggle').click();
  await expect(page.locator('#fieldPoi40mToggle')).toContainText('追加する');
  await page.locator('#fieldPoi30mToggle').click();
  await expect(page.locator('#fieldPoi30mToggle')).toContainText('追加する');

  await addCurrentTypePoi(page,'ジム');
  await addCurrentTypePoi(page,'パワースポット');

  const kml=await downloadedKml(page);
  expect(folderPlacemarkNames(kml,'30m円（参考距離）')).toEqual(['ポケストップ 1_30m円']);
  expect(folderPlacemarkNames(kml,'40m円（参考距離）')).toEqual(['ポケストップ 1_40m円']);
  expect(folderPlacemarkNames(kml,'50m円（目安）')).toEqual(expect.arrayContaining([
    '既存地点_50m円','ポケストップ 1_50m円','ジム 1_50m円','パワースポット 1_50m円'
  ]));
});

test('旧距離円レイヤーは完成KMZで50m目安・30m/40m参考へ正規化する',async({page})=>{
  await openFieldMode(page,legacyCircleSourceKml);
  await addCurrentTypePoi(page,'ポケストップ');
  const kml=await downloadedKml(page);

  expect(kml).toContain('<name>50m円（目安）</name>');
  expect(kml).toContain('<name>40m円（参考距離）</name>');
  expect(kml).toContain('<name>30m円（参考距離）</name>');
  expect(kml).not.toContain('<name>50m円（基本距離）</name>');
  expect(kml).not.toContain('<name>40m円（基本距離）</name>');
  expect(kml).not.toContain('<name>30m円（調整用）</name>');
  expect(folderPlacemarkNames(kml,'50m円（目安）')).toEqual(expect.arrayContaining([
    '既存地点_50m円','ポケストップ 1_50m円'
  ]));
});

test('30m・40m参考円の選択は同じ端末の作業復元後も残る',async({page})=>{
  await openFieldMode(page);
  await addCurrentTypePoi(page,'ポケストップ');
  await page.locator('#fieldPoi40mToggle').click();
  await expect(page.locator('#fieldPoi40mToggle')).toContainText('追加する');
  await page.locator('#fieldPoi30mToggle').click();
  await expect(page.locator('#fieldPoi30mToggle')).toContainText('追加する');
  await page.evaluate(()=>window.FieldModeCircleOptions.saveNow());
  await expect(page.locator('#fieldModeSessionStatus')).toContainText('自動保存済み',{timeout:5000});

  await page.reload();
  await expect(page.locator('#fieldModeResumePanel')).toHaveClass(/active/,{timeout:5000});
  await page.locator('#fieldModeResumeButton').click();
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled({timeout:5000});
  await startCreativeMode(page);
  await expect.poll(()=>page.evaluate(()=>{
    const restored=poiRecords.find(record=>record?.isNew&&!record.fieldDeleted);
    return restored?.include30mCircle===true&&restored?.include40mCircle===true;
  }),{timeout:8000}).toBe(true);
});

test('活動範囲込み保存でも正式POIレイヤーと参考円選択を維持する',async({page})=>{
  await openFieldMode(page);
  await addCurrentTypePoi(page,'ポケストップ');
  await page.locator('#fieldPoi40mToggle').click();
  await page.locator('#fieldPoi30mToggle').click();
  await addCurrentTypePoi(page,'ジム');
  await addCurrentTypePoi(page,'パワースポット');

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
  expect(folderPlacemarkNames(kml,'50m円（目安）')).toEqual(expect.arrayContaining(['既存地点_50m円','ポケストップ 1_50m円','ジム 1_50m円','パワースポット 1_50m円']));
  expect(folderPlacemarkNames(kml,'40m円（参考距離）')).toEqual(['ポケストップ 1_40m円']);
  expect(folderPlacemarkNames(kml,'30m円（参考距離）')).toEqual(['ポケストップ 1_30m円']);
  expect(kml).toContain('<name>活動範囲 1</name>');
  expect(kml).not.toContain('<name>追加希望POI</name>');
});
