import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../creative/runtime/map-engine/wayfarer-observation-adapter.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(source, { window, console, Object, Array, Set, String, Number, TypeError });

const adapt = window.bridgeMapLab_adaptWayfarerObservation;
assert.equal(typeof adapt, 'function', 'WM-3C observation adapter must be exported');

const observation = {
  zones: {
    interior: [
      { guid: 'stop-1', title: 'Inside Stop', lat: 35.0, lng: 139.0, poiKind: 'POKESTOP', gameEntity: 'POKESTOP', gameStatus: 'ACTIVE' },
      { guid: 'gym-1', title: 'Inside Gym', lat: 35.001, lng: 139.001, poiKind: 'GYM', gameEntity: 'GYM', gameStatus: 'ACTIVE' },
      { guid: 'inactive-1', title: 'Inactive PS', lat: 35.002, lng: 139.002, poiKind: 'NOT_IN_GAME', gameEntity: 'POWERSPOT', gameStatus: 'INACTIVE', referenceKind: 'INACTIVE_POWERSPOT' }
    ],
    reference100: [
      { guid: 'power-1', title: 'Outer Power', lat: 35.003, lng: 139.003, poiKind: 'POWERSPOT', gameEntity: 'POWERSPOT', gameStatus: 'ACTIVE' },
      { guid: 'editable-1', title: 'Already Editable', lat: 35.004, lng: 139.004, poiKind: 'POKESTOP', gameEntity: 'POKESTOP', gameStatus: 'ACTIVE' }
    ],
    reserve200: [
      { poiId: 'reserve-1', title: 'Reserve Gym', latitude: 35.005, longitude: 139.005, poiKind: 'GYM', gameEntity: 'GYM', gameStatus: 'ACTIVE' }
    ]
  }
};

const editableRecords = [
  { guid: 'editable-1', id: 'legacy-editable-1', layer: 'existing-pokestop', latlng: [35.004, 139.004] },
  { guid: 'deleted-editable', layer: 'existing-gym', deleted: true, latlng: [35, 139] },
  { id: 'candidate-1', layer: 'new-pokestop', latlng: [35, 139] }
];
const editableSnapshot = JSON.stringify(editableRecords);
const observationSnapshot = JSON.stringify(observation);

const result = adapt(observation, editableRecords);
assert.deepEqual(JSON.parse(JSON.stringify(result.counts)), {
  interior: 3,
  reference100: 2,
  reserve200: 1,
  display: 4,
  retainedReserve: 1,
  suppressedByEditableGuid: 1,
  invalid: 0
});
assert.equal(result.displayPois.length, 4, 'INTERIOR + REFERENCE_100 should be displayable except editable GUID duplicates');
assert.equal(result.reservePois.length, 1, 'RESERVE_200 must be retained separately and not included in displayPois');
assert.equal(result.suppressedByEditableGuid[0]?.guid, 'editable-1', 'Editable existing GUID must win over observation reference');
assert.ok(result.displayPois.every(poi => poi.readOnly === true && poi.source === 'wayfarer-observation'));
assert.deepEqual(new Set(result.displayPois.map(poi => poi.observationZone)), new Set(['INTERIOR', 'REFERENCE_100']));
assert.equal(result.displayPois.find(poi => poi.guid === 'inactive-1')?.renderKind, 'INACTIVE_POWERSPOT');
assert.equal(result.reservePois[0]?.observationZone, 'RESERVE_200');
assert.equal(JSON.stringify(editableRecords), editableSnapshot, 'Adapter must not mutate Creative editable records');
assert.equal(JSON.stringify(observation), observationSnapshot, 'Adapter must not mutate wayfarerObservation');

const malformed = adapt({
  zones: {
    interior: [
      { guid: 'dup', lat: 35, lng: 139, poiKind: 'POKESTOP', gameStatus: 'ACTIVE' },
      { guid: 'bad-coordinate', lat: 999, lng: 139, poiKind: 'GYM', gameStatus: 'ACTIVE' },
      { guid: 'unsupported', lat: 35, lng: 139, poiKind: 'NOT_IN_GAME', gameEntity: '', gameStatus: 'INACTIVE' }
    ],
    reference100: [
      { guid: 'dup', lat: 35.1, lng: 139.1, poiKind: 'GYM', gameStatus: 'ACTIVE' }
    ],
    reserve200: []
  }
}, []);
assert.equal(malformed.displayPois.length, 1);
assert.equal(malformed.counts.invalid, 3);
assert.deepEqual(new Set(malformed.diagnostics.map(item => item.code)), new Set(['DUPLICATE_GUID', 'INVALID_COORDINATE', 'UNSUPPORTED_POI_STATE']));

assert.throws(() => adapt(null, []), /wayfarerObservation must be an object/);
assert.throws(() => adapt({ zones: { interior: [], reference100: [] } }, []), /reserve200 must be an array/);

console.log('WM-3C-1 Reference Adapter: PASS');
