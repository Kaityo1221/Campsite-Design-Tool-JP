import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const creativeIndex = fs.readFileSync('creative/index.html', 'utf8');
const stalePatch = fs.readFileSync('creative/bridge-distance-stale-patch.js', 'utf8');
const distanceProject = fs.readFileSync('js/bridge-distance-project.js', 'utf8');
const distanceBackup = fs.readFileSync('js/bridge-distance-checkpoint.js', 'utf8');
const commentGate = fs.readFileSync('js/bridge-distance-comment-gate.js', 'utf8');

assert.ok(creativeIndex.includes("fetch('./bridge-distance-stale-patch.js'"), 'Creative must load the stale-distance patch');
assert.ok(creativeIndex.includes('html=window.applyCreativeBridgeDistanceStalePatch(html)'), 'Creative must apply the stale-distance patch for Bridge projects');

const registrationContext = { window: {}, console, String };
vm.createContext(registrationContext);
vm.runInContext(stalePatch, registrationContext);
assert.equal(typeof registrationContext.window.applyCreativeBridgeDistanceStalePatch, 'function');

const runtimeSource = `
const CAMPSITE_PROJECT_KEY='campsiteProject.v1';
function syncCampsiteProjectFromCreative(project){return project}
function restore(){return true}
`;
const transformed = registrationContext.window.applyCreativeBridgeDistanceStalePatch(runtimeSource);
assert.ok(transformed.includes('function campsProjectDesignSignature(project){'), 'Creative patch must create a deterministic design signature');
assert.ok(transformed.includes("result.stale=true"), 'Creative patch must mark prior distance results stale after design changes');
assert.ok(transformed.includes("result.staleReason='creative-design-changed'"), 'Creative patch must record the stale reason');

const storage = new Map();
const runtimeContext = {
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Array,
  Map,
  sessionStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  }
};
vm.createContext(runtimeContext);
vm.runInContext(transformed, runtimeContext);
assert.equal(typeof runtimeContext.campsProjectDesignSignature, 'function');
assert.equal(typeof runtimeContext.campsProjectMarkDistanceStale, 'function');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function baseProject() {
  return {
    source: 'bridge',
    phase: 'distance',
    preSubmitCheckpoint: { savedAt: '2026-09-28T00:00:00.000Z' },
    circleRadii: [50, 40, 30],
    polygon: [
      [35.6810, 139.7669],
      [35.6810, 139.7675],
      [35.6816, 139.7675],
      [35.6816, 139.7669]
    ],
    currentPois: [
      {
        id: 'existing-a', guid: 'existing-a', title: '既存A',
        lat: 35.6812, lng: 139.7671, role: 'existing', layer: 'existing-pokestop',
        gameEntity: 'POKESTOP', description: ''
      },
      {
        id: 'added-a', guid: 'added-a', title: '新規A',
        lat: 35.68156, lng: 139.7671, role: 'added', layer: 'new-pokestop',
        gameEntity: 'POKESTOP', description: '現地確認済み'
      }
    ],
    distanceResult: null
  };
}

function checkedProject() {
  const project = baseProject();
  project.distanceResult = {
    checkedAt: '2026-09-28T00:00:00.000Z',
    designSignature: runtimeContext.campsProjectDesignSignature(project),
    stale: false,
    staleAt: null,
    staleReason: '',
    currentDesignSignature: ''
  };
  return project;
}

function expectStale(name, mutate) {
  storage.clear();
  const project = checkedProject();
  mutate(project);
  runtimeContext.campsProjectMarkDistanceStale(project);
  assert.equal(project.distanceResult.stale, true, `${name}: distance result must become stale`);
  assert.equal(project.distanceResult.staleReason, 'creative-design-changed', `${name}: stale reason must be recorded`);
  assert.equal(project.phase, 'design', `${name}: project must return to design phase`);
  assert.equal(project.preSubmitCheckpoint, null, `${name}: pre-submit checkpoint must be cleared`);
  assert.ok(project.distanceResult.currentDesignSignature, `${name}: current design signature must be recorded`);
}

function expectFresh(name, mutate) {
  storage.clear();
  const project = checkedProject();
  mutate(project);
  runtimeContext.campsProjectMarkDistanceStale(project);
  assert.equal(project.distanceResult.stale, false, `${name}: distance result must remain fresh`);
}

expectFresh('unchanged design', () => {});
expectStale('POI add', project => {
  project.currentPois.push({
    id: 'added-b', guid: 'added-b', title: '新規B',
    lat: 35.6818, lng: 139.7672, role: 'added', layer: 'new-pokestop',
    gameEntity: 'POKESTOP', description: ''
  });
});
expectStale('POI delete', project => {
  project.currentPois.splice(0, 1);
});
expectStale('POI move', project => {
  project.currentPois[1].lat += 0.0001;
});
expectStale('POI type change', project => {
  project.currentPois[1].gameEntity = 'GYM';
  project.currentPois[1].layer = 'new-gym';
});
expectStale('POI comment change', project => {
  project.currentPois[1].description = '現地確認済み・動線注意';
});
expectStale('activity polygon change', project => {
  project.polygon[2][0] += 0.0002;
});
expectStale('POI title change', project => {
  project.currentPois[1].title = '新規A 改称';
});

// 50/40/30m circle visibility is presentation only. It must not invalidate distance results.
expectFresh('circle radius display change', project => {
  project.circleRadii = [50];
});

// Conservative rule: once a creative edit invalidates a check, only a new distance check clears stale.
{
  const project = checkedProject();
  const original = clone(project.currentPois);
  project.currentPois[1].lat += 0.0001;
  runtimeContext.campsProjectMarkDistanceStale(project);
  project.currentPois = original;
  runtimeContext.campsProjectMarkDistanceStale(project);
  assert.equal(project.distanceResult.stale, true, 'Reverting a creative edit must not resurrect an old distance result');
}

assert.ok(distanceProject.includes('designSignature: buildDesignSignature(project)'), 'Distance result must persist the checked design signature');
assert.ok(distanceProject.includes('stale: false'), 'A fresh distance check must clear stale state');
assert.ok(distanceProject.includes('CREATIVE MODEで設計が変更されています。距離チェックを再実行してください。'), 'Distance page must show the rerun warning');
assert.ok(distanceProject.includes("latest?.distanceResult?.stale === true"), 'Pre-submit navigation must reject stale distance results');

assert.ok(distanceBackup.includes('💾 セーブする'), 'Distance backup action must remain available');
assert.ok(distanceBackup.includes("zip.file('campsite-project.json'"), 'Backup KMZ must embed the Campsite Project payload');
assert.ok(distanceBackup.includes('saveBackupKmz'), 'Distance backup must expose the KMZ save action');

assert.ok(commentGate.includes("project?.distanceResult?.stale === true"), 'Comment gate must yield to stale-distance rerun handling');

console.log('distance stale invalidation check: ok');
