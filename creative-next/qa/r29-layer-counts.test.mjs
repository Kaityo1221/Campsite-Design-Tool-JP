import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGINAL_LAYER_GROUPS,countOriginalLayerRecords} from '../integration/original-layer-counts.mjs';

const n=(id,role,kind,deleted=false)=>({id,role,kind,deleted});

test('r29 keeps the six production layer groups and unchanged order',()=>{
 assert.deepEqual(ORIGINAL_LAYER_GROUPS.map(([key])=>key),[
  'existing-pokestop','existing-gym','existing-power',
  'new-pokestop','new-gym','new-power'
 ]);
});

test('new POI add, kind change, delete and undo/redo projections stay in sync',()=>{
 const original=n('old','existing','pokestop');
 const fresh=n('new','new','pokestop');
 const records=[original,fresh];
 const counts=()=>countOriginalLayerRecords(records);
 assert.equal(counts().get('new-pokestop'),1);
 assert.equal(counts().get('existing-pokestop'),1);
 // Same values seen after a confirmed kind change.
 fresh.kind='gym';
 assert.equal(counts().get('new-pokestop'),0);
 assert.equal(counts().get('new-gym'),1);
 // Delete removes only live count, undo restores, redo removes.
 fresh.deleted=true;
 assert.equal(counts().get('new-gym'),0);
 fresh.deleted=false;
 assert.equal(counts().get('new-gym'),1);
 fresh.deleted=true;
 assert.equal(counts().get('new-gym'),0);
 assert.equal(counts().get('existing-pokestop'),1);
});

test('read-only counts reject unknown/deleted entries and never mutate editor records',()=>{
 const records=[n('a','new','power'),n('b','existing','gym'),n('c','new','gym',true),
  n('d','unknown','gym'),null,n('e','new','unknown')];
 const before=JSON.stringify(records);
 const counts=countOriginalLayerRecords(records);
 assert.equal(counts.get('new-power'),1);
 assert.equal(counts.get('existing-gym'),1);
 assert.equal(counts.get('new-gym'),0);
 assert.equal(JSON.stringify(records),before);
 assert.equal([...counts.values()].reduce((a,b)=>a+b,0),2);
});

test('empty or unavailable snapshots always yield zero without throwing',()=>{
 for(const records of [undefined,null,{},[]]){
  const counts=countOriginalLayerRecords(records);
  assert.equal([...counts.values()].reduce((a,b)=>a+b,0),0);
 }
});
