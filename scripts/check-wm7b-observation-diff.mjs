import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
const context = { window, console, Object, Array, String, Number, Math, Map, Set, structuredClone };
vm.createContext(context);
new vm.Script(
  fs.readFileSync(new URL('../creative/runtime/map-engine/wayfarer-observation-diff.js', import.meta.url), 'utf8'),
  { filename:'wayfarer-observation-diff.js' }
).runInContext(context);

const diff = window.bridgeMapLab_diffWayfarerObservations;
assert.equal(typeof diff, 'function');

const base = {
  snapshotId:'base-1',
  acquisition:{coverageComplete:true},
  zones:{
    interior:[
      {guid:'same',title:'Same',lat:35,lng:139,gameEntity:'POKESTOP',gameStatus:'ACTIVE',future:{keep:true}},
      {guid:'changed',title:'Old Name',lat:35.001,lng:139.001,gameEntity:'POKESTOP',gameStatus:'ACTIVE'},
      {guid:'missing',title:'Missing',lat:35.002,lng:139.002,gameEntity:'GYM',gameStatus:'ACTIVE'}
    ],
    reference100:[],
    reserve200:[
      {guid:'reserve-same',title:'Reserve',lat:35.003,lng:139.003,gameEntity:'POWERSPOT',gameStatus:'INACTIVE'}
    ]
  }
};

const remote = {
  snapshotId:'remote-1',
  acquisition:{coverageComplete:true,transportComplete:true},
  zones:{
    interior:[
      {guid:'same',title:'Same',lat:35,lng:139,gameEntity:'POKESTOP',gameStatus:'ACTIVE',future:{other:'field'}},
      {guid:'changed',title:'New Name',lat:35.00102,lng:139.00102,gameEntity:'GYM',gameStatus:'INACTIVE'},
      {guid:'new-one',title:'New POI',lat:35.004,lng:139.004,gameEntity:'POKESTOP',gameStatus:'ACTIVE'}
    ],
    reference100:[],
    reserve200:[
      {guid:'reserve-same',title:'Reserve',lat:35.003,lng:139.003,gameEntity:'POWERSPOT',gameStatus:'INACTIVE'}
    ]
  }
};

const baseBefore = JSON.stringify(base);
const remoteBefore = JSON.stringify(remote);

const first = diff(base, remote);
assert.equal(first.canApply, true);
assert.equal(first.reason, 'DIFF_READY');
assert.deepEqual(JSON.parse(JSON.stringify(first.summary)), {added:1,changed:1,unconfirmed:1,deleteCandidates:0});
assert.equal(first.additions[0].guid, 'new-one');
assert.equal(first.absences[0].guid, 'missing');
assert.equal(first.absences[0].count, 1);
assert.equal(first.absences[0].state, 'UNCONFIRMED');
assert.deepEqual(
  [...first.changes[0].categories].sort(),
  ['COORDINATE_CHANGED','STATUS_CHANGED','TITLE_CHANGED','TYPE_CHANGED'].sort()
);
assert.equal(first.nextAbsenceCounts.missing, 1);

const second = diff(base, remote, {absenceCounts:first.nextAbsenceCounts});
assert.equal(second.absences[0].count, 2);
assert.equal(second.absences[0].state, 'DELETE_CANDIDATE');
assert.equal(second.summary.deleteCandidates, 1);

const restoredRemote = structuredClone(remote);
restoredRemote.zones.interior.push({
  guid:'missing',title:'Missing',lat:35.002,lng:139.002,gameEntity:'GYM',gameStatus:'ACTIVE'
});
const restored = diff(base, restoredRemote, {absenceCounts:{missing:4}});
assert.equal(restored.absences.length, 0);
assert.equal(Object.prototype.hasOwnProperty.call(restored.nextAbsenceCounts,'missing'), false);

const incomplete = structuredClone(remote);
incomplete.acquisition.coverageComplete = false;
const blocked = diff(base, incomplete, {absenceCounts:{missing:1}});
assert.equal(blocked.canApply, false);
assert.equal(blocked.reason, 'REMOTE_INCOMPLETE');
assert.equal(blocked.additions.length, 0);
assert.equal(blocked.changes.length, 0);
assert.equal(blocked.absences.length, 0);
assert.equal(blocked.nextAbsenceCounts.missing, 1, 'Incomplete remote must not increment absence');

assert.equal(JSON.stringify(base), baseBefore, 'Base observation must remain byte-equivalent');
assert.equal(JSON.stringify(remote), remoteBefore, 'Remote observation must remain byte-equivalent');

console.log('WM-7A Wayfarer observation diff: PASS');
