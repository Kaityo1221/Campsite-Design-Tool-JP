import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const under50Kml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Folder><name>既存のポケストップ</name><Placemark><name>公園入口</name><Point><coordinates>139.7666000,35.6810000,0</coordinates></Point></Placemark></Folder>
<Folder><name>追加希望ポケスト</name><Placemark><name>芝生広場北側</name><Point><coordinates>139.7669000,35.6810000,0</coordinates></Point></Placemark></Folder>
</Document></kml>`;

const existingOnlyKml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Folder><name>既存のポケストップ</name><Placemark><name>公園入口</name><Point><coordinates>139.7666000,35.6810000,0</coordinates></Point></Placemark></Folder>
</Document></kml>`;

async function openField(page,kml=under50Kml,name='apac-v4.kml'){
  await page.goto('/field-mode.html');
  await expect.poll(()=>page.evaluate(()=>!!window.FieldModeApacV4),{timeout:10000}).toBe(true);
  await page.locator('#fieldModeFile').setInputFiles({name,mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(kml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect.poll(()=>page.evaluate(()=>window.FieldModeApacV4?.additionalCount?.()>=0)).toBe(true);
}

async function openSelection(page){
  await page.evaluate(()=>window.FieldCreative?.exit?.({cancel:false}));
  await expect(page.locator('.field-mode-selection')).toBeVisible();
}

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
});

test('Ver4用語・50m基本ルール・位置変更後の但し書き再評価を維持する',async({page})=>{
  await openField(page);

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="poi"]')).toContainText('ゲームスポット');
  await expect(page.locator('.field-circle-options-note')).toContainText('50mが基本ルール');
  await expect(page.locator('.field-circle-options-note')).toContainText('例外確認用');
  await expect(page.locator('.field-circle-options-note')).toContainText('通常承認基準ではありません');
  await expect(page.locator('#fieldApacCount')).toHaveText('1 / 25');
  await expect(page.locator('#fieldApacUnder50')).toHaveText('1');

  await openSelection(page);
  await page.evaluate(()=>{
    const record=poiRecords.find(item=>item.added&&!item.fieldDeleted);
    selectAddedPoi(record);
  });
  await expect(page.locator('#fieldModeExceptionPanel')).toBeVisible();
  await expect(page.locator('#fieldExceptionCopy')).toContainText('自動的に設置不可・不合格とは判定しません');
  await expect(page.locator('#fieldExceptionList')).toContainText('既存ゲームスポット');

  await page.locator('#fieldModeExceptionReason').fill('園内の歩行導線と安全性を考慮し、この位置を選定しました。');
  await page.locator('#fieldModeExceptionConfirm').click();
  await expect(page.locator('#fieldModeExceptionReview')).toContainText('確認済み');
  await expect.poll(()=>page.evaluate(()=>window.FieldModeApacV4.reviewNeededCount())).toBe(0);

  await page.evaluate(()=>{
    const record=poiRecords.find(item=>item.added&&!item.fieldDeleted);
    applyMove(record,[35.6822,139.7682]);
  });
  await expect.poll(()=>page.evaluate(()=>window.FieldModeApacV4.under50Count())).toBe(0);
  await expect(page.locator('#fieldModeExceptionPanel')).toContainText('最終TXTには出力しません');

  await page.evaluate(()=>{
    const record=poiRecords.find(item=>item.added&&!item.fieldDeleted);
    applyMove(record,[35.6810,139.76682]);
  });
  await expect.poll(()=>page.evaluate(()=>window.FieldModeApacV4.reviewNeededCount())).toBe(1);
  await expect(page.locator('#fieldModeExceptionReview')).toContainText('再確認してください');
});

test('追加ゲームスポットは3種類合計25個で26個目を止める',async({page})=>{
  await openField(page,existingOnlyKml,'limit-25.kml');
  await page.evaluate(()=>{
    setCurrentPosition(35.6810,139.7666,5,false);
    for(let i=0;i<25;i+=1){
      const lat=35.6900+i*0.001;
      const lng=139.7800+i*0.001;
      poiRecords.push({
        name:`追加ゲームスポット ${i+1}`,
        folder:i%3===0?'追加希望ポケスト':i%3===1?'追加希望ジム':'追加希望パワスポ',
        poiType:i%3===0?'pokestop':i%3===1?'gym':'power_spot',
        latlng:[lat,lng],originalLatlng:[lat,lng],added:true,isNew:true,fieldDeleted:false,
        rangeCircle:null,marker:null
      });
    }
    window.FieldModeApacV4.recompute();
  });
  await expect(page.locator('#fieldApacCount')).toHaveText('25 / 25');
  await page.locator('#fieldModeNewPoiButton').evaluate(button=>button.click());
  await expect(page.locator('#fieldModeStatus')).toHaveText('追加ゲームスポットは最大25個までです');
  await expect.poll(()=>page.evaluate(()=>window.FieldModeApacV4.additionalCount())).toBe(25);
});

test('50m未満がある場合は同一チェックIDの完成KMZ＋但し書きTXTを一括生成する',async({page})=>{
  await openField(page);
  await openSelection(page);
  await page.locator('#fieldApacCampsiteName').fill('APACテスト公園');
  await page.evaluate(()=>{
    const record=poiRecords.find(item=>item.added&&!item.fieldDeleted);
    selectAddedPoi(record);
  });
  await page.locator('#fieldModeExceptionReason').fill('園内の歩行導線と安全性を考慮し、この位置を選定しました。');
  await page.locator('#fieldModeExceptionConfirm').click();
  await expect.poll(()=>page.evaluate(()=>window.FieldModeApacV4.reviewNeededCount())).toBe(0);

  const downloadPromise=page.waitForEvent('download');
  await page.locator('#fieldModeSaveButton').click();
  const download=await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/APACテスト公園_提出用設計データ_CM-.*\.zip$/);
  const path=await download.path();
  const outer=await JSZip.loadAsync(fs.readFileSync(path));
  const names=Object.keys(outer.files);
  const kmzName=names.find(name=>name.endsWith('.kmz'));
  const txtName=names.find(name=>name.endsWith('.txt'));
  expect(kmzName).toBeTruthy();
  expect(txtName).toBeTruthy();

  const kmzId=kmzName.match(/(CM-\d{8}-\d{6}-[A-Z0-9]+)/)?.[1];
  const txtId=txtName.match(/(CM-\d{8}-\d{6}-[A-Z0-9]+)/)?.[1];
  expect(kmzId).toBeTruthy();
  expect(txtId).toBe(kmzId);

  const txt=await outer.file(txtName).async('string');
  expect(txt).toContain('キャンプサイト名: APACテスト公園');
  expect(txt).toContain(`チェックID: ${kmzId}`);
  expect(txt).toContain('芝生広場北側');
  expect(txt).toContain('公園入口 / 既存ゲームスポット / ポケストップ');
  expect(txt).toContain('園内の歩行導線と安全性を考慮し、この位置を選定しました。');
  expect(txt).toContain('フォーム貼り付け用');

  const nestedKmz=await outer.file(kmzName).async('nodebuffer');
  const kmz=await JSZip.loadAsync(nestedKmz);
  expect(kmz.file('doc.kml')).not.toBeNull();
});

test('閲覧中は種類操作を隠し、集中配置時だけ表示して主要操作を重ねない',async({page})=>{
  await openField(page,existingOnlyKml,'layout-focus.kml');
  await page.evaluate(()=>setCurrentPosition(35.6812,139.7671,5,false));

  await expect(page.locator('#fieldPoiTypeButton')).toBeHidden();
  await expect(page.locator('#fieldModeNewPoiButton')).toBeHidden();

  const clearLayout=await page.evaluate(()=>{
    const zoom=document.querySelector('.leaflet-control-zoom')?.getBoundingClientRect();
    const toolbox=document.getElementById('fieldModeCreativeButton')?.getBoundingClientRect();
    const location=document.getElementById('fieldModeLocationBadge')?.getBoundingClientRect();
    const toolbar=document.querySelector('.field-mode-toolbar')?.getBoundingClientRect();
    return {
      toolboxBelowZoom:!!zoom&&!!toolbox&&toolbox.top>=zoom.bottom+8,
      locationAboveToolbar:!!location&&!!toolbar&&location.bottom<=toolbar.top-8
    };
  });
  expect(clearLayout.toolboxBelowZoom).toBe(true);
  expect(clearLayout.locationAboveToolbar).toBe(true);

  await page.locator('#fieldModeCreativeButton').click();
  const poiTool=page.locator('#fieldModeCreativeHotbar [data-tool="poi"]');
  await expect(poiTool).toBeVisible();
  await poiTool.click();

  await expect(page.locator('#fieldPoiTypeButton')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toBeVisible();
  await expect(page.locator('#fieldModeNewPoiButton')).toContainText('この位置に設置');
});