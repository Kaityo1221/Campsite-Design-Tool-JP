import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

function poi(id, title, lat, lng, role = 'existing', description = '', gameEntity = 'POKESTOP') {
  return { id, guid: id, title, name: title, lat, lng, role, description, gameEntity };
}

function projectFixture({ environment = 'complete', addedComment = '通行動線を確認済み', duplicate = false } = {}) {
  const lat = 35.6812;
  const lng = 139.7671;
  const addedLat = duplicate ? lat : lat + 0.00036;
  const currentPois = [
    poi('existing-a', '既存A', lat, lng),
    poi('existing-b', '既存B', lat + 0.00012, lng),
    poi('existing-c', '既存C', lat + 0.00027, lng),
    poi('existing-d', '既存D', lat + 0.00058, lng),
    poi('added-a', '新規A', addedLat, lng, 'added', addedComment),
  ];

  const project = {
    schemaVersion: '1.0',
    projectId: `distance-mission-${Math.random().toString(36).slice(2)}`,
    source: 'bridge',
    phase: 'design',
    circleRadii: [50, 40, 30],
    polygon: [
      [lat - 0.001, lng - 0.001],
      [lat - 0.001, lng + 0.001],
      [lat + 0.001, lng + 0.001],
      [lat + 0.001, lng - 0.001],
    ],
    sourcePois: currentPois.filter(item => item.role === 'existing'),
    selectedPois: currentPois.filter(item => item.role === 'existing'),
    currentPois,
    addedPois: currentPois.filter(item => item.role === 'added'),
    deletedPois: [],
    edits: [],
    distanceResult: null,
  };

  if (environment === 'complete') {
    project.siteEnvironment = {
      traffic: 'narrow',
      plaza: true,
      circulation: true,
      waiting: false,
    };
  }
  return project;
}

async function openDistanceProject(page, project) {
  await page.addInitScript(value => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(value));
  }, project);
  await page.goto('/bridge-distance.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => Boolean(window.CampsiteDistanceProject && typeof window.runDistanceCheck === 'function')), {
    timeout: 15000,
  }).toBe(true);
  await page.evaluate(async () => {
    await window.runDistanceCheck();
  });
  await expect(page.locator('.campsite-mission-shell')).toHaveCount(1, { timeout: 12000 });
}

async function projectPhase(page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.phase || null);
}

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

test('MISSION 1〜5が完了し、運用のヒントと任意マップを表示できる', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await openDistanceProject(page, projectFixture());

  await expect(page.getByText('新しいPOIを確認しましょう')).toBeVisible();
  await expect(page.getByText('自分の拠点を理解しましょう')).toBeVisible();
  await expect(page.getByText('現地を確認しましょう')).toBeVisible();
  await expect(page.getByText('最後に確認しましょう')).toBeVisible();
  await expect(page.getByText('🟢 準備完了！')).toBeVisible();

  const states = await page.locator('.campsite-mission-lamp').evaluateAll(items => items.map(item => item.dataset.state));
  expect(states).toEqual(['green', 'green', 'green', 'green', 'green']);

  await expect(page.locator('.campsite-mission-card').filter({ hasText: 'OPERATION TIPS' })).toBeVisible();
  await expect(page.locator('#campsiteDistanceCommentWarning')).toBeHidden();

  const legacy = page.locator('#distanceResult > .campsite-mission-legacy');
  await expect(legacy).not.toHaveAttribute('data-map-open', 'true');
  await page.locator('[data-mission-map]').dispatchEvent('click');
  await expect(legacy).toHaveAttribute('data-map-open', 'true');

  expect(pageErrors).toEqual([]);
});

test('現地未確認なら会長看板が出て提出前へ進めない', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ environment: 'missing' }));

  const sign = page.locator('.campsite-chairman-sign');
  await expect(sign).toContainText('【会長からのメッセージ】');
  await expect(sign).toContainText('見てこないとだめだよ❗️');
  await expect(sign).toContainText('現地へGO‼️');

  const states = await page.locator('.campsite-mission-lamp').evaluateAll(items => items.map(item => item.dataset.state));
  expect(states[2]).toBe('yellow');
  expect(states[4]).toBe('gray');

  expect(await projectPhase(page)).toBe('distance');
  await page.locator('[data-go-pre-submit]').dispatchEvent('click');
  expect(await projectPhase(page)).toBe('distance');
  await expect(sign).toHaveClass(/campsite-mission-gate-pop/);
});

test('MISSION 3を現地確認すると看板が消え、自動完了して運用ヒントが出る', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ environment: 'missing' }));
  await expect(page.locator('.campsite-chairman-sign')).toBeVisible();

  await page.locator('[data-env-key="traffic"][data-env-value="narrow"]').dispatchEvent('click');
  await page.locator('[data-env-key="plaza"][data-env-value="true"]').dispatchEvent('click');
  await page.locator('[data-env-key="circulation"][data-env-value="true"]').dispatchEvent('click');
  await page.locator('[data-env-key="waiting"][data-env-value="false"]').dispatchEvent('click');

  await expect(page.locator('.campsite-chairman-sign')).toHaveCount(0);
  await expect(page.locator('.campsite-mission-card').filter({ hasText: 'OPERATION TIPS' })).toBeVisible();
  await expect(page.getByText('🟢 準備完了！')).toBeVisible();
  const states = await page.locator('.campsite-mission-lamp').evaluateAll(items => items.map(item => item.dataset.state));
  expect(states).toEqual(['green', 'green', 'green', 'green', 'green']);

  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.siteEnvironment || null);
  expect(saved).toEqual({ traffic: 'narrow', plaza: true, circulation: true, waiting: false });
});

test('重複POIは赤い割り込み警告になり提出をブロックする', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ duplicate: true }));

  await expect(page.locator('.campsite-duplicate-alert')).toContainText('🚨 修正候補');
  await expect(page.locator('.campsite-duplicate-alert')).toContainText('重複POI');
  await expect(page.locator('.campsite-mission-lamp').nth(0)).toHaveAttribute('data-state', 'red');
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state', 'red');

  expect(await projectPhase(page)).toBe('distance');
  await page.locator('[data-go-pre-submit]').dispatchEvent('click');
  expect(await projectPhase(page)).toBe('distance');
});

test('設計変更でstaleになった結果はMISSION 1・2と運用ヒントを確定表示しない', async ({ page }) => {
  await openDistanceProject(page, projectFixture());
  await expect(page.locator('.campsite-mission-card').filter({ hasText: 'OPERATION TIPS' })).toBeVisible();

  await page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    project.distanceResult.stale = true;
    project.distanceResult.staleAt = new Date().toISOString();
    project.distanceResult.staleReason = 'test-design-change';
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
    document.body.appendChild(document.createElement('i'));
  });

  await expect(page.locator('.campsite-stale-mission-note')).toHaveCount(2);
  await expect(page.locator('.campsite-mission-card').filter({ hasText: 'OPERATION TIPS' })).toBeHidden();
  await expect(page.locator('.campsite-mission-lamp').nth(0)).toHaveAttribute('data-state', 'yellow');
  await expect(page.locator('.campsite-mission-lamp').nth(1)).toHaveAttribute('data-state', 'yellow');
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state', 'red');
  await expect(page.locator('.campsite-mission-lamp').nth(4)).toHaveAttribute('data-state', 'gray');

  await page.locator('[data-go-pre-submit]').dispatchEvent('click');
  expect(await projectPhase(page)).toBe('distance');
});

test('50m未満のCAコメント不足は既存コメントゲートで止まる', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ addedComment: '' }));

  await expect(page.getByText('CA確認待ち').first()).toBeVisible();
  await expect(page.locator('.campsite-mission-lamp').nth(0)).toHaveAttribute('data-state', 'yellow');
  await expect(page.locator('#campsiteDistanceCommentWarning')).toBeHidden();

  await page.locator('[data-go-pre-submit]').dispatchEvent('click');
  const dialog = page.locator('#campsiteDistanceCommentGate');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('50m未満の候補地にはコメントが必要です。');
  expect(await projectPhase(page)).toBe('distance');
});
