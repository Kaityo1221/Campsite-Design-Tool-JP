import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wayfarer-acquisition-engine.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wayfarer-acquisition-engine.js' });

const window = {};
const context = vm.createContext({
  window,
  console,
  Math,
  Number,
  String,
  Array,
  Object,
  Set,
  Error,
  Promise
});
vm.runInContext(source, context, { filename: 'bridge-pc/wayfarer-acquisition-engine.js' });

const api = window.CampsiteWayfarerAcquisitionEngine;
assert.ok(api, 'WM-1 acquisition engine missing');
assert.equal(api.version, '0.1.0');
assert.equal(api.defaultBufferMeters, 200);
assert.equal(api.defaultCellLevel, 14);
assert.equal(api.maxPolygonVertices, 30);

const polygon = [
  [35.6812, 139.7671],
  [35.6812, 139.7791],
  [35.6912, 139.7791],
  [35.6912, 139.7671]
];

const planA = api.createPlan(polygon, { bufferMeters: 200 });
const planB = api.createPlan(polygon, { bufferMeters: 200, zoom: 12 });
const planC = api.createPlan(polygon, { bufferMeters: 200, zoom: 19 });

assert.equal(planA.tiles.length, 1, 'No split should occur unless a tile threshold is configured');
assert.equal(planA.tiles[0].query, planB.tiles[0].query, 'Wayfarer zoom must not affect polygon acquisition query');
assert.equal(planA.tiles[0].query, planC.tiles[0].query, 'Wayfarer zoom must not affect polygon acquisition query');
assert.equal(planA.tiles[0].query.includes('zoom='), false, 'GCS acquisition query must not include zoom');
assert.ok(planA.acquisitionBounds.south < planA.sourceBounds.south);
assert.ok(planA.acquisitionBounds.west < planA.sourceBounds.west);
assert.ok(planA.acquisitionBounds.north > planA.sourceBounds.north);
assert.ok(planA.acquisitionBounds.east > planA.sourceBounds.east);

const splitPlan = api.createPlan(polygon, {
  bufferMeters: 200,
  maxTileMeters: 500
});
assert.ok(splitPlan.tiles.length > 1, 'Configured max tile size must partition a large acquisition area');
assert.equal(splitPlan.tiles.length, splitPlan.rows * splitPlan.columns);
assert.equal(splitPlan.tiles[0].query.includes('cellLevel=14'), true);

const south = Math.min(...splitPlan.tiles.map(tile => tile.south));
const west = Math.min(...splitPlan.tiles.map(tile => tile.west));
const north = Math.max(...splitPlan.tiles.map(tile => tile.north));
const east = Math.max(...splitPlan.tiles.map(tile => tile.east));
assert.ok(Math.abs(south - splitPlan.acquisitionBounds.south) < 1e-12);
assert.ok(Math.abs(west - splitPlan.acquisitionBounds.west) < 1e-12);
assert.ok(Math.abs(north - splitPlan.acquisitionBounds.north) < 1e-12);
assert.ok(Math.abs(east - splitPlan.acquisitionBounds.east) < 1e-12);

const requested = [];
const unverified = await api.executePlan(splitPlan, async tile => {
  requested.push(tile.id);
  return { result: { data: [{ pois: [{ poiId: 'shared-' + tile.id }] }] } };
});
assert.equal(requested.length, splitPlan.tiles.length);
assert.equal(unverified.geometryCoverageComplete, true);
assert.equal(unverified.transportComplete, true);
assert.equal(unverified.sourceComplete, null);
assert.equal(unverified.coverageComplete, false);
assert.equal(unverified.coverageStatus, 'unverified');
assert.equal(unverified.payloads.length, splitPlan.tiles.length);

const verified = await api.executePlan(
  splitPlan,
  async tile => ({ result: { data: [{ pois: [{ poiId: 'verified-' + tile.id }] }] } }),
  { responseVerifier: () => true }
);
assert.equal(verified.transportComplete, true);
assert.equal(verified.sourceComplete, true);
assert.equal(verified.coverageComplete, true);
assert.equal(verified.coverageStatus, 'complete');

let failedOnce = false;
const incomplete = await api.executePlan(
  splitPlan,
  async tile => {
    if (!failedOnce) {
      failedOnce = true;
      throw new Error('synthetic GCS failure');
    }
    return { result: { data: [{ pois: [{ poiId: 'ok-' + tile.id }] }] } };
  },
  { responseVerifier: () => true }
);
assert.equal(incomplete.transportComplete, false);
assert.equal(incomplete.coverageComplete, false);
assert.equal(incomplete.coverageStatus, 'incomplete');
assert.ok(incomplete.results.some(result => result.ok === false));

const comparison = api.compareGuidSets(
  [{ guid: 'a' }, { guid: 'b' }, { guid: 'b' }],
  [{ poiId: 'b' }, { poiId: 'a' }]
);
assert.equal(comparison.equal, true);
assert.deepEqual([...comparison.onlyLeft], []);
assert.deepEqual([...comparison.onlyRight], []);

const mismatch = api.compareGuidSets(
  [{ guid: 'a' }, { guid: 'b' }],
  [{ guid: 'b' }, { guid: 'c' }]
);
assert.equal(mismatch.equal, false);
assert.deepEqual([...mismatch.onlyLeft], ['a']);
assert.deepEqual([...mismatch.onlyRight], ['c']);

assert.throws(
  () => api.createPlan([[35, 139], [35.1, 139.1]]),
  /at least 3/
);
assert.throws(
  () => api.createPlan(Array.from({ length: 31 }, (_, index) => [35 + index * 0.00001, 139])),
  /30 vertices/
);

console.log('WM-1 Wayfarer acquisition engine planning/completeness contract: OK');
