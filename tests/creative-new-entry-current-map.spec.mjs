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
  await expect(page.locator('#resumeButton')).toBeHidden();
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
  await page.locator('#cmStandaloneSaveButton').click();
  const saveMenu=page.locator('#cmStandaloneSaveMenu');
  await expect(saveMenu).toBeVisible();
  await expect(saveMenu.locator('#cmStandaloneWorkspaceSave')).toHaveCount(0);
  await expect(saveMenu.locator('#cmStandaloneKmz')).toHaveText('KMZで出力');
  await expect(saveMenu.locator('#cmStandaloneCoords')).toHaveText('座標一覧（Googleフォーム用）');
  await expect(saveMenu.locator('#cmStandaloneClose')).toHaveText('×');
  await saveMenu.locator('#cmStandaloneCoords').click();
  const coordView=page.locator('.cm-coords');
  await expect(coordView).toBeVisible();
  await expect(coordView.locator('.cm-view-head')).toContainText('座標一覧（Googleフォーム用）');
  await coordView.locator('.cm-view-head button').click();
  await expect(coordView).toHaveCount(0);
  await expect(page.locator('#cmStandaloneSaveMenu')).toHaveCount(0);
  const helpButton=page.locator('#cmV59HelpButton');
  await expect(helpButton).toBeVisible();
  await expect(helpButton).toHaveText('?');
  await expect(helpButton).toHaveAttribute('aria-label','設計ルール');
  const saveBox=await page.locator('#cmStandaloneSaveButton').boundingBox();
  const helpBox=await helpButton.boundingBox();
  expect(saveBox).not.toBeNull();
  expect(helpBox).not.toBeNull();
  expect(Math.round(helpBox.x-saveBox.x)).toBe(0);
  expect(Math.round(saveBox.y-(helpBox.y+helpBox.height))).toBe(8);
  const rulesPanel=page.locator('#cmV60RulesPanel');
  await expect(rulesPanel).toBeHidden();
  await helpButton.click();
  await expect(rulesPanel).toBeVisible();
  await expect(helpButton).toBeHidden();
  await expect(rulesPanel.locator('.cm-v60-card')).toHaveCount(3);
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('キャンプサイトに置けるゲームスポット');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('25個');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('ポケストップ');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('12');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('ジム');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('8');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('パワースポット');
  await expect(rulesPanel.locator('[data-card="1"]')).toContainText('5');
  await expect(rulesPanel.locator('[data-card="2"]')).toContainText('POI間隔は原則50m');
  await expect(rulesPanel.locator('[data-card="2"]')).toContainText('30m / 40mは参考距離');
  await expect(rulesPanel.locator('[data-card="2"]')).toContainText('50m未満だから自動的に不合格ではない');
  await expect(rulesPanel.locator('[data-card="2"]')).toContainText('ここに設置したい理由を書く');
  await expect(rulesPanel.locator('[data-card="3"]')).toContainText('完成時はKMZとして保存');
  await expect(rulesPanel.locator('[data-card="3"] b br')).toHaveCount(1);
  const dots=rulesPanel.locator('#cmV60RulesDots button');
  await expect(dots).toHaveCount(3);
  await dots.nth(1).click();
  await expect(dots.nth(1)).toHaveClass(/is-active/);
  await expect(dots.nth(1)).toHaveAttribute('aria-current','true');
  await rulesPanel.locator('#cmV60RulesClose').click();
  await expect(rulesPanel).toBeHidden();
  await expect(helpButton).toBeVisible();
  await expect(page.locator('#toolbox')).toBeVisible();
  await page.locator('#toolbox').click();
  const toolMenu=page.locator('#toolMenu');
  await expect(toolMenu).toHaveClass(/open/);
  const activityRangeTool=toolMenu.locator('[data-tool="polygon"]');
  await expect(activityRangeTool).toHaveText('活動範囲');
  await expect(toolMenu.locator('[data-tool="ruler"]')).toHaveText('物差し');
  await activityRangeTool.click();
  await expect(page.locator('#status')).toContainText('追加する活動範囲を描いてください');
  const activityRangeCancel=page.getByRole('button',{name:'×',exact:true});
  await expect(activityRangeCancel).toBeVisible();
  await activityRangeCancel.click();
  await expect(page.locator('#status')).toContainText('活動範囲の作成をキャンセルしました');
  await expect(page.locator('#undo')).toHaveText('← 戻る');
  await expect(page.locator('#redo')).toHaveText('↻ やり直し');
  await expect(page.locator('#cmV45LocateFab')).toHaveCount(0);
  await expect(page.locator('#locate')).toBeHidden();

  await page.locator('#back').click();
  await expect(entry).toBeVisible();
  await expect(startButton).toBeEnabled();
  await expect(startButton).toHaveClass(/ready/);

  await startButton.click();
  await expect(entry).toHaveClass(/cm-v58-starting/);
  await expect(transition).toBeVisible();
  await expect(entry).toBeHidden({timeout:4000});

  expect(pageErrors).toEqual([]);
});


test('保存セッションがある時だけ前回データ案内を表示する',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7',JSON.stringify({
      sourceName:'saved-session',
      records:[],
      polygons:[],
      activeLayer:'new-pokestop',
      circleExtras:[],
      polygonVisible:false,
      center:[35.6812,139.7671],
      zoom:16
    }));
  });

  await page.goto('/creative/index.html');

  const entry=page.locator('#entry');
  await expect(entry).toBeVisible({timeout:15000});
  const resume=page.locator('#resumeButton');
  await expect(resume).toBeVisible();
  await expect(resume).toHaveClass(/show/);
  await expect(resume).toHaveText('前回のデータから再開');

  const hint=await resume.evaluate(el=>{
    const style=getComputedStyle(el,'::before');
    const own=getComputedStyle(el);
    return {
      content:style.content,
      animationName:style.animationName,
      color:style.color,
      marginTop:parseFloat(own.marginTop||'0')
    };
  });
  expect(hint.content).toContain('↓ 前回のデータがあるみたい');
  expect(hint.animationName).toBe('cmV61SavedDataNudge');
  expect(hint.marginTop).toBeGreaterThanOrEqual(40);
});


test('KMZ保存先パネルのダウンロード操作を文字で表示する',async({page})=>{
  await page.goto('/creative/index.html');
  const entry=page.locator('#entry');
  await expect(entry).toBeVisible({timeout:15000});
  await page.locator('#entryFile').setInputFiles({
    name:'creative-download.csv',
    mimeType:'text/csv',
    buffer:Buffer.from(csv)
  });
  const startButton=page.locator('#startButton');
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await expect(entry).toBeHidden({timeout:4000});

  await page.locator('#cmStandaloneSaveButton').click();
  const saveMenu=page.locator('#cmStandaloneSaveMenu');
  await expect(saveMenu).toBeVisible();
  await saveMenu.locator('#cmStandaloneKmz').click();

  const choose=page.getByRole('button',{name:'保存先を選ぶ'});
  const download=page.getByRole('button',{name:'ダウンロード',exact:true});
  await expect(choose).toBeVisible({timeout:10000});
  await expect(download).toBeVisible();
  await expect(download).toHaveText('ダウンロード');
  const box=await download.boundingBox();
  expect(box).not.toBeNull();
  expect(box.width).toBeGreaterThanOrEqual(100);

  const close=page.getByRole('button',{name:'×'});
  await expect(close).toBeVisible();
  await close.click();
});


test('活動範囲の削除を戻る・やり直しできる',async({page})=>{
  await page.addInitScript(()=>{
    localStorage.setItem('next-lab-creative-v7',JSON.stringify({
      sourceName:'activity-range-history',
      records:[],
      polygons:[{
        id:'activity-range-1',
        points:[
          [35.6808,139.7667],
          [35.6816,139.7667],
          [35.6812,139.7677]
        ],
        deleted:false,
        source:false
      }],
      activeLayer:'new-pokestop',
      circleExtras:[],
      polygonVisible:true,
      center:[35.6812,139.7671],
      zoom:17
    }));
  });

  await page.goto('/creative/index.html');
  const entry=page.locator('#entry');
  await expect(entry).toBeVisible({timeout:15000});
  const resume=page.locator('#resumeButton');
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(entry).toBeHidden({timeout:4000});

  const activityRow=page.locator('#layerRows .layer-row').last().locator('button');
  await expect(activityRow).toHaveText('活動範囲 (1)');

  await page.locator('#toolbox').click();
  await page.locator('#toolMenu [data-tool="polygon"]').click();
  const deleteChoice=page.getByRole('button',{name:'削除する',exact:true});
  await expect(deleteChoice).toBeVisible();
  await deleteChoice.click();

  await expect(page.locator('#status')).toContainText('削除する活動範囲を選択');
  const deleteTarget=page.locator('.leaflet-polygon-pane .leaflet-interactive').last();
  await expect(deleteTarget).toBeVisible();
  await deleteTarget.click({force:true});

  const confirmDelete=page.getByRole('button',{name:'活動範囲を削除',exact:true});
  await expect(confirmDelete).toBeVisible();
  await confirmDelete.click();

  await expect(activityRow).toHaveText('活動範囲');
  const undo=page.locator('#undo');
  const redo=page.locator('#redo');
  await expect(undo).toBeEnabled();
  await undo.click();
  await expect(activityRow).toHaveText('活動範囲 (1)');
  await expect(redo).toBeEnabled();

  await redo.click();
  await expect(activityRow).toHaveText('活動範囲');
});
