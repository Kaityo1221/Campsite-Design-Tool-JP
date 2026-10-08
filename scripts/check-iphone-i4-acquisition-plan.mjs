import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// I4-4 test-only: run the actual PC acquisition engine in a sandbox.
// No network requests, no runtime modifications, no production handoff.
const source = fs.readFileSync('bridge-pc/wayfarer-acquisition-engine.js', 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { filename: 'wayfarer-acquisition-engine.js' });
const engine = context.window.CampsiteWayfarerAcquisitionEngine;
assert.ok(engine);

const polygon = [
  { lat: 35.6500, lng: 139.7500 },
  { lat: 35.6500, lng: 139.7610 },
  { lat: 35.6570, lng: 139.7610 },
  { lat: 35.6570, lng: 139.7500 }
];
const options = { bufferMeters: 200, maxTileMeters: 500, cellLevel: 14 };
const plan = engine.createPlan(polygon, options);
assert.equal(plan.bufferMeters, 200);
assert.equal(plan.maxTileMeters, 500);
assert.equal(plan.cellLevel, 14);
assert.ok(plan.tiles.length > 1);
assert.equal(plan.tiles.length, plan.rows * plan.columns);
assert.ok(plan.acquisitionBounds.south < plan.sourceBounds.south);
assert.ok(plan.acquisitionBounds.north > plan.sourceBounds.north);
assert.ok(plan.acquisitionBounds.west < plan.sourceBounds.west);
assert.ok(plan.acquisitionBounds.east > plan.sourceBounds.east);
assert.ok(plan.tiles.every(tile => tile.query.includes('&cellLevel=14')));
assert.ok(plan.tiles.every(tile => {
  const size = engine.boundsSizeMeters(tile);
  return size.width <= 501 && size.height <= 501;
}));

// Plan is independent of Wayfarer viewport/zoom and deterministic.
const again = engine.createPlan(polygon.map(p => ({ ...p })), options);
assert.equal(JSON.stringify(plan.tiles), JSON.stringify(again.tiles));

const requested = [];
const unverified = await engine.executePlan(plan, async tile => {
  requested.push(tile.id);
  return { items: [{ guid: 'shared' }, { guid: 'unique-' + tile.id }] };
});
assert.equal(requested.length, plan.tiles.length);
assert.equal(new Set(requested).size, plan.tiles.length);
assert.equal(unverified.transportComplete, true);
assert.equal(unverified.sourceComplete, null);
assert.equal(unverified.coverageComplete, false);
assert.equal(unverified.coverageStatus, 'unverified');
const uniqueGuids = engine.guidSet(unverified.payloads.flatMap(payload => payload.items));
assert.equal(uniqueGuids.length, plan.tiles.length + 1);

let failed = false;
const partial = await engine.executePlan(plan, async tile => {
  if (!failed) { failed = true; throw new Error('synthetic tile failure'); }
  return { items: [{ guid: tile.id }] };
});
assert.equal(partial.transportComplete, false);
assert.equal(partial.coverageComplete, false);
assert.equal(partial.coverageStatus, 'incomplete');
assert.ok(partial.results.some(tile => !tile.ok));

const invalidSource = await engine.executePlan(plan, async tile => ({ tile: tile.id }), {
  responseVerifier: () => null
});
assert.equal(invalidSource.sourceComplete, null);
assert.equal(invalidSource.coverageComplete, false);

console.log('I4-4 PASS: 200m buffer, <=500m tiles, deterministic plan, sequential requests, GUID dedup, incomplete/unverified gates');
console.log('I4-4 test tiles:', plan.tiles.length);
