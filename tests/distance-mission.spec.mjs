import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

function basePois({ missingComment = false, duplicate = false } = {}) {
  const points = [
    {
      id: 'existing-a', guid: 'existing-a', title: '既存A',
      lat: 35.681000, lng: 139.767000,
      role: 'existing', layer: 'existing-pokestop', gameEntity: 'POKESTOP', description: ''
    },
    {
      id: 'existing-b', guid: 'existing-b', title: '既存B',
      lat: 35.681000, lng: duplicate ? 139.767000 : 139.767150,
      role: 'existing', layer: 'existing-pokestop', gameEntity: 'POKESTOP', description: ''
    },
    {
      id: 'existing-c', guid: 'existing-c', title: '既存C',
      lat: 35.681000, lng: 139.767390,
      role: 'existing', layer: 'existing-gym', gameEntity: 'GYM', description: ''
    },
    {
      id: 'added-x', guid: 'added-x', title: '新規X',
      lat: 35.681300, lng: 139.767020,
      role: 'added', layer: 'new-pokestop', gameEntity: 'POKESTOP',
      description: missingComment ? '' : '会場導線を確保するため'
    }
  ];
  return points;
}

function makeProject({ environment = null, missingComment = false, duplicate = false } = {}) {
  const currentPois = basePois({ missingComment, duplicate });
  return {
    projectId: `distance-mission-e2e-${duplicate ? 'duplicate' : missingComment ? 'missing-comment' : 'normal'}`,
    source: 'bridge',
    phase: 'design',
    currentPois,
    selectedPois: currentPois.filter((poi) => poi.role === 'existing'),
    addedPois: currentPois.filter((poi) => poi.role === 'added'),
    polygon: [
      [35.6807, 139.7667],
      [35.6807, 139.7677],
      [35.6816, 139.7677],
      [35.6816, 139.7667]
    ],
    siteEnvironment: environment || undefined,
    distanceAdviceContext: {
      group_size: 40,
      cluster_length_m: 90,
      expected_stop_points: 8
    }
  };
}

async function installProject(page, project) {
  await page.addInitScript((payload) => {
    localStorage.setItem('campsiteAccessUnlocked', 'true');
    localStorage.setItem('campsiteAccessLoginAt', String(Date.now()));
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(payload));
  }, project);
}

async function openMission(page, project) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await installProject(page, project);
  await page.goto('/bridge-distance.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => typeof window.runDistanceCheck === 'function' && Boolean(window.CampsiteDistanceProject))).toBe(true);
  await page.evaluate(() => window.runDistanceCheck());
  await expect(page.locator('.campsite-mission-shell')).toBeVisible();
  return pageErrors;
}

async function selectCompleteEnvironment(page) {
  await page.locator('[data-env-key="traffic"][data-env-value="easy"]').click();
  await page.locator('[data-env-key="plaza"][data-env-value="true"]').click();
  await page.locator('[data-env-key="circulation"][data-env-value="true"]').click();
  await page.locator('[data-env-key="waiting"][data-env-value="true"]').click();
}

function missionCard(page, label) {
  return page.locator('.campsite-mission-card').filter({ has: page.locator('.campsite-mission-kicker', { hasText: label }) }).first();
}

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', (route) => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', (route) => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, (route) => route.fulfill({ status: 204, body: '' }));
  await page.route(/https:\/\/script\.google\.com\/.*/, (route) => route.fulfill({ status: 204, body: '' }));
});

test('MISSION 1〜5が現地確認と連動して準備完了になる', async ({ page }) => {
  const pageErrors = await openMission(page, makeProject());

  const lamps = page.locator('.campsite-mission-lamp');
  await expect(lamps).toHaveCount(5);
  await expect(lamps.nth(0)).toContainText('距離');
  await expect(lamps.nth(1)).toContainText('拠点');
  await expect(lamps.nth(2)).toContainText('現地');
  await expect(lamps.nth(3)).toContainText('最終');
  await expect(lamps.nth(4)).toContainText('完了');

  await expect(missionCard(page, 'MISSION 1')).toContainText('50m未満');
  await expect(missionCard(page, 'MISSION 1')).toContainText('CA確認済み');
  await expect(missionCard(page, 'MISSION 2')).toContainText('20m未満');
  await expect(missionCard(page, 'MISSION 2')).toContainText('20〜30m');
  await expect(missionCard(page, 'MISSION 2')).toContainText('30〜50m');
  await expect(page.locator('.campsite-chairman-sign')).toContainText('見てこないとだめだよ❗️');
  await expect(page.locator('.campsite-chairman-sign')).toContainText('現地へGO‼️');

  await selectCompleteEnvironment(page);

  await expect(page.locator('.campsite-chairman-sign')).toHaveCount(0);
  await expect(missionCard(page, 'MISSION 3')).toContainText('現地環境を確認済みです');
  await expect(page.getByText('🏕️ 運用のヒント', { exact: true })).toBeVisible();
  await expect(lamps.nth(2)).toHaveAttribute('data-state', 'green');
  await expect(lamps.nth(3)).toHaveAttribute('data-state', 'green');
  await expect(lamps.nth(4)).toHaveAttribute('data-state', 'green');
  await expect(page.locator('.campsite-goal')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.campsite-goal')).toContainText('🟢 準備完了！');

  const env = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1')).siteEnvironment);
  expect(env).toEqual({ traffic: 'easy', plaza: true, circulation: true, waiting: true });
  expect(pageErrors).toEqual([]);
});

test('設計変更後はMISSION 1・2と運用ヒントを確定表示しない', async ({ page }) => {
  const pageErrors = await openMission(page, makeProject({ environment: { traffic: 'easy', plaza: true, circulation: true, waiting: true } }));
  await expect(page.getByText('🏕️ 運用のヒント', { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
    project.distanceResult.stale = true;
    project.distanceResult.staleReason = 'design_changed';
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
    const marker = document.createElement('i');
    marker.dataset.e2eStaleMutation = 'true';
    document.body.appendChild(marker);
  });

  await expect(page.locator('.campsite-stale-mission-note')).toHaveCount(2);
  await expect(missionCard(page, 'MISSION 1').locator('.campsite-mission-body')).toBeHidden();
  await expect(missionCard(page, 'MISSION 2').locator('.campsite-mission-body')).toBeHidden();
  await expect(missionCard(page, 'OPERATION TIPS')).toBeHidden();

  const lamps = page.locator('.campsite-mission-lamp');
  await expect(lamps.nth(0)).toHaveAttribute('data-state', 'yellow');
  await expect(lamps.nth(1)).toHaveAttribute('data-state', 'yellow');
  await expect(lamps.nth(3)).toHaveAttribute('data-state', 'red');
  await expect(lamps.nth(4)).toHaveAttribute('data-state', 'gray');
  expect(pageErrors).toEqual([]);
});

test('重複POIは通常MISSIONとは別の赤い割り込みとしてブロックする', async ({ page }) => {
  const pageErrors = await openMission(page, makeProject({
    duplicate: true,
    environment: { traffic: 'easy', plaza: true, circulation: true, waiting: true }
  }));

  await expect(page.locator('.campsite-duplicate-alert')).toBeVisible();
  await expect(page.locator('.campsite-duplicate-alert')).toContainText('重複POI');
  const lamps = page.locator('.campsite-mission-lamp');
  await expect(lamps.nth(0)).toHaveAttribute('data-state', 'red');
  await expect(lamps.nth(3)).toHaveAttribute('data-state', 'red');
  await expect(lamps.nth(4)).toHaveAttribute('data-state', 'gray');
  await expect(page.locator('.campsite-goal')).toHaveAttribute('data-ready', 'false');
  await expect(page.locator('.campsite-goal')).toContainText('準備中');
  expect(pageErrors).toEqual([]);
});

test('50m未満の新規POIでコメントがなければMISSION 1は未完了のまま', async ({ page }) => {
  const pageErrors = await openMission(page, makeProject({
    missingComment: true,
    environment: { traffic: 'easy', plaza: true, circulation: true, waiting: true }
  }));

  const mission1 = missionCard(page, 'MISSION 1');
  await expect(mission1).toContainText('CA確認待ち');
  await expect(mission1).toContainText('コメント未入力');
  const lamps = page.locator('.campsite-mission-lamp');
  await expect(lamps.nth(0)).toHaveAttribute('data-state', 'yellow');
  await expect(lamps.nth(3)).toHaveAttribute('data-state', 'yellow');
  await expect(lamps.nth(4)).toHaveAttribute('data-state', 'gray');
  await expect(page.locator('.campsite-goal')).toHaveAttribute('data-ready', 'false');
  expect(pageErrors).toEqual([]);
});
