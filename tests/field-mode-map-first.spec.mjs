import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const sampleKml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Folder><name>既存のポケストップ</name><Placemark><name>既存地点</name><Point><coordinates>139.7666,35.6810,0</coordinates></Point></Placemark></Folder>
<Folder><name>追加希望ポケスト</name><Placemark><name>追加候補A</name><Point><coordinates>139.7677,35.6815,0</coordinates></Point></Placemark></Folder>
</Document></kml>`;

function overlaps(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
async function boxes(page,selectors){return Object.fromEntries(await Promise.all(selectors.map(async selector=>[selector,await page.locator(selector).evaluate(element=>{const rect=element.getBoundingClientRect();return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};})])));}
async function loadAndStart(page,name='kasai-field.kml'){
  await page.locator('#fieldModeFile').setInputFiles({name,mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();
  await expect(page.locator('#fieldModeEntryStart')).toHaveClass(/is-ready/);
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect(page.locator('body')).toHaveClass(/field-mode-entry-started/);
}

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
});

test('初期表示はCREATIVE MODEトップで、読込後に明示開始する',async({page})=>{
  await page.goto('/field-mode.html');
  await expect(page.locator('#fieldModeEntry')).toBeVisible();
  await expect(page.locator('#fieldModeEntry')).toContainText('CREATIVE MODE');
  await expect(page.locator('#fieldModeEntry')).toContainText('新しい世界の幕開けへ。');
  await expect(page.locator('#fieldModeEntryStart')).toBeDisabled();
  await expect(page.locator('.field-mode-stage')).toBeHidden();

  await page.locator('#fieldModeFile').setInputFiles({name:'kasai-field.kml',mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryFileState')).toContainText('読み込み完了：kasai-field.kml');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();

  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect(page.locator('body')).toHaveClass(/field-creative-active/);
  await expect(page.locator('.field-mode-stage')).toBeVisible();
  await expect.poll(()=>page.locator('.field-mode-stage').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(500);
  await expect(page.locator('#fieldModeCreativeButton')).toContainText('道具');
});

test('開始後は現在地再取得と元に戻す・やり直すを維持する',async({page})=>{
  await page.goto('/field-mode.html');
  await loadAndStart(page);
  await expect(page.locator('#fieldModeScanButton')).toBeHidden();
  await expect(page.locator('#fieldModeLocationBadge')).toHaveAttribute('role','button');
  await expect(page.locator('#fieldModeUndoButton')).toHaveText('↶ 元に戻す');
  await expect(page.locator('#fieldModeRedoButton')).toHaveText('やり直す ↷');
  await expect(page.locator('#fieldModeNewPoiButton')).toBeHidden();
});

test('編集時の中央十字は細い1px表示になる',async({page})=>{
  await page.goto('/field-mode.html');
  await loadAndStart(page);
  await page.locator('#fieldModeCreativeButton').click();
  const area=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect.poll(()=>area.isEnabled()).toBe(true);
  await area.click();
  const crosshair=page.locator('#fieldModeCrosshair');
  await expect(crosshair).toBeVisible();
  const metrics=await crosshair.evaluate(el=>({width:getComputedStyle(el).width,height:getComputedStyle(el).height,beforeWidth:getComputedStyle(el,'::before').width,beforeHeight:getComputedStyle(el,'::before').height,afterWidth:getComputedStyle(el,'::after').width,afterHeight:getComputedStyle(el,'::after').height,dot:getComputedStyle(el.querySelector('.field-crosshair-dot')).display}));
  expect(metrics).toEqual({width:'22px',height:'22px',beforeWidth:'1px',beforeHeight:'18px',afterWidth:'18px',afterHeight:'1px',dot:'none'});
});

test('320x568でもトップと主要操作が重ならない',async({page})=>{
  await page.setViewportSize({width:320,height:568});
  await page.goto('/field-mode.html');
  await expect(page.locator('#fieldModeEntryStart')).toBeVisible();
  await loadAndStart(page,'narrow-field.kml');
  await page.locator('#fieldModeDistanceBadge').evaluate(element=>{element.innerHTML='⚠ 50m未満<br>既存POI 12.3m';});
  const mapUi=await boxes(page,['#fieldModeDistanceBadge','#fieldModeCreativeClose','#fieldModeLocationBadge','.leaflet-control-attribution']);
  expect(overlaps(mapUi['#fieldModeDistanceBadge'],mapUi['#fieldModeCreativeClose'])).toBe(false);
  expect(overlaps(mapUi['#fieldModeLocationBadge'],mapUi['.leaflet-control-attribution'])).toBe(false);
});
