import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const leafletJs = fs.readFileSync('node_modules/leaflet/dist/leaflet.js', 'utf8');
const leafletCss = fs.readFileSync('node_modules/leaflet/dist/leaflet.css', 'utf8');
const jszipJs = fs.readFileSync('node_modules/jszip/dist/jszip.min.js', 'utf8');

function fixture() {
  const lat = 35.6812;
  const lng = 139.7671;
  const currentPois = [
    { id: 'e1', guid: 'e1', title: '既存1', lat, lng, role: 'existing', gameEntity: 'POKESTOP' },
    { id: 'e2', guid: 'e2', title: '既存2', lat: lat + 0.00012, lng, role: 'existing', gameEntity: 'POKESTOP' },
    { id: 'e3', guid: 'e3', title: '既存3', lat: lat + 0.00027, lng, role: 'existing', gameEntity: 'POKESTOP' },
    { id: 'e4', guid: 'e4', title: '既存4', lat: lat + 0.00058, lng, role: 'existing', gameEntity: 'POKESTOP' },
    { id: 'a1', guid: 'a1', title: '新規1', lat: lat + 0.00036, lng, role: 'added', layer: 'new-pokestop', gameEntity: 'POKESTOP', description: '通行動線を確認済み' },
  ];
  return {
    schemaVersion: '1.0',
    projectId: 'distance-advice-trace-e2e',
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
    siteEnvironment: { traffic: 'narrow', plaza: true, circulation: true, waiting: false },
    distanceAdviceContext: { group_size: 40, cluster_length_m: 90, expected_stop_points: 8 },
  };
}

async function openProject(page) {
  await page.addInitScript(project => {
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
  }, fixture());
  await page.goto('/bridge-distance.html?campsiteProject=bridge');
  await expect.poll(() => page.evaluate(() => Boolean(window.CampsiteDistanceProject && typeof window.runDistanceCheck === 'function')), { timeout: 15000 }).toBe(true);
  await page.evaluate(async () => { await window.runDistanceCheck(); });
  await expect(page.locator('.campsite-mission-shell')).toHaveCount(1, { timeout: 12000 });
}

test.beforeEach(async ({ page }) => {
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: leafletJs }));
  await page.route('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', route => route.fulfill({ status: 200, contentType: 'text/css', body: leafletCss }));
  await page.route('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', route => route.fulfill({ status: 200, contentType: 'application/javascript', body: jszipJs }));
  await page.route(/https:\/\/[^/]+\.tile\.openstreetmap\.org\/.*/, route => route.fulfill({ status: 204, body: '' }));
});

test('表示した運用ヒントの根拠をProjectへ保存し、stale時は無効化する', async ({ page }) => {
  await openProject(page);

  await expect.poll(() => page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    return project?.distanceAdviceResult?.status || null;
  }), { timeout: 12000 }).toBe('ready');

  const projectAfterAdvice = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null'));
  expect(projectAfterAdvice.distanceResult?.stale).toBe(false);
  const trace = projectAfterAdvice.distanceAdviceResult;
  expect(trace.schemaVersion).toBe('0.1.0');
  expect(trace.rulesetId).toBe('campsite-distance-advice-v0.1');
  expect(trace.stale).toBe(false);
  expect(trace.context.group_size).toBe(40);
  expect(trace.context.cluster_length_m).toBe(90);
  expect(trace.context.expected_stop_points).toBe(8);
  expect(trace.context.traffic).toBe('narrow');
  expect(trace.shownAdvice.length).toBeGreaterThan(0);
  expect(trace.shownAdvice.length).toBeLessThanOrEqual(3);
  expect(trace.shownAdvice.every(item => item.id && item.category && Array.isArray(item.factsUsed) && Array.isArray(item.behaviorTags))).toBe(true);
  expect(Array.isArray(trace.matchedRuleIds)).toBe(true);
  expect(trace.feedback).toEqual({ accepted: null, edited: null, caFeedback: null, eventOutcomeNotes: null });

  await page.evaluate(() => {
    const project = JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null');
    project.distanceResult.stale = true;
    project.distanceResult.staleReason = 'training-trace-e2e';
    sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
    document.body.appendChild(document.createElement('i'));
  });

  await expect.poll(() => page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null')?.distanceAdviceResult?.status || null), { timeout: 8000 }).toBe('stale');
  const staleTrace = await page.evaluate(() => JSON.parse(sessionStorage.getItem('campsiteProject.v1') || 'null').distanceAdviceResult);
  expect(staleTrace.stale).toBe(true);
  expect(typeof staleTrace.staleAt).toBe('string');
});
