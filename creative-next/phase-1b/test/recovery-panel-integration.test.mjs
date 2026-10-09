import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {recoveryChoices,exactRecoveryChoice} from '../../phase-2-preview/recovery-choices.mjs';

const deps={JSZip,DOMParser,XMLSerializer};
const snapshot={records:[{id:'a',role:'existing',kind:'pokestop',title:'葛西のPOI',memo:'元のメモ',lat:35.643,lng:139.858,deleted:false}],activityAreas:[]};
const createStorage=()=>{
 const data=new Map([['next-lab-creative-v7','KEEP_FOREVER']]);const writes=[];
 return {data,writes,getItem:key=>data.get(key)??null,setItem:(key,value)=>{data.set(key,String(value));writes.push(key)}};
};
const locks={request:async(_name,options,callback)=>{assert.equal(options.mode,'exclusive');return callback()}};
const create=({storage,lock=locks}={})=>createIsolatedEditorSession({...deps,storage,locks:lock,requireSaveLock:true});
async function broken(){
 const storage=createStorage(),s=create({storage});const kmz=await createFreshV1Kmz(snapshot,deps);
 assert.equal((await s.prepare(kmz.bytes)).status,'REVIEW');s.acceptPrepared({confirmed:true});
 assert.equal((await s.saveDraft()).revision,1);
 s.command({type:'edit',id:'a',patch:{memo:'新しいメモ'}},{confirmed:true});
 assert.equal((await s.saveDraft()).revision,2);
 storage.setItem('campsite-creative-next-v1-preview:current','BROKEN');
 return {storage,reader:create({storage})};
}

test('fallback display lists only intact checked versions without auto-selecting',async()=>{
 const {storage,reader}=await broken(),before=new Map(storage.data),report=await reader.inspectRecovery();
 const choices=recoveryChoices(report);
 assert.equal(report.status,'FALLBACK');assert.equal(choices.length,2);
 assert.equal(exactRecoveryChoice(choices,''),null);
 assert.equal(exactRecoveryChoice(choices,'invented'),null);
 assert.ok(choices.every(c=>c.label.includes('世代')&&c.label.includes('SHA256')));
 assert.deepEqual(storage.data,before);
});

test('chosen older snapshot is explicitly repaired and loaded, old Creative Mode untouched',async()=>{
 const {storage,reader}=await broken();
 const fallback=await reader.resumeDraft({confirmed:true});
 assert.equal(fallback.readonlyRecovery,true);
 const report=await reader.inspectRecovery(),older=report.candidates.find(c=>c.revision===1);
 const keysBefore=['slot-a','slot-b'].map(x=>storage.getItem('campsite-creative-next-v1-preview:'+x));
 await assert.rejects(reader.recoverDraft({report,candidate:older}),e=>e.code==='SAVE_CONFIRM_REQUIRED');
 assert.equal(reader.state().recoveredFallback,true);
 const restored=await reader.recoverDraft({report,candidate:older,confirmed:true});
 assert.equal(restored.revision,1);assert.equal(restored.readonlyRecovery,false);
 assert.equal(reader.state().records[0].memo,'元のメモ');
 assert.deepEqual(['slot-a','slot-b'].map(x=>storage.getItem('campsite-creative-next-v1-preview:'+x)),keysBefore);
 assert.equal(storage.getItem('next-lab-creative-v7'),'KEEP_FOREVER');
 assert.equal((await reader.saveDraft()).revision,2);
});

test('another tab modifying save pointer after inspection is rejected without write',async()=>{
 const {storage,reader}=await broken();const report=await reader.inspectRecovery();
 const choice=report.candidates[0];storage.setItem('campsite-creative-next-v1-preview:current','CHANGED_ELSEWHERE');
 const before=new Map(storage.data);
 await assert.rejects(reader.recoverDraft({report,candidate:choice,confirmed:true}),e=>e.code==='SAVE_CONFLICT');
 assert.deepEqual(storage.data,before);
});

test('reject fabricated choices and healthy state before attempting repairs',async()=>{
 const {storage,reader}=await broken(),report=await reader.inspectRecovery(),before=new Map(storage.data);
 await assert.rejects(reader.recoverDraft({report,candidate:{slot:'a',revision:999,checksum:'f'.repeat(64)},confirmed:true}),e=>e.code==='SAVE_RECOVERY_INVALID');
 assert.deepEqual(storage.data,before);
 const healthy=create({storage:createStorage()});
 const healthyReport=await healthy.inspectRecovery();
 assert.deepEqual(recoveryChoices(healthyReport),[]);
 await assert.rejects(healthy.recoverDraft({report:healthyReport,candidate:report.candidates[0],confirmed:true}),e=>e.code==='SAVE_RECOVERY_INVALID');
});

test('recovery button cannot repair without exclusive browser lock',async()=>{
 const {storage}=await broken(),reader=create({storage,lock:null});
 const report=await reader.inspectRecovery();const before=new Map(storage.data);
 await assert.rejects(reader.recoverDraft({report,candidate:report.candidates[0],confirmed:true}),e=>e.code==='SAVE_LOCK_UNAVAILABLE');
 assert.deepEqual(storage.data,before);
});

test('successful healthy operation never presents a repair candidate',async()=>{
 const storage=createStorage(),s=create({storage}),x=await createFreshV1Kmz(snapshot,deps);
 await s.prepare(x.bytes);s.acceptPrepared({confirmed:true});await s.saveDraft();
 const options=await s.inspectRecovery();assert.equal(options.status,'READY');
 assert.equal(recoveryChoices(options).length,0);
});
