import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import JSZip from 'jszip';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');
const caAccessStub = `window.CampsiteCaAccess=Object.freeze({checkAccess:async()=>({status:'approved',isApproved:true}),signInWithDiscord:async()=>{},signOut:async()=>{}});`;

function baseProject() {
  const lat = 35.681236;
  const lng = 139.767125;
  const existing = {
    id: 'existing-a', guid: 'existing-a', title: '既存A', name: '既存A',
    lat, lng, role: 'existing', gameEntity: 'POKESTOP', description: ''
  };
  const added = {
    id: 'added-a', guid: 'added-a', title: '新規A', name: '新規A',
    lat: lat + 0.00105, lng, role: 'added', gameEntity: 'POKESTOP',
    description: '初回確認済み'
  };
  return {
    schemaVersion: '1.0',
    projectId: 'roundtrip-presentation-e2e',
    workspaceId: 'roundtrip-workspace-e2e',
    source: 'bridge',
    phase: 'design',
    circleRadii: [50, 40, 30],
    polygon: [
      [lat - 0.002, lng - 0.002],
      [lat - 0.002, lng + 0.002],
      [lat + 0.003, lng + 0.002],
      [lat + 0.003, lng - 0.002]
    ],
    sourcePois: [existing],
    selectedPois: [existing],
    currentPois: [existing, added],
    addedPois: [added],
    deletedPois: [],
    edits: [],
    siteEnvironment: {
      traffic: 'easy',
      plaza: true,
      circulation: true,
      waiting: true
    },
    distanceResult: null
  };
}

function powerSpotProject() {
  const project = baseProject();
  const power = {
    id: 'power-a', guid: 'power-a', title: 'Bridge PowerSpot', name: 'Bridge PowerSpot',
    lat: 35.6817, lng: 139.7677, role: 'existing', gameEntity: 'POWER_SPOT', description: ''
  };
  project.projectId = 'powerspot-ingress-e2e';
  project.workspaceId = 'powerspot-workspace-e2e';
  project.sourcePois = [power];
  project.selectedPois = [power];
  project.currentPois = [power];
  project.addedPois = [];
  return project;
}

async function installRoutes(page) {
  await page.route(/\/js\/ca-access\.js(?:\?.*)?$/, route => route.fulfill({ status: 200, contentType: 'application/javascript', body: caAccessStub }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
}

async function seed(page, project) {
  await page.addInitScript(value => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(value));
  }, project);
}

async function waitForDistance(page) {
  await expect.poll(() => page.evaluate(() => Boolean(window.CampsiteDistanceProject && typeof window.runDistanceCheck === 'function')), {
    timeout: 15000
  }).toBe(true);
}

async function runDistance(page) {
  await waitForDistance(page);
  await page.evaluate(async () => window.runDistanceCheck());
  await expect(page.locator('.campsite-mission-shell')).toHaveCount(1, { timeout: 12000 });
  await expect(page.locator('.campsite-mission-shell')).toHaveAttribute('data-layout-v2', 'true', { timeout: 12000 });
  await expect(page.locator('.campsite-mission-shell')).toHaveAttribute('data-mission-state-version', '1', { timeout: 12000 });
}

async function openMission4(page) {
  const legacy = page.locator('#distanceResult > .campsite-mission-legacy');
  await expect(legacy).not.toHaveAttribute('data-map-open', 'true');
  await page.locator('[data-mission-map]').dispatchEvent('click');
  await expect(legacy).toHaveAttribute('data-map-open', 'true');
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state', 'green');
  await expect(page.locator('[data-v2-submit]')).toBeEnabled();
}

async function openPoi(page, title) {
  await expect(page.locator('.leaflet-marker-pane .leaflet-marker-icon').first()).toBeVisible({ timeout: 15000 });
  const markers = page.locator('.leaflet-marker-pane .leaflet-marker-icon');
  const count = await markers.count();
  for (let i = 0; i < count; i++) {
    await markers.nth(i).click({ force: true });
    const sheet = page.locator('.cm-sheet');
    if (!await sheet.isVisible().catch(() => false)) continue;
    const name = sheet.locator('#cmName');
    if (await name.isVisible().catch(() => false)) {
      if ((await name.inputValue()) === title) return;
    }
    if ((await sheet.innerText()).includes(title)) return;
  }
  throw new Error(`POI sheet not found: ${title}`);
}

test.beforeEach(async ({ page }) => {
  await installRoutes(page);
});

test('CREATIVE往復で実編集→stale→再チェック→セーブ→提出前チェックまで同じProjectを保つ', async ({ page }) => {
  const original = baseProject();
  await seed(page, original);
  await page.goto('/bridge-distance.html?campsiteProject=bridge');
  await runDistance(page);
  await openMission4(page);

  const initialResult = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.distanceResult || null);
  expect(initialResult?.stale).toBe(false);

  await page.locator('[data-v2-rework]').click();
  await expect(page).toHaveURL(/\/creative\/index\.html\?campsiteProject=bridge/, { timeout: 15000 });
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.projectId || ''), { timeout: 20000 }).toBe(original.projectId);

  await openPoi(page, '新規A');
  await page.locator('#cmName').fill('新規A 発表版');
  await page.locator('#cmMemo').fill('現地確認済み・発表用コメント');
  await expect.poll(() => page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    const poi = project?.currentPois?.find(item => item.guid === 'added-a');
    return [poi?.title, poi?.description];
  })).toEqual(['新規A 発表版', '現地確認済み・発表用コメント']);

  await page.locator('#cmType').click();
  await page.locator('#cmTypePicker button[data-layer="new-power"]').click();
  await openPoi(page, '新規A 発表版');

  await page.locator('#cmMove').click();
  await expect(page.locator('#cmMoveBar')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('.cm-coordinate-trigger')).toBeVisible({ timeout: 5000 });
  await page.locator('.cm-coordinate-trigger').click();
  await page.locator('#cmCoordinateInput').fill('35.683000, 139.768500');
  await page.locator('#cmCoordinateInput').press('Enter');
  await expect(page.locator('#cmCoordinateJumpPanel')).toBeHidden();
  await page.locator('#cmMoveConfirm').click();

  await page.locator('#campsiteProjectNext').click();
  await expect(page).toHaveURL(/\/bridge-distance\.html\?campsiteProject=bridge/, { timeout: 15000 });
  await waitForDistance(page);

  const staleProject = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null'));
  expect(staleProject.projectId).toBe(original.projectId);
  expect(staleProject.workspaceId).toBe(original.workspaceId);
  expect(staleProject.distanceResult?.stale).toBe(true);
  expect(staleProject.distanceResult?.staleReason).toBe('creative-design-changed');
  expect(staleProject.circleRadii).toEqual([50, 40, 30]);
  expect(staleProject.polygon).toEqual(original.polygon);

  const editedBeforeRecheck = staleProject.currentPois.find(poi => poi.guid === 'added-a');
  expect(editedBeforeRecheck?.title).toBe('新規A 発表版');
  expect(editedBeforeRecheck?.description).toBe('現地確認済み・発表用コメント');
  expect(editedBeforeRecheck?.gameEntity).toBe('POWERSPOT');
  expect(editedBeforeRecheck?.lat).toBeCloseTo(35.683, 5);
  expect(editedBeforeRecheck?.lng).toBeCloseTo(139.7685, 5);

  await page.evaluate(async () => window.runDistanceCheck());
  await expect(page.locator('.campsite-mission-shell')).toHaveCount(1, { timeout: 12000 });
  await expect(page.locator('.campsite-mission-shell')).toHaveAttribute('data-layout-v2', 'true', { timeout: 12000 });
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.distanceResult?.stale)).toBe(false);
  await expect(page.locator('.campsite-mission-lamp').nth(3)).toHaveAttribute('data-state', 'gray');
  await openMission4(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-v2-save]').click()
  ]);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const zip = await JSZip.loadAsync(fs.readFileSync(downloadPath));
  const savedProject = JSON.parse(await zip.file('campsite-project.json').async('string'));
  expect(savedProject.projectId).toBe(original.projectId);
  expect(savedProject.workspaceId).toBe(original.workspaceId);
  const savedEdited = savedProject.currentPois.find(poi => poi.guid === 'added-a');
  expect(savedEdited?.gameEntity).toBe('POWERSPOT');
  expect(savedEdited?.title).toBe('新規A 発表版');

  await page.locator('[data-v2-submit]').click();
  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.phase || null)).toBe('pre-submit');
  const finalProject = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null'));
  expect(finalProject.projectId).toBe(original.projectId);
  expect(finalProject.workspaceId).toBe(original.workspaceId);
  expect(finalProject.preSubmit?.source).toBe('campsiteProject.v1');
});

test('BridgeのPOWER_SPOTをCREATIVEのPowerSpotレイヤーへ受け入れ、端末幅でトップ画像だけを切り替える', async ({ page }) => {
  const project = powerSpotProject();
  await seed(page, project);
  await page.goto('/creative/index.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => window.CampsiteCreativeProject?.projectId || ''), { timeout: 20000 }).toBe(project.projectId);

  const normalized = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null'));
  expect(normalized.currentPois[0].gameEntity).toBe('POWERSPOT');
  expect(normalized.selectedPois[0].gameEntity).toBe('POWERSPOT');

  await page.getByRole('button', { name: /レイヤー/ }).click();
  const powerRow = page.locator('.layer-row').filter({ hasText: '既存 PowerSpot' }).first();
  await expect(powerRow).toBeVisible();
  await expect(powerRow).toHaveAttribute('aria-pressed', 'true');
  await openPoi(page, 'Bridge PowerSpot');

  await powerRow.click();
  await expect(powerRow).toHaveAttribute('aria-pressed', 'false');
  await powerRow.click();
  await expect(powerRow).toHaveAttribute('aria-pressed', 'true');
  await openPoi(page, 'Bridge PowerSpot');

  const backgroundImage = async () => page.locator('.entry').evaluate(el => getComputedStyle(el).backgroundImage);
  await page.setViewportSize({ width: 393, height: 852 });
  await expect.poll(backgroundImage).toContain('campsite-top-mobile.png');
  await page.setViewportSize({ width: 412, height: 915 });
  await expect.poll(backgroundImage).toContain('campsite-top-mobile.png');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(backgroundImage).toContain('campsite-top-desktop.png');
});
