import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
const context = {window, Object, String, Number, Math};
vm.createContext(context);
new vm.Script(
  fs.readFileSync(new URL('../creative/runtime/map-engine/wayfarer-observation-diff-state.js', import.meta.url), 'utf8'),
  {filename:'wayfarer-observation-diff-state.js'}
).runInContext(context);

const persist = window.bridgeMapLab_persistWayfarerObservationDiffState;
const read = window.bridgeMapLab_readWayfarerObservationDiffState;
assert.equal(typeof persist, 'function');
assert.equal(typeof read, 'function');

const project = {
  schemaVersion:'1.0',
  source:'bridge',
  projectId:'project-1',
  polygon:[[35,139],[35.01,139],[35,139.01]],
  currentPois:[{guid:'editable',title:'Editable'}],
  wayfarerObservation:{snapshotId:'base-1',future:{keep:true}},
  futureTopLevel:{keep:'yes'}
};
const before = JSON.stringify(project);

const diff = {
  canApply:true,
  remoteComplete:true,
  baseSnapshotId:'base-1',
  remoteSnapshotId:'remote-1',
  nextAbsenceCounts:{missing:1,restored:0,bad:'x'}
};
const saved = persist(project, diff);
assert.equal(saved.canPersist, true);
assert.equal(saved.reason, 'STATE_READY');
assert.equal(saved.project.schemaVersion, '1.0');
assert.equal(saved.project.wayfarerObservation, project.wayfarerObservation);
assert.equal(saved.project.currentPois, project.currentPois);
assert.equal(saved.project.polygon, project.polygon);
assert.equal(saved.project.futureTopLevel, project.futureTopLevel);
assert.equal(saved.state.baseSnapshotId, 'base-1');
assert.equal(saved.state.lastRemoteSnapshotId, 'remote-1');
assert.deepEqual(JSON.parse(JSON.stringify(saved.state.absenceCounts)), {missing:1});
assert.equal(JSON.stringify(project), before, 'Source Project must remain byte-equivalent');

const roundTrip = JSON.parse(JSON.stringify(saved.project));
const restored = read(roundTrip);
assert.equal(restored.baseSnapshotId, 'base-1');
assert.equal(restored.lastRemoteSnapshotId, 'remote-1');
assert.deepEqual(JSON.parse(JSON.stringify(restored.absenceCounts)), {missing:1});

const second = persist(roundTrip, {
  canApply:true,
  remoteComplete:true,
  baseSnapshotId:'remote-1',
  remoteSnapshotId:'remote-2',
  nextAbsenceCounts:{missing:2,newMissing:1}
});
assert.deepEqual(JSON.parse(JSON.stringify(second.state.absenceCounts)), {missing:2,newMissing:1});

const reappeared = persist(second.project, {
  canApply:true,
  remoteComplete:true,
  baseSnapshotId:'remote-2',
  remoteSnapshotId:'remote-3',
  nextAbsenceCounts:{}
});
assert.deepEqual(JSON.parse(JSON.stringify(reappeared.state.absenceCounts)), {});

const incomplete = persist(saved.project, {
  canApply:false,
  remoteComplete:false,
  reason:'REMOTE_INCOMPLETE',
  baseSnapshotId:'base-1',
  remoteSnapshotId:'remote-incomplete',
  nextAbsenceCounts:{missing:2}
});
assert.equal(incomplete.canPersist, false);
assert.equal(incomplete.project, saved.project);
assert.equal(JSON.stringify(incomplete.project), JSON.stringify(saved.project));

const missingId = persist(saved.project, {
  canApply:true, remoteComplete:true, baseSnapshotId:'base-1', remoteSnapshotId:'', nextAbsenceCounts:{missing:2}
});
assert.equal(missingId.canPersist, false);
assert.equal(missingId.reason, 'SNAPSHOT_ID_MISSING');

assert.equal(Object.prototype.hasOwnProperty.call(project,'wayfarerObservationDiffState'), false);
console.log('WM-7C Wayfarer diff-state persistence: PASS');
