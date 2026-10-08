import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createPoiStore} from '../../phase-1a/core/poi-store.mjs';
import {preparePhase1AFreshBoundary,exportPhase1AFreshKmz} from '../integration/phase1a-fresh-bridge.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';
import {webcrypto} from 'node:crypto';

const deps={JSZip,DOMParser,XMLSerializer};
const input=(id,role='new',extra={})=>({id,role,kind:'pokestop',title:`地点${id}`,memo:'日本語と🐏',lat:35.61,lng:139.81,deleted:false,guid:null,poiId:null,metadata:{},...extra});
const store=(r)=>createPoiStore(r);
const zone={id:'area',points:[[35.5,139.6],[35.7,139.6],[35.7,139.8]]};
const stage=async bytes=>{const s=await stageKmlInput(bytes,deps);return {s,report:diagnoseKmzCandidate(s)};};
function storage(){const m=new Map([['next-lab-creative-v7','UNTOUCHED']]);return {m,getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};}

test('approved Phase 1-A canonical records produce new-format KMZ with IDs, roles, memo and area intact',async()=>{
 const snapshot=store([input('e','existing'),input('n','new',{kind:'gym'})]).snapshot();
 const {bytes}=await exportPhase1AFreshKmz(snapshot,{...deps,activityAreas:[zone]});
 const {s,report}=await stage(bytes);
 assert.equal(report.disposition,'READY');assert.equal(report.counts.existing,1);assert.equal(report.counts.newTotal,1);assert.equal(report.counts.activityAreas,1);
 for(const id of ['e','n'])assert.equal(s.places.some(p=>p.data.some(d=>d.name==='campsite.creative.id'&&d.value===id)),true);
 assert.equal(s.places.some(p=>p.description==='日本語と🐏'),true);
});
test('null external IDs omitted from export, but retained canonically for Phase 1-A save',()=>{
 const {forExport,forJournal}=preparePhase1AFreshBoundary(store([input('a')]).snapshot());
 assert.equal(Object.hasOwn(forExport.records[0],'guid'),false);
 assert.equal(Object.hasOwn(forJournal.records[0],'guid'),true);
 assert.equal(forJournal.records[0].guid,null);
});
test('bridge never changes live Phase 1-A store state',async()=>{
 const s=store([input('a')]);const before=s.snapshot();
 await exportPhase1AFreshKmz(s.snapshot(),deps);
 assert.deepEqual(s.snapshot(),before);
});
test('reject unknown source-derived metadata rather than silently dropping it',()=>{
 const r=input('a','new',{metadata:{unknown:'KEEP'}});
 assert.throws(()=>preparePhase1AFreshBoundary({records:[r]}),{code:'PHASE1A_BRIDGE_HOLD'});
});
test('reject unknown top-level attributes',()=>{
 assert.throws(()=>preparePhase1AFreshBoundary({records:[input('a','new',{sourceGeometry:'data'})]}),{code:'PHASE1A_BRIDGE_HOLD'});
});
test('reject duplicate internal IDs',()=>{
 assert.throws(()=>preparePhase1AFreshBoundary({records:[input('a'),input('a')]}),{code:'PHASE1A_BRIDGE_HOLD'});
});
test('reject invalid and unexpected activity area rather than lose fields',()=>{
 const ss=store([input('a')]).snapshot();
 assert.throws(()=>preparePhase1AFreshBoundary(ss,{activityAreas:[{...zone,description:'must keep'}]}),{code:'PHASE1A_BRIDGE_HOLD'});
});
test('preserve same-name distinct records, and retain new 26 with warning',async()=>{
 const records=Array.from({length:26},(_,i)=>input('n'+i,'new',{title:'同じ名前'}));
 const {bytes}=await exportPhase1AFreshKmz(store(records).snapshot(),deps);const {report}=await stage(bytes);
 assert.equal(report.disposition,'READY');assert.equal(report.counts.newTotal,26);
 assert.ok(report.issues.some(i=>i.code==='NEW_LIMIT_EXCEEDED'));
});
test('keep deleted POI as tombstone in journal but never emit it into KMZ',async()=>{
 const ss=store([input('keep'),input('gone','new',{deleted:true})]).snapshot();
 const boundary=preparePhase1AFreshBoundary(ss);assert.equal(boundary.forJournal.records.length,2);
 const out=await exportPhase1AFreshKmz(ss,deps);const {s}=await stage(out.bytes);
 assert.equal(s.places.length,1);assert.equal(s.places[0].name,'地点keep');
});
test('two-generation journal saves Phase 1-A state independently without touching legacy key',async()=>{
 const mem=storage();const j=createCreativeSaveJournal({storage:mem,subtle:webcrypto.subtle});
 const snap=preparePhase1AFreshBoundary(store([input('a')]).snapshot(),{activityAreas:[zone]}).forJournal;
 const first=await j.save(snap);assert.equal(first.status,'SAVED');
 const loaded=await j.load();assert.equal(loaded.status,'READY');assert.deepEqual(loaded.snapshot,snap);
 assert.equal(mem.getItem('next-lab-creative-v7'),'UNTOUCHED');
});
test('existing coordinates cannot be changed through Phase 1-A editing API',()=>{
 const s=store([input('e','existing')]);const old=s.snapshot();
 const result=s.execute({type:'edit',id:'e',patch:{lat:36}},{confirmed:true});
 assert.equal(result.ok,false);assert.deepEqual(s.snapshot(),old);
});
test('701 existing are rejected in Phase 1-A before fresh export',()=>{
 const records=Array.from({length:701},(_,i)=>input('e'+i,'existing'));
 assert.throws(()=>store(records),{code:'INITIAL_DATA_REJECTED'});
});