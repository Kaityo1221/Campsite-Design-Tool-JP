import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs=fs.readFileSync('node_modules/leaflet/dist/leaflet.js','utf8');
const leafletCss=fs.readFileSync('node_modules/leaflet/dist/leaflet.css','utf8');
const jszipJs=fs.readFileSync('node_modules/jszip/dist/jszip.min.js','utf8');

const csv='title,lat,lng\n既存地点,35.6812,139.7671\n';

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:leafletJs}));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',route=>route.fulfill({status:200,contentType:'text/css',body:leafletCss}));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:jszipJs}));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/,route=>route.fulfill({status:204,body:''}));
  await page.route(/https:\/\/server\.arcgisonline\.com\/.*/,route=>route.fulfill({status:204,body:''}));
  await page.route(/https:\/\/(?:raw|media)\.githubusercontent\.com\/.*/,route=>route.fulfill({status:204,body:''}));
  await page.route('**/js/ca-access-bootstrap.js*',route=>route.fulfill({
    status:200,
    contentType:'application/javascript',
    body:'window.CampsiteCaAccess=Object.freeze({test:true});'
  }));
});

test('新トップからSTART演出を経て現行Creative Mode地図UIへ入る',async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(error.message));

  await page.goto('/creative/index.html');

  const entry=page.locator('#entry');
  await expect(entry).toBeVisible({timeout:15000});
  await expect(entry.locator('.entry-title')).toHaveText('CREATIVE MODE');
  await expect(entry.locator('.entry-copy')).toHaveText('新しい世界の幕開けへ。');
  const filebar=entry.locator('.filebar');
  const startButton=page.locator('#startButton');
  await expect(filebar.locator('strong')).toHaveText('地図データ（KMZ）を選択');
  await expect(startButton).toHaveText('創作をはじめる');
  await expect(filebar).toHaveCSS('order','1');
  await expect(startButton).toHaveCSS('order','2');
  await expect(startButton).toBeDisabled();
  await expect(entry.locator('.handed')).toBeHidden();
  await expect(page.locator('#labPill')).toBeHidden();

  await expect.poll(()=>entry.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('creative-mode-opening-final.webp');

  await page.locator('#entryFile').setInputFiles({
    name:'creative-entry.csv',
    mimeType:'text/csv',
    buffer:Buffer.from(csv)
  });
  await expect(startButton).toBeEnabled();
  await expect(startButton).toHaveClass(/ready/);

  const startedAt=Date.now();
  await startButton.click();
  await expect(entry).toHaveClass(/cm-v58-starting/);
  const transition=page.locator('#cmV58StartTransition');
  await expect(transition).toBeVisible();
  await expect.poll(()=>transition.evaluate(el=>getComputedStyle(el).backgroundImage)).toContain('creative-mode-start-transition.webp');

  await page.waitForTimeout(500);
  await expect(entry).toBeVisible();

  await expect(entry).toBeHidden({timeout:4000});
  expect(Date.now()-startedAt).toBeGreaterThanOrEqual(1400);

  await expect(page.locator('#back')).toBeVisible();
  await expect(page.locator('#back')).toContainText('戻る');
  await expect(page.locator('#mapToggle')).toBeVisible();
  await expect(page.locator('#mapToggle')).toContainText('地図切り替え');
  await expect(page.locator('#layerButton')).toBeVisible();
  await expect(page.locator('#layerButton')).toContainText('レイヤー');
  await expect(page.locator('#cmStandaloneSaveButton')).toBeVisible();
  await expect(page.locator('#toolbox')).toBeVisible();
  await expect(page.locator('#undo')).toHaveText('← 戻る');
  await expect(page.locator('#redo')).toHaveText('↻ やり直し');
  await expect(page.locator('#cmV45LocateFab')).toBeVisible();

  expect(pageErrors).toEqual([]);
});
