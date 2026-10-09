import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createStrictIndexedCheckpoint} from '../../phase-2-preview/strict-idb-checkpoint.mjs';
const fakeDB={open(){throw Error('should never open in preflight')}};
test('strict checkpoint requires native IndexedDB and crypto, never silently downgrades',()=>{
 assert.throws(()=>createStrictIndexedCheckpoint({indexedDB:null,subtle:webcrypto.subtle}),e=>e.code==='IDB_UNAVAILABLE');
 assert.throws(()=>createStrictIndexedCheckpoint({indexedDB:fakeDB,subtle:null}),e=>e.code==='IDB_UNAVAILABLE');
});
test('strict checkpoint isolates namespaces and rejects malformed configuration',()=>{
 for(const ns of ['next-lab-creative-v7','', '../v1','foo'])
  assert.throws(()=>createStrictIndexedCheckpoint({indexedDB:fakeDB,subtle:webcrypto.subtle,namespace:ns}),e=>e.code==='IDB_NAMESPACE');
});
test('strict checkpoint refuses writes without observed revisions or valid document before touching database',async()=>{
 const j=createStrictIndexedCheckpoint({indexedDB:fakeDB,subtle:webcrypto.subtle});
 await assert.rejects(j.save({records:[],activityAreas:[]}),e=>e.code==='IDB_REVISION_REQUIRED');
 await assert.rejects(j.save({records:[],activityAreas:[]},{expectedRevision:-1}),e=>e.code==='IDB_REVISION_REQUIRED');
 await assert.rejects(j.save({records:[]},{expectedRevision:null}),e=>e.code==='IDB_INVALID');
});
