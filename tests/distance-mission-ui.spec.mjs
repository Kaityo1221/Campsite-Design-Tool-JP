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
  await expect(page.locator('.campsite-mission-shell')).toHaveAttribute('data-layout-v2', 'true', { timeout: 12000 });
  await expect(page.locator('.campsite-mission-shell')).toHaveAttribute('data-mission-state-version', '1', { timeout: 12000 });
}

async function projectPhase(page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.phase || null);
}

async function missionStates(page) {
  return page.locator('.campsite-mission-lamp').evaluateAll(items => items.map(item => item.dataset.state));
}

async function openMission4Map(page) {
  const legacy = page.locator('#distanceResult > .campsite-mission-legacy');
  await expect(legacy).not.toHaveAttribute('data-map-open', 'true');
  await page.locator('[data-mission-map]').dispatchEvent('click');
  await expect(legacy).toHaveAttribute('data-map-open', 'true');
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state', 'green');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const removeGate = () => document.getElementById('caAccessGate')?.remove();
    const observe = () => {
      removeGate();
      new MutationObserver(removeGate).observe(document.documentElement, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', observe, { once: true });
    else observe();
  });
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

test('MISSION 1〜5を順に確認し、地図確認後に準備完了になる', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await openDistanceProject(page, projectFixture());

  await expect(page.getByText('新しいPOIを確認しましょう')).toBeVisible();
  await expect(page.getByText('自分の拠点を理解しましょう')).toBeVisible();
  await expect(page.getByText('現地の使い方を確認しましょう')).toBeVisible();
  await expect(page.getByText('配置を地図で見てみましょう')).toBeVisible();
  await expect(page.getByText('最後に確認して準備完了')).toBeVisible();
  await expect(page.getByText('📏 新規POIの距離確認')).toBeVisible();
  await expect(page.getByText('🏕️ 拠点の密集特性')).toBeVisible();
  await expect(page.getByText('🌳 現地環境')).toBeVisible();
  await expect(page.getByText('🗺️ 配置・マップ')).toBeVisible();
  await expect(page.getByText('✅ 最終確認')).toBeVisible();

  expect(await missionStates(page)).toEqual(['green', 'green', 'green', 'gray', 'gray']);
  await expect(page.getByText('⚪ 準備中')).toBeVisible();
  await expect(page.locator('[data-v2-submit]')).toBeDisabled();
  await expect(page.locator('.campsite-mission-card').filter({ hasText: 'OPERATION TIPS' })).toBeHidden();
  await expect(page.locator('#campsiteDistanceCommentWarning')).toBeHidden();

  await page.locator('[data-v2-pair-toggle]').click();
  await expect(page.locator('.campsite-v2-pair-kind').first()).toHaveText('新規 × 既存');
  await expect(page.getByText('CA確認済み').first()).toBeVisible();

  await openMission4Map(page);
  await expect(page.locator('.campsite-mission-lamp').nth(4)).toHaveAttribute('data-state', 'green');
  await expect(page.getByText('🟢 準備完了！')).toBeVisible();
  await expect(page.locator('[data-v2-submit]')).toBeEnabled();

  expect(pageErrors).toEqual([]);
});

test('現地未着手ならMISSION 3は灰で入力を促す', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ environment: 'missing' }));

  const sign = page.locator('.campsite-chairman-sign');
  await expect(sign).toContainText('現地環境の確認が残っています');
  await expect(page.locator('[data-v2-env-toggle]')).toHaveText('現地確認を入力');

  const states = await missionStates(page);
  expect(states[2]).toBe('gray');
  expect(states[3]).toBe('gray');
  expect(states[4]).toBe('gray');
  await expect(page.getByText('⚪ 準備中')).toBeVisible();
  await expect(page.locator('[data-v2-submit]')).toBeDisabled();

  expect(await projectPhase(page)).toBe('distance');
});

test('MISSION 3を現地確認し、MISSION 4も確認すると完了する', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ environment: 'missing' }));
  await expect(page.locator('.campsite-chairman-sign')).toBeVisible();

  await page.locator('[data-v2-env-toggle]').click();
  await page.locator('[data-env-key="traffic"][data-env-value="narrow"]').dispatchEvent('click');
  await page.locator('[data-env-key="plaza"][data-env-value="true"]').dispatchEvent('click');
  await page.locator('[data-env-key="circulation"][data-env-value="true"]').dispatchEvent('click');
  await page.locator('[data-env-key="waiting"][data-env-value="false"]').dispatchEvent('click');

  await expect(page.locator('.campsite-chairman-sign')).toHaveCount(0);
  expect((await missionStates(page)).slice(0, 4)).toEqual(['green', 'green', 'green', 'gray']);
  await expect(page.getByText('⚪ 準備中')).toBeVisible();

  await openMission4Map(page);
  expect(await missionStates(page)).toEqual(['green', 'green', 'green', 'green', 'green']);
  await expect(page.getByText('🟢 準備完了！')).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.siteEnvironment || null);
  expect(saved).toEqual({ traffic: 'narrow', plaza: true, circulation: true, waiting: false });
});

test('重複POIは通常MISSION外の赤い割り込み警告になり、最終MISSIONをブロックする', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ duplicate: true }));

  const alert = page.locator('.campsite-duplicate-alert');
  const details = page.locator('.campsite-duplicate-details');
  await expect(alert).toContainText('🚨 修正候補');
  await expect(alert).toContainText('重複POI');
  await expect(page.getByRole('button', { name: '内容を確認する' })).toBeVisible();
  await expect(details).toBeHidden();
  await page.getByRole('button', { name: '内容を確認する' }).click();
  await expect(details).toBeVisible();
  await expect(details.locator('.campsite-duplicate-pair').first()).toContainText('既存A');
  await expect(details.locator('.campsite-duplicate-pair').first()).toContainText('新規A');
  await expect(page.locator('.campsite-mission-lamp').nth(4)).toHaveAttribute('data-state', 'red');
  await expect(page.locator('[data-v2-submit]')).toBeDisabled();

  const finalCard = page.locator('.campsite-mission-card').filter({ hasText: 'MISSION 5' });
  await expect(finalCard).toContainText('重複POIが');
  expect(await projectPhase(page)).toBe('distance');
});

test('設計変更でstaleになった結果はMISSION 1・2・4を確定表示しない', async ({ page }) => {
  await openDistanceProject(page, projectFixture());

  await page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    project.distanceResult.stale = true;
    project.distanceResult.staleAt = new Date().toISOString();
    project.distanceResult.staleReason = 'test-design-change';
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
    document.body.appendChild(document.createElement('i'));
  });

  await expect(page.locator('.campsite-stale-mission-note')).toHaveCount(3);
  await expect(page.locator('.campsite-mission-lamp').nth(0)).toHaveAttribute('data-state', 'yellow');
  await expect(page.locator('.campsite-mission-lamp').nth(1)).toHaveAttribute('data-state', 'yellow');
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state', 'gray');
  await expect(page.locator('.campsite-mission-lamp').nth(4)).toHaveAttribute('data-state', 'red');
  await expect(page.locator('[data-v2-submit]')).toBeDisabled();

  await page.locator('[data-go-pre-submit]').dispatchEvent('click');
  expect(await projectPhase(page)).toBe('distance');
});

test('50m未満のCAコメント不足はMISSION 1未完了となり既存コメントゲートで止まる', async ({ page }) => {
  await openDistanceProject(page, projectFixture({ addedComment: '' }));

  await page.locator('[data-v2-pair-toggle]').click();
  await expect(page.getByText('CA確認待ち').first()).toBeVisible();
  await expect(page.locator('.campsite-mission-lamp').nth(0)).toHaveAttribute('data-state', 'yellow');
  await expect(page.locator('#campsiteDistanceCommentWarning')).toBeHidden();
  await expect(page.locator('[data-v2-submit]')).toBeDisabled();

  await openMission4Map(page);
  await page.locator('[data-go-pre-submit]').dispatchEvent('click');
  const dialog = page.locator('#campsiteDistanceCommentGate');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('50m未満の候補地にはコメントが必要です。');
  expect(await projectPhase(page)).toBe('distance');
});
