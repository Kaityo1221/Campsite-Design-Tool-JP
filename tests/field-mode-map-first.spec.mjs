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

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
});

test('読込後は通常画面がMap Firstになり、必要時だけデータ欄を開ける',async({page})=>{
  await page.goto('/field-mode.html');
  await page.locator('#fieldModeFile').setInputFiles({name:'kasai-field.kml',mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('body')).toHaveClass(/field-mode-ready/);

  await expect(page.locator('.field-mode-source-bar')).toBeVisible();
  await expect(page.locator('#fieldModeSourceName')).toContainText('kasai-field.kml');
  await expect(page.locator('.field-mode-intro > label')).toBeHidden();

  await expect.poll(()=>page.locator('.field-mode-stage').evaluate(el=>el.getBoundingClientRect().height)).toBeGreaterThan(500);

  await expect(page.locator('#fieldModeCreativeButton')).toContainText('道具');
  await page.locator('#fieldModeCreativeButton').click();
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="line"]')).toBeHidden();
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="area"]')).toBeVisible();
  await expect(page.locator('#fieldModeCreativeHotbar [data-tool="distance"]')).toBeVisible();

  await page.locator('#fieldModeCreativeClose').click();
  await page.locator('#fieldModeSourceToggle').click();
  await expect(page.locator('body')).toHaveClass(/field-mode-source-open/);
  await expect(page.locator('.field-mode-intro > label')).toBeVisible();
  await expect(page.locator('#fieldModeSourceToggle')).toHaveText('閉じる');

  await page.locator('#fieldModeSourceToggle').click();
  await expect(page.locator('.field-mode-intro > label')).toBeHidden();
});

test('編集時の中央十字は細い1px表示になる',async({page})=>{
  await page.goto('/field-mode.html');
  await page.locator('#fieldModeFile').setInputFiles({name:'kasai-field.kml',mimeType:'application/vnd.google-earth.kml+xml',buffer:Buffer.from(sampleKml)});
  await expect(page.locator('#fieldModeFileStatus')).toContainText('件を読み込み');
  await expect(page.locator('#fieldModeCreativeButton')).toBeEnabled();

  await page.locator('#fieldModeCreativeButton').click();
  const area=page.locator('#fieldModeCreativeHotbar [data-tool="area"]');
  await expect.poll(()=>area.isEnabled()).toBe(true);
  await area.click();
  const crosshair=page.locator('#fieldModeCrosshair');
  await expect(crosshair).toBeVisible();

  const metrics=await crosshair.evaluate(el=>({
    width:getComputedStyle(el).width,
    height:getComputedStyle(el).height,
    beforeWidth:getComputedStyle(el,'::before').width,
    beforeHeight:getComputedStyle(el,'::before').height,
    afterWidth:getComputedStyle(el,'::after').width,
    afterHeight:getComputedStyle(el,'::after').height,
    dot:getComputedStyle(el.querySelector('.field-crosshair-dot')).display
  }));
  expect(metrics).toEqual({width:'22px',height:'22px',beforeWidth:'1px',beforeHeight:'18px',afterWidth:'18px',afterHeight:'1px',dot:'none'});
});
