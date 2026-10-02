import { test, expect } from '@playwright/test';
import { openLegacyTools } from './helpers/field-creative-v2.mjs';
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
  await expect(page.locator('#fieldModeEntryFileState')).toHaveText('');
  await expect(page.locator('#fieldModeEntryFileName')).toHaveText('kasai-field.kml ✓');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();

  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  await expect(page.locator('body')).toHaveClass(/field-creative-active/);
  await expect(page.locator('.field-mode-stage')).toBeVisible();
  await expect.poll(()=>page.locator('.field-mode-stage').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(500);
  await expect(page.locator('#fieldModeCreativeButton')).toHaveText('＋');
  await expect(page.locator('#fieldModeCreativeButton')).toHaveAttribute('aria-label','候補地を追加');
});

test('START画像を表示してからMap Firstへ正常に引き継ぐ',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));
  await page.goto('/field-mode.html');
  await page.locator('#fieldModeFile').setInputFiles({name:'start-handoff.kml',mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeEntryStart')).toBeEnabled();

  const startedAt=Date.now();
  await page.locator('#fieldModeEntryStart').click();
  await expect(page.locator('#fieldModeEntry')).toHaveClass(/is-starting/);
  const transition=page.locator('.field-mode-entry-transition');
  await expect(transition).toBeVisible();
  await expect.poll(()=>transition.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('creative-mode-start-transition.webp');

  await page.waitForTimeout(500);
  await expect(page.locator('#fieldModeEntry')).toBeVisible();
  await expect(transition).toBeVisible();

  await expect(page.locator('#fieldModeEntry')).toBeHidden({timeout:3000});
  expect(Date.now()-startedAt).toBeGreaterThanOrEqual(1400);
  await expect(page.locator('.field-mode-stage')).toBeVisible();
  await expect(page.locator('#fieldModeCreativeButton')).toHaveText('＋');
  await expect(page.locator('#fieldCreativeCurrentFab')).toBeVisible();
  await expect(page.locator('#fieldModeUndoButton')).toHaveText('← 戻る');
  await expect(page.locator('#fieldModeRedoButton')).toHaveText('↻ やり直し');
  expect(pageErrors).toEqual([]);
});

test('候補地マーカーはオレンジで既存POIと区別する',async({page})=>{
  await page.goto('/field-mode.html');
  await loadAndStart(page);
  const normal=await page.evaluate(()=>{
    resetPoiSelection();
    const record=poiRecords.find(item=>item.added);
    return record?{radius:record.marker.options.radius,color:record.marker.options.color,fillColor:record.marker.options.fillColor,fillOpacity:record.marker.options.fillOpacity,className:record.marker.options.className}:null;
  });
  expect(normal).toEqual({radius:10,color:'#fff',fillColor:'#ff8418',fillOpacity:1,className:'field-poi-v2-candidate'});
  await page.evaluate(()=>poiRecords.find(item=>item.added)?.marker.fire('click'));
  const selected=await page.evaluate(()=>{
    const record=poiRecords.find(item=>item.added);
    return record?{radius:record.marker.options.radius,color:record.marker.options.color,fillColor:record.marker.options.fillColor,fillOpacity:record.marker.options.fillOpacity}:null;
  });
  expect(selected).toEqual({radius:13,color:'#7a3d00',fillColor:'#ff9a2e',fillOpacity:1});
});

test('開始後は現在地FABと戻る・やり直しを維持する',async({page})=>{
  await page.goto('/field-mode.html');
  await loadAndStart(page);
  await expect(page.locator('#fieldModeScanButton')).toBeHidden();
  const current=page.locator('#fieldCreativeCurrentFab');
  await expect(current).toBeVisible();
  await expect(current).toHaveAttribute('aria-label','現在地へ移動');
  await expect(current).toHaveText('◎現在地');
  await expect(current).toBeEnabled();
  await expect(page.locator('#fieldModeUndoButton')).toHaveText('← 戻る');
  await expect(page.locator('#fieldModeUndoButton')).toHaveAttribute('aria-label','戻る');
  await expect(page.locator('#fieldModeRedoButton')).toHaveText('↻ やり直し');
  await expect(page.locator('#fieldModeRedoButton')).toHaveAttribute('aria-label','やり直し');
  await expect(page.locator('#fieldModeNewPoiButton')).toBeHidden();
  await expect(page.locator('#fieldModeScanButton')).toBeEnabled();
  // Supply a deterministic fresh GPS fix on every WebKit platform.
  await page.evaluate(()=>{
    navigator.geolocation.getCurrentPosition=success=>queueMicrotask(()=>success({
      coords:{latitude:35.6812,longitude:139.7671,accuracy:5}
    }));
  });
  await page.evaluate(()=>map.panBy([120,80],{animate:false}));
  expect(await page.evaluate(()=>map.distance(map.getCenter(),currentPosition))).toBeGreaterThan(1);
  await current.click();
  await expect(page.locator('#fieldModeStatus')).toHaveText('SCAN完了');
  await expect.poll(()=>page.evaluate(()=>map.distance(map.getCenter(),currentPosition))).toBeLessThan(1);
});

test('編集時の中央十字は細い1px表示になる',async({page})=>{
  await page.goto('/field-mode.html');
  await loadAndStart(page);
  await openLegacyTools(page);
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
  const mapUi=await boxes(page,['#fieldModeDistanceBadge','#fieldModeCreativeClose','#fieldCreativeCurrentFab','.leaflet-control-attribution']);
  expect(overlaps(mapUi['#fieldModeDistanceBadge'],mapUi['#fieldModeCreativeClose'])).toBe(false);
  expect(overlaps(mapUi['#fieldCreativeCurrentFab'],mapUi['.leaflet-control-attribution'])).toBe(false);
});
