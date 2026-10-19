// Isolated forensic audit, NOT an Android release test. Does not build or install XPI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const n4 = fs.readFileSync('bridge-android-n4/wayfarer-acquisition-coordinator.js', 'utf8');
const build = fs.readFileSync('scripts/build-android-bridge-0.3.7-unsigned.mjs', 'utf8');
const pcEngine = fs.readFileSync('bridge-pc/wayfarer-acquisition-engine.js', 'utf8');
const pcZone = fs.readFileSync('bridge-pc/wayfarer-observation-zone.js', 'utf8');
const report = fs.readFileSync('docs/n4-pc-contract-delta-audit-2026-10-19.md', 'utf8');

for (const source of [n4, pcEngine, pcZone]) new vm.Script(source);
for (const name of [
  'wayfarer-polygon-controller.js',
  'polygon-ui.js',
  'wayfarer-acquisition-engine.js',
  'wayfarer-observation-zone.js'
]) assert.ok(build.includes(name), 'N4 shared module missing: ' + name);

assert.match(n4, /const BUFFER_METERS = 200;/, 'N4 200m acquisition missing');
assert.match(n4, /engine\.createPlan\(polygon, \{ bufferMeters: BUFFER_METERS, cellLevel: CELL_LEVEL \}\)/,
  'Expected R02 500m tile omission was changed; re-audit');
assert.match(n4, /return Boolean\(payload\?\.bodyText && covers\(tile, parseBoundsFromUrl\(payload\?\.url\)\)\);/,
  'Expected R03 semantic-verification gap changed; re-audit');
assert.match(n4, /latestPois = data\.pois\.filter\(poi => poi\?\.guid\)\.map\(poi => \(\{ \.\.\.poi \}\)\);/,
  'Expected R05 last-state-only POI collection changed; re-audit');
assert.match(n4, /canProceed: acquisition\?\.coverageComplete === true/,
  'Expected F05 empty result readiness changed; re-audit');
assert.match(n4, /lastCompletedSignature = signature;[\s\S]{0,150}lastObservation = null;[\s\S]{0,100}acquire\(state\.points\)\.catch/,
  'Expected F04 retry lock changed; re-audit');
for (const key of ['engineVersion', 'acquisitionBounds', 'tileCount', 'sourceComplete', 'transportComplete', 'coverageStatus']) {
  assert.ok(!n4.slice(n4.indexOf('acquisition: Object.freeze({'), n4.indexOf('acquisition: Object.freeze({') + 180).includes(key),
    'Expected missing Android observation metadata key was changed: ' + key);
}
for (const label of ['R02', 'R03', 'R05', 'R07', 'F04', 'F05']) {
  assert.ok(report.includes(label), 'Audit report lacks gap: ' + label);
}

// Run the real Android coordinator with a fully synthetic map/engine. Only the
// responseVerifier callback is real. A matching URL + nonempty *invalid* body
// currently produces a true verdict. This is the exact fail-open condition.
function fakeHarness(fail = false) {
  const handlers = new Map();
  const stats = { planOptions: null, verifierVerdict: null, calls: 0, classifiedPois: null };
  const map = {
    getCenter: () => ({ lat: () => 35.01, lng: () => 139.01 }),
    getZoom: () => 14,
    fitBounds: () => {},
    setCenter: () => {},
    setZoom: () => {}
  };
  const tile = { id: 'T1', north: 35.02, east: 139.02, south: 35, west: 139 };
  const fakeResponse = {
    url: 'https://wayfarer.scopely.com/api/v1/vault/mapview/gcs?ne=(35.02,139.02)&sw=(35,139)&cellLevel=14',
    bodyText: '<html>error: malformed response</html>'
  };
  const w = {
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    addEventListener(type, fn) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      handlers.set(type, (handlers.get(type) || []).filter(x => x !== fn));
    },
    dispatchEvent(event) {
      for (const callback of handlers.get(event.type) || []) callback(event);
      return true;
    },
    postMessage() {},
    CampsiteBridgeWayfarerMapAdapter: { findMap: () => map },
    CampsiteWayfarerObservationZone: {
      classifyPois(points, pois) {
        stats.classifiedPois = pois;
        const empty = { pokestop: 0, gym: 0, activePowerSpot: 0, inactivePowerSpot: 0, total: 0 };
        return {
          polygon: points, zones: { interior: [], reference100: [], reserve200: [] },
          counts: { interior: empty, reference100: empty, reserve200: empty },
          visibleTotal: 0, retainedTotal: 0, excludedCount: 0, outsideCount: 0
        };
      }
    },
    CampsiteWayfarerAcquisitionEngine: {
      createPlan(polygon, opts) {
        stats.planOptions = { ...opts };
        return { polygon, bufferMeters: opts.bufferMeters, cellLevel: opts.cellLevel, tiles: [tile] };
      },
      async executePlan(plan, requestTile, options) {
        stats.calls++;
        if (fail) throw new Error('simulated transport failure');
        stats.verifierVerdict = options.responseVerifier(fakeResponse, tile);
        return {
          coverageComplete: stats.verifierVerdict === true,
          transportComplete: true,
          sourceComplete: stats.verifierVerdict,
          geometryCoverageComplete: true,
          observedAt: '2026-10-19T00:00:00Z'
        };
      }
    }
  };
  class SyntheticEvent {
    constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
  }
  const context = vm.createContext({
    window: w,
    document: {},
    location: { href: 'https://wayfarer.scopely.com/', origin: 'https://wayfarer.scopely.com' },
    CustomEvent: SyntheticEvent,
    URL,
    console
  });
  vm.runInContext(n4, context);
  return { w, stats, SyntheticEvent };
}

const polygon = [[35,139],[35.01,139],[35.01,139.01]];
const h = fakeHarness();
h.w.dispatchEvent({ type: 'message', source: h.w, data: {
  source: 'CAMPSITE_BRIDGE_ANDROID_M24_UI', type: 'SYNC_STATE', pois: [{ guid:'old-poi' }]
}});
h.w.dispatchEvent({ type: 'message', source: h.w, data: {
  source: 'CAMPSITE_BRIDGE_ANDROID_M24_UI', type: 'SYNC_STATE', pois: [{ guid:'last-poi' }]
}});
await h.w.CampsiteBridgeAndroidN4Acquisition.acquire(polygon);
assert.equal(h.stats.planOptions.maxTileMeters, undefined,
  'R02 is not reproduced: 500m option is now present');
assert.equal(h.stats.verifierVerdict, true,
  'R03 is not reproduced: invalid body was correctly rejected');
assert.deepEqual(h.stats.classifiedPois.map(p => p.guid), ['last-poi'],
  'R05 is not reproduced: latest SYNC_STATE no longer overwrites prior data');
assert.equal(h.w.CampsiteBridgeAndroidN4Acquisition.getObservation().canProceed, true,
  'F05 is not reproduced: empty observation no longer proceeds');

const failed = fakeHarness(true);
const completedState = { type: 'campsite-bridge-android-n4:polygon-state',
  detail: JSON.stringify({ points: polygon, completed: true, active: false }) };
failed.w.dispatchEvent(completedState);
await new Promise(resolve => setTimeout(resolve, 0));
failed.w.dispatchEvent(completedState);
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(failed.stats.calls, 1,
  'F04 is not reproduced: same polygon now retries after error');

console.log('AUDIT REPRODUCED: R02, R03, R05, F04, F05 + R07 metadata gap.');
console.log('HOLD: this is evidence of missing safety controls, NOT a passing N4 release gate.');
