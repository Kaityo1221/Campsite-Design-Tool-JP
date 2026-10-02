import assert from 'node:assert/strict';
import { createHarness, makeProject } from './wm3b2d-pseudo-harness.mjs';

const project = makeProject();
const protectedBefore = JSON.parse(JSON.stringify({
  schemaVersion:project.schemaVersion,
  sourcePois:project.sourcePois,
  polygon:project.polygon,
  selectedPois:project.selectedPois,
  circleRadii:project.circleRadii,
  edits:project.edits,
  currentPois:project.currentPois,
  addedPois:project.addedPois,
  deletedPois:project.deletedPois,
  distanceResult:project.distanceResult,
  meta:project.meta,
  unknownFutureField:project.unknownFutureField
}));

const h = createHarness({ project });
const connected = await h.connect();
assert.equal(connected.connected, true);
assert.equal(connected.status, 'success');

const observed = await h.observe();
assert.equal(observed.status, 'success');
assert.equal(observed.connected, true);

const saved = h.sessionStorage.dump();
assert.ok(saved.wayfarerObservation, 'wayfarerObservation must be saved');
assert.equal(saved.wayfarerObservation.zones.interior.length, 1);
assert.equal(saved.wayfarerObservation.zones.reference100.length, 1);
assert.equal(saved.wayfarerObservation.zones.reserve200.length, 1);
assert.equal(saved.wayfarerObservation.visibleTotal, 2);
assert.equal(saved.wayfarerObservation.retainedTotal, 3);
assert.equal(saved.wayfarerObservation.acquisition.coverageStatus, 'complete');

const protectedAfter = {
  schemaVersion:saved.schemaVersion,
  sourcePois:saved.sourcePois,
  polygon:saved.polygon,
  selectedPois:saved.selectedPois,
  circleRadii:saved.circleRadii,
  edits:saved.edits,
  currentPois:saved.currentPois,
  addedPois:saved.addedPois,
  deletedPois:saved.deletedPois,
  distanceResult:saved.distanceResult,
  meta:saved.meta,
  unknownFutureField:saved.unknownFutureField
};
assert.deepEqual(protectedAfter, protectedBefore, 'observation roundtrip must not mutate Project editing state');

console.log('WM-3B-2D pseudo full E2E: Creative -> extension relay -> Wayfarer controller -> RESULT -> Project save: OK');
