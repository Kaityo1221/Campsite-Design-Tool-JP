import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
const deps={JSZip,DOMParser,XMLSerializer};
const rec=(id='e1',role='existing')=>({id,role,kind:'pokestop',title:'地域 '+id,memo:'旧メモ',lat:35.6420300,lng:139.8555630,deleted:false});
const state=records=>({records,activityAreas:[]});
const storage=()=>{const m=new Map([['next-lab-creative-v7','LEGACY_UNTOUCHED']]);return{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),dump:()=>new Map(m)};};
const build=async(records=[rec()])=>(await createFreshV1Kmz(state(records),deps)).bytes;
const session=(s=storage())=>createIsolatedEditorSession({...deps,storage:s});
const confirmed=async(x,bytes)=>{const prep=await x.prepare(bytes);assert.equal(prep.status,'REVIEW');assert.equal(prep.canApply,false);assert.equal(x.acceptPrepared({confirmed:false}).applied,false);assert.equal(x.acceptPrepared({confirmed:true}).applied,true);};

test('no import without confirmed review and no storage mutation during preparation',async()=>{
 const s=storage(),x=session(s),bytes=await build();const before=s.dump();const info=await x.prepare(bytes);
 assert.equal(info.status,'REVIEW');assert.equal(x.state().hasActive,false);assert.equal(x.state().hasPending,true);
 assert.deepEqual(s.dump(),before);assert.equal(x.acceptPrepared({confirmed:false}).applied,false);assert.equal(x.state().hasActive,false);
});
test('explicit approval creates isolated editor with empty undo / redo history',async()=>{
 const x=session();await confirmed(x,await build([rec('a'),rec('b','new')]));
 assert.equal(x.state().records.length,2);assert.deepEqual(x.state().history,{undo:0,redo:0});
});
test('edit memo -> undo -> redo -> export -> KML reimport preserves identity',async()=>{
 const x=session();await confirmed(x,await build());const id='e1';
 const res=x.command({type:'edit',id,patch:{memo:'編集メモ'}},{confirmed:true});assert.equal(res.ok,true);
 assert.equal(x.state().records[0].memo,'編集メモ');assert.equal(x.undo().ok,true);assert.equal(x.state().records[0].memo,'旧メモ');
 assert.equal(x.redo().ok,true);const output=await x.exportKmz();const stage=await stageKmlInput(output.bytes,deps);assert.equal(diagnoseKmzCandidate(stage).disposition,'READY');
 assert.equal(stage.places.find(p=>p.geometry==='Point').description,'編集メモ');assert.equal(stage.places.find(p=>p.geometry==='Point').coordinates,'139.855563,35.64203');
});
test('existing POI move is denied without changes to store',async()=>{
 const x=session();await confirmed(x,await build());const before=x.state().records;
 const r=x.command({type:'move',id:'e1',lat:35.7,lng:139.8},{confirmed:true});assert.equal(r.ok,false);
 assert.deepEqual(x.state().records,before);
});
test('new POI move is supported on sources with no attached circles',async()=>{
 const x=session();await confirmed(x,await build([rec('n','new')]));
 const r=x.command({type:'move',id:'n',lat:35.645,lng:139.854},{confirmed:true});assert.equal(r.ok,true);
 const output=await x.exportKmz();const stage=await stageKmlInput(output.bytes,deps);
 assert.equal(stage.places[0].coordinates,'139.854,35.645');
});
test('adding to already-imported KMZ is blocked without changing the store',async()=>{
 const x=session();await confirmed(x,await build());const before=x.state().records;
 assert.throws(()=>x.command({type:'add',poi:rec('n','new')},{confirmed:true}),e=>e.code==='SOURCE_ADD_HOLD');
 assert.deepEqual(x.state().records,before);
});
test('failed second selection clears stale pending candidate',async()=>{
 const x=session();assert.equal((await x.prepare(await build())).status,'REVIEW');const bad=await x.prepare(new Uint8Array([1,2,3]));
 assert.notEqual(bad.status,'REVIEW');assert.equal(x.state().hasPending,false);
 assert.throws(()=>x.acceptPrepared({confirmed:true}),e=>e.code==='IMPORT_NOT_READY');
});
test('cancel pending retains prior active edited store',async()=>{
 const x=session();await confirmed(x,await build());x.command({type:'edit',id:'e1',patch:{memo:'KEEP'}},{confirmed:true});
 const another=await x.prepare(await build([rec('other')]));assert.equal(another.status,'REVIEW');x.discardPending();
 assert.equal(x.state().records[0].memo,'KEEP');
});
test('source-bearing preview save and resume retains immutable source and user edit',async()=>{
 const s=storage(),x=session(s);await confirmed(x,await build());x.command({type:'edit',id:'e1',patch:{memo:'保存後の編集'}},{confirmed:true});
 const saved=await x.saveDraft();assert.equal(saved.status,'SAVED');assert.equal(saved.revision,1);
 assert.equal(s.getItem('next-lab-creative-v7'),'LEGACY_UNTOUCHED');
 const next=session(s);const info=await next.inspectDraft();assert.equal(info.status,'READY');
 assert.equal((await next.resumeDraft()).applied,false);
 const resumed=await next.resumeDraft({confirmed:true});assert.equal(resumed.status,'READY');assert.equal(next.state().records[0].memo,'保存後の編集');
 assert.deepEqual(next.state().history,{undo:0,redo:0});
 const output=await next.exportKmz();const again=await stageKmlInput(output.bytes,deps);assert.equal(again.places[0].description,'保存後の編集');
});
test('second generation journal keeps previous intact revision',async()=>{
 const s=storage(),x=session(s);await confirmed(x,await build());
 assert.equal((await x.saveDraft()).revision,1);
 x.command({type:'edit',id:'e1',patch:{memo:'second'}},{confirmed:true});
 assert.equal((await x.saveDraft()).revision,2);const y=session(s);assert.equal((await y.inspectDraft()).revision,2);
});
test('corrupted journal cannot silently replace editor or old save',async()=>{
 const s=storage(),x=session(s);await confirmed(x,await build());await x.saveDraft();
 s.setItem('campsite-creative-next-v1-preview:slot-a','BROKEN');const y=session(s);
 assert.equal((await y.inspectDraft()).status,'CORRUPT');const before=y.state();
 assert.equal((await y.resumeDraft({confirmed:true})).applied,false);assert.deepEqual(y.state(),before);
 assert.equal(s.getItem('next-lab-creative-v7'),'LEGACY_UNTOUCHED');
});
test('stale saved workspace blocks unrelated draft without any automatic delete',async()=>{
 const s=storage(),x=session(s);await confirmed(x,await build());await x.saveDraft();
 await confirmed(x,await build([rec('different')]));
 await assert.rejects(x.saveDraft(),e=>e.code==='SAVE_EXISTING_REMOVED');
 assert.equal((await session(s).inspectDraft()).status,'READY');
});
test('existing identity mutation is rejected by Phase 1-A commands',async()=>{
 const x=session();await confirmed(x,await build());
 const r=x.command({type:'edit',id:'e1',patch:{role:'new'}},{confirmed:true});assert.equal(r.ok,false);
});
test('no editor cannot export or save',async()=>{
 const x=session();await assert.rejects(x.exportKmz(),e=>e.code==='NO_EDITOR');await assert.rejects(x.saveDraft(),e=>e.code==='SAVE_UNAVAILABLE');
});

test('deleted POI without dependent circles stays in journal and can be restored by Undo',async()=>{
 const x=session();await confirmed(x,await build());
 const d=x.command({type:'delete',id:'e1'},{confirmed:true});assert.equal(d.ok,true);
 assert.equal(x.state().records[0].deleted,true);assert.equal(x.undo().ok,true);
 assert.equal(x.state().records[0].deleted,false);
});
test('broken KMZ preparation never replaces an existing edited preview',async()=>{
 const x=session();await confirmed(x,await build());x.command({type:'edit',id:'e1',patch:{memo:'SAFE'}},{confirmed:true});
 const failed=await x.prepare(new Uint8Array([1,2,3]));assert.notEqual(failed.status,'REVIEW');
 assert.equal(x.state().records[0].memo,'SAFE');assert.equal(x.state().hasPending,false);
});
test('journal write failure before pointer commit keeps previous intact generation',async()=>{
 const m=storage(),x=session(m);await confirmed(x,await build());await x.saveDraft();
 x.command({type:'edit',id:'e1',patch:{memo:'uncommitted'}},{confirmed:true});
 const old=m.getItem('campsite-creative-next-v1-preview:current');
 const bad={getItem:k=>m.getItem(k),setItem:(k,v)=>{if(k.endsWith(':current'))throw Object.assign(new Error('out of quota'),{name:'QuotaExceededError'});m.setItem(k,v)}};
 const y=session(bad);await confirmed(y,await build());y.command({type:'edit',id:'e1',patch:{memo:'uncommitted'}},{confirmed:true});
 await assert.rejects(y.saveDraft());
 assert.equal(m.getItem('campsite-creative-next-v1-preview:current'),old);
 const restored=session(m);assert.equal((await restored.inspectDraft()).status,'READY');
 assert.equal((await restored.resumeDraft({confirmed:true})).applied,true);
 assert.equal(restored.state().records[0].memo,'旧メモ');
});
