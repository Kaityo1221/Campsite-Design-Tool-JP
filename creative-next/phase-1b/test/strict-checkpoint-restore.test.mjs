import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
function makeSession(){const map=new Map();const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};return {session:createIsolatedEditorSession({storage,cryptoProvider:webcrypto,JSZip:null,DOMParser:null,XMLSerializer:null}),map};}
test('strict checkpoint recovery is never an automatic operation',async()=>{
 const {session,map}=makeSession();
 await assert.rejects(session.restoreStrictCheckpoint({checkpointSnapshot:{reviewOnly:true},confirmed:false}),e=>e.code==='SAVE_CONFIRM_REQUIRED');
 assert.equal((await session.inspectDraft()).status,'EMPTY');assert.equal(map.size,0);
});
test('strict checkpoint recovery rejects unverified/malformed original archive before journal write',async()=>{
 const {session,map}=makeSession();
 await assert.rejects(session.restoreStrictCheckpoint({checkpointSnapshot:{reviewOnly:true,sourceArchiveBase64:'!!!'},confirmed:true}),e=>e.code==='DRAFT_SOURCE');
 assert.equal((await session.inspectDraft()).status,'EMPTY');assert.equal(map.size,0);
});
test('strict checkpoint recovery rejects untrusted document before journal write',async()=>{
 const {session,map}=makeSession();
 await assert.rejects(session.restoreStrictCheckpoint({checkpointSnapshot:{records:[],activityAreas:[]},confirmed:true}),e=>e.code==='DRAFT_MISMATCH');
 assert.equal((await session.inspectDraft()).status,'EMPTY');assert.equal(map.size,0);
});
