import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {exportNewV1Kmz} from '../core/export-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
const deps={JSZip,DOMParser,XMLSerializer};
const P='campsite.creative.';
const val=(p,key)=>p.data.find(d=>d.name===P+key)?.value;
const rec=(id,kind='pokestop',role='new')=>({id,role,kind,title:'名称'+id,memo:'元のメモ',lat:35.64,lng:139.85,deleted:false});
const fresh=async(rs=[rec('a')])=>(await createFreshV1Kmz({records:rs,activityAreas:[]},deps)).bytes;
const opened=async(bytes,storage)=>{const s=createIsolatedEditorSession({...deps,storage});assert.equal((await s.prepare(bytes)).status,'REVIEW');assert.equal(s.acceptPrepared({confirmed:true}).applied,true);return s;};
const stage=async bytes=>{const s=await stageKmlInput(bytes,deps),d=diagnoseKmzCandidate(s);assert.equal(d.disposition,'READY',JSON.stringify(d.issues));return s;};
const st=()=>{const map=new Map([['next-lab-creative-v7','KEEP']]);return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)};};
const newPoi=(name='追加')=>({role:'new',kind:'gym',title:name,memo:'NEW memo',lat:35.64235,lng:139.85512});

test('explicit new POI addition generates new internal ID, 50m circle, exact metadata and preserves original source',async()=>{
 const bytes=await fresh(),before=await stage(bytes),x=await opened(bytes);
 const out=x.command({type:'add',poi:newPoi()},{confirmed:true});assert.equal(out.ok,true);
 const added=x.state().records.find(p=>p.title==='追加');assert.ok(added.id.startsWith('poi-'));
 assert.equal(x.state().circles.find(c=>c.ownerId===added.id).radius,50);
 const after=await stage((await x.exportKmz()).bytes);assert.equal(after.places.length,3);
 assert.equal(after.places.filter(p=>p.geometry==='Polygon').length,1);
 const found=after.places.find(p=>val(p,'id')===added.id);assert.deepEqual([val(found,'kind'),found.coordinates,found.description],['gym','139.85512,35.64235','NEW memo']);
 assert.equal(after.places.find(p=>val(p,'id')==='a').coordinates,before.places.find(p=>val(p,'id')==='a').coordinates);
 assert.deepEqual((await stageKmlInput(bytes,deps)).places,before.places);
});

test('unconfirmed add does nothing and invalid metadata or ids are rejected by source-aware path',async()=>{
 const x=await opened(await fresh());let r=x.command({type:'add',poi:newPoi()});assert.equal(r.changed,false);
 assert.equal(x.state().records.length,1);
 for(const poi of [{...newPoi(),id:'forged'},{...newPoi(),metadata:{sourceIndex:4}},{...newPoi(),role:'existing'}]){
  try{r=x.command({type:'add',poi},{confirmed:true});assert.equal(r.ok,false);}catch(e){assert.equal(e.code,'SOURCE_ADD_HOLD');}
 }
 assert.equal(x.state().records.length,1);
});

test('Undo and Redo of added POI also update circle count and source KML output',async()=>{
 const x=await opened(await fresh());assert.equal(x.command({type:'add',poi:newPoi()},{confirmed:true}).ok,true);
 assert.equal(x.state().circles.length,1);
 assert.equal(x.undo().ok,true);assert.equal(x.state().circles.length,0);
 assert.equal((await stage((await x.exportKmz()).bytes)).places.length,1);
 assert.equal(x.redo().ok,true);assert.equal(x.state().circles.length,1);
 assert.equal((await stage((await x.exportKmz()).bytes)).places.length,3);
});

test('two-generation draft keeps newly added POI with its unique ID and circle through resume',async()=>{
 const storage=st(),x=await opened(await fresh(),storage);
 assert.equal(x.command({type:'add',poi:newPoi()},{confirmed:true}).ok,true);
 const id=x.state().records.find(p=>p.title==='追加').id;
 assert.equal((await x.saveDraft()).status,'SAVED');
 const y=createIsolatedEditorSession({...deps,storage});assert.equal((await y.resumeDraft({confirmed:true})).applied,true);
 assert.equal(y.state().circles.length,1);assert.equal(y.state().records.find(p=>p.id===id).title,'追加');
 assert.equal((await stage((await y.exportKmz()).bytes)).places.length,3);
 assert.equal(storage.getItem('next-lab-creative-v7'),'KEEP');
});

test('added POI moves with its circle and deletes with tombstone, then Undo restores',async()=>{
 const x=await opened(await fresh());x.command({type:'add',poi:newPoi()},{confirmed:true});const r=x.state().records.find(p=>p.title==='追加');
 assert.equal(x.command({type:'move',id:r.id,lat:35.643,lng:139.857},{confirmed:true}).ok,true);
 assert.equal(x.state().circles[0].lat,35.643);
 assert.equal(x.command({type:'delete',id:r.id},{confirmed:true}).ok,true);
 assert.equal(x.state().circles.length,0);assert.equal((await stage((await x.exportKmz()).bytes)).places.length,1);
 assert.equal(x.undo().ok,true);assert.equal(x.state().circles.length,1);
 const round=await stage((await x.exportKmz()).bytes);assert.equal(round.places.filter(p=>p.geometry==='Polygon').length,1);
});

test('new POI cannot be added if new total is already 25 (no auto discard)',async()=>{
 const records=Array.from({length:25},(_,i)=>rec('n'+i,i<12?'pokestop':i<20?'gym':'power'));
 const x=await opened(await fresh(records));const r=x.command({type:'add',poi:newPoi()},{confirmed:true});
 assert.equal(r.ok,false);assert.equal(r.error.code,'ADD_LIMIT');assert.equal(x.state().records.length,25);
});

test('new POI addition can follow explicit deletion of one new with free gym slot; tombstone persists',async()=>{
 const records=Array.from({length:25},(_,i)=>rec('n'+i,i<12?'pokestop':i<20?'gym':'power'));
 const x=await opened(await fresh(records));
 assert.equal(x.command({type:'delete',id:'n15'},{confirmed:true}).ok,true);
 assert.equal(x.command({type:'add',poi:newPoi()},{confirmed:true}).ok,true);
 const round=await stage((await x.exportKmz()).bytes),d=diagnoseKmzCandidate(round);
 assert.equal(d.counts.newTotal,25);assert.equal(d.counts.circles,1);
 assert.equal(x.state().records.length,26);assert.equal(x.state().records.find(p=>p.id==='n15').deleted,true);
});

test('untrusted raw additions into exporter HOLD and cannot change original source',async()=>{
 const bytes=await fresh(),s=await stage(bytes);const original=s.sourceKml;
 for(const bad of [{...rec('a')},{...rec('b'),guid:'external'},{...rec('b'),metadata:{origin:'unsafe'}},{...rec('b'),role:'existing'}]){
  await assert.rejects(exportNewV1Kmz(s,{...deps,additions:[bad]}),e=>e.code==='EXPORT_ADD');
 }
 assert.equal(s.sourceKml,original);
});

test('type change of fresh document changes folder and metadata consistently and Undo restores',async()=>{
 const x=await opened(await fresh([rec('e','pokestop','existing'),rec('n')]));
 assert.equal(x.command({type:'change-kind',id:'e',kind:'gym'},{confirmed:true}).ok,true);
 let s=await stage((await x.exportKmz()).bytes),p=s.places.find(x=>val(x,'id')==='e');
 assert.equal(p.folder,'既存 Gym');assert.equal(val(p,'kind'),'gym');
 assert.equal(x.undo().ok,true);s=await stage((await x.exportKmz()).bytes);p=s.places.find(x=>val(x,'id')==='e');
 assert.equal(p.folder,'既存 PokéStop');assert.equal(val(p,'kind'),'pokestop');
});

test('new POI circle creation requires safe latitude (cannot cross polar seam)',async()=>{
 const x=await opened(await fresh());
 assert.throws(()=>x.command({type:'add',poi:{...newPoi(),lat:89.99}},{confirmed:true}),e=>e.code==='CIRCLE_POSITION');
 assert.equal(x.state().records.length,1);
});
