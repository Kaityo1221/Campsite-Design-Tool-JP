import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wayfarer-observation-zone.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wayfarer-observation-zone.js' });

const fakeWindow = { __campsiteWayfarerObservationZoneInstalled: false };
const context = vm.createContext({ window: fakeWindow, console, Math, Number, String, Array, Object, Set, Error, Infinity });
vm.runInContext(source, context);

const api = fakeWindow.CampsiteWayfarerObservationZone;
assert.ok(api, 'WM-3 observation zone API missing');

const polygon = [
  [35.0000, 139.0000],
  [35.0000, 139.0020],
  [35.0020, 139.0020],
  [35.0020, 139.0000]
];

assert.equal(api.classifyPoint([35.0010, 139.0010], polygon).zone, 'INTERIOR');
assert.equal(api.classifyPoint([35.0010, 138.9995], polygon).zone, 'REFERENCE_100');
assert.equal(api.classifyPoint([35.0010, 138.9985], polygon).zone, 'RESERVE_200');
assert.equal(api.classifyPoint([35.0010, 138.9970], polygon).zone, 'OUTSIDE');

const pois = [
  { guid:'stop-in', lat:35.0010, lng:139.0010, poiKind:'POKESTOP', gameStatus:'ACTIVE' },
  { guid:'gym-ref', lat:35.0010, lng:138.9995, poiKind:'GYM', gameStatus:'ACTIVE' },
  { guid:'ps-reserve', lat:35.0010, lng:138.9985, poiKind:'POWERSPOT', gameStatus:'ACTIVE' },
  { guid:'ips-in', lat:35.0012, lng:139.0011, poiKind:'NOT_IN_GAME', gameEntity:'POWERSPOT', gameStatus:'INACTIVE', referenceKind:'INACTIVE_POWERSPOT' },
  { guid:'not-game', lat:35.0013, lng:139.0012, poiKind:'NOT_IN_GAME', gameStatus:'UNKNOWN', referenceKind:'NOT_IN_GAME' }
];

const result = api.classifyPois(polygon, pois);
assert.equal(result.counts.interior.pokestop, 1);
assert.equal(result.counts.interior.inactivePowerSpot, 1);
assert.equal(result.counts.reference100.gym, 1);
assert.equal(result.counts.reserve200.activePowerSpot, 1);
assert.equal(result.visibleTotal, 3);
assert.equal(result.retainedTotal, 4);
assert.equal(result.excludedCount, 1);

console.log('WM-3 observation zone classification: OK');