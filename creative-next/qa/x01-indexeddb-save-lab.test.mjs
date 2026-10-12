import test from 'node:test';
import assert from 'node:assert/strict';
import {indexedDB} from 'fake-indexeddb';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {webcrypto} from 'node:crypto';
import {planDesignPolygonSaveLab} from '../contracts/design-polygon-save-channel-lab.mjs';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createX01IndexedDbSaveLab} from '../contracts/x01-indexeddb-save-lab.mjs';
const clone=x=>JSON.parse(JSON.stringify(x));
const design=[[35,139],[35,139.002],[35.002,139.002],[35.002,139]];
const ring=n=>Array.from({length:n},(_,i)=>[35.001+0.00015*Math.sin(i*2*Math.PI/n),139.001+0.00015*Math.cos(i*2*Math.PI/n)]);
const deps={JSZip,DOMParser,cryptoProvider:webcrypto,indexedDB};
const dbSuffix=n=>`campsite-creative-next-x01-idb-lab-${n}`;
const primary=(p=design)=>({kind:'project-design-polygon',projectId:'x01-storage-p',handoffId:'handoff:x01',basePolygon:clone(design),points:clone(p),deleted:false});
const area=(id,n=31)=>({kind:'activity-area',id,points:ring(n),deleted:false});
function project(){
 return {
  schemaVersion:'1.0',source:'bridge',projectId:'x01-storage-p',polygon:clone(design),
  meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:x01'},
  currentPois:[
   {id:'old',guid:'g-old',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',title:'Old',lat:35.001,lng:139.001},
   {id:'new-1',role:'added',gameEntity:'GYM',gameStatus:'ACTIVE',title:'New',lat:35.0012,lng:139.0012}
  ],
  sourcePois:[{guid:'g-old'}],selectedPois:[{guid:'g-old'}],addedPois:[{id:'new-1'}],deletedPois:[],
  edits:[{id:'new-1',description:'local candidate'}],
  wayfarerObservation:{
   snapshotId:'observation-snap',observedAt:'2026-10-12T03:00:00Z',polygon:clone(design),
   acquisition:{coverageComplete:true,bufferMeters:200},
   zones:{
    interior:[{guid:'g-old',poiKind:'POKESTOP',gameStatus:'ACTIVE',gameEntity:'POKESTOP',lat:35.001,lng:139.001}],
    reference100:[{guid:'g-out',poiKind:'GYM',gameStatus:'ACTIVE',gameEntity:'GYM',lat:35.001,lng:138.9998}],
    reserve200:[{guid:'g-pow',poiKind:'NOT_IN_GAME',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT',lat:35.001,lng:138.9986}]
   }
  },
  futureKeep:{nested:{unknown:12}}
 };
}
function recordSnapshot(){
 return [
  {id:'old-record',guid:'g-old',role:'existing',kind:'pokestop',title:'Old',memo:'original',lat:35.001,lng:139.001},
  {id:'new-1',role:'new',kind:'gym',title:'New',memo:'addition',lat:35.0012,lng:139.0012}
 ];
}
const ids={expectedProjectId:'x01-storage-p',expectedHandoffId:'handoff:x01'};
async function fixture(areas=[area('a')]){
 const p=project();
 const shapes=[...areas,primary()];
 const plan=planDesignPolygonSaveLab({project:p,expectedBasePolygon:design,geometryObjects:shapes,...ids});
 const {bytes}=await createFreshV1Kmz({records:recordSnapshot(),activityAreas:plan.activityAreas},
  {JSZip,DOMParser,XMLSerializer,documentName:'idb-synthetic'});
 return {plan,kmzBytes:bytes,sourceProject:p,sourceShapes:shapes};
}
const expectCode=(call,code)=>assert.rejects(call,e=>e?.code===code,`expected code ${code}`);
function store(dbName){return createX01IndexedDbSaveLab({...deps,dbName});}
async function mutateRow(dbName,change){
 const db=await new Promise((resolve,reject)=>{const q=indexedDB.open(dbName,1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('verified-pairs','readwrite');
   const st=tx.objectStore('verified-pairs');
   const key=JSON.stringify(['x01-storage-p','handoff:x01']);
   const req=st.get(key);
   req.onsuccess=()=>{const r=req.result;change(r);st.put(r)};
   tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);tx.onerror=()=>reject(tx.error);
  });
 }finally{db.close();}
}

test('IDB LAB: atomic one-record roundtrip retains independent primary, 31pt area, observation, KMZ bytes',async()=>{
 const fx=await fixture(),api=store(dbSuffix('roundtrip'));
 const before=clone(fx.sourceProject);
 assert.equal(await api.read(ids),null,'never read production or other saved projects');
 const saved=await api.save({...fx,...ids,expectedRevision:0});
 assert.equal(saved.status,'LAB_IDB_SAVE_VERIFIED');assert.equal(saved.revision,1);assert.equal(saved.productionReady,false);
 const restarted=store(dbSuffix('roundtrip'));
 const read=await restarted.read(ids);
 assert.equal(read.status,'LAB_STORED_PAIR_VERIFIED');
 assert.equal(read.revision,1);assert.deepEqual(read.project,before);
 assert.deepEqual(read.project.polygon,design);assert.equal(read.activityAreas[0].points.length,31);
 assert.equal(read.project.wayfarerObservation.zones.reserve200[0].gameStatus,'INACTIVE');
 assert.equal(read.project.wayfarerObservation.polygon.length,4);
 assert.deepEqual(read.kmzBytes,fx.kmzBytes);
 assert.deepEqual(fx.sourceProject,before);
 assert.equal(fx.sourceShapes[0].points.length,31);
});
test('IDB LAB: save revision 2 and reject stale tab without replacing revision 2',async()=>{
 const db=dbSuffix('revision'),api=store(db);
 const first=await fixture();
 await api.save({...first,...ids,expectedRevision:0});
 const second=await fixture([area('a'),area('b',4)]);
 assert.equal((await api.save({...second,...ids,expectedRevision:1})).revision,2);
 await expectCode(()=>store(db).save({...first,...ids,expectedRevision:1}),'IDB_LAB_REVISION_CONFLICT');
 const reread=await store(db).read(ids);
 assert.equal(reread.revision,2);
 assert.equal(reread.activityAreas.length,2);
 assert.equal(reread.project.polygon.length,4);
});
test('IDB LAB: concurrent revision=0 writer fails under transactional CAS',async()=>{
 const db=dbSuffix('same-slot'),fx=await fixture();
 const settled=await Promise.allSettled([
  store(db).save({...fx,...ids,expectedRevision:0}),
  store(db).save({...fx,...ids,expectedRevision:0})
 ]);
 assert.equal(settled.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(settled.filter(x=>x.status==='rejected').length,1);
 assert.equal((await store(db).read(ids)).revision,1);
});
test('IDB LAB: wrong handoff never returns another Project bundle',async()=>{
 const db=dbSuffix('scope'),fx=await fixture(),api=store(db);
 await api.save({...fx,...ids,expectedRevision:0});
 assert.equal(await api.read({expectedProjectId:'x01-storage-p',expectedHandoffId:'handoff:wrong'}),null);
 assert.equal(await api.read({expectedProjectId:'other-project',expectedHandoffId:'handoff:x01'}),null);
});
test('IDB LAB: corrupt stored KMZ is blocked and original bytes are not guessed',async()=>{
 const db=dbSuffix('kmz-tamper'),fx=await fixture(),api=store(db);
 await api.save({...fx,...ids,expectedRevision:0});
 await mutateRow(db,r=>{r.kmzBytes[8]^=0x10;});
 await expectCode(()=>api.read(ids),'IDB_LAB_INTEGRITY_HOLD');
 await expectCode(()=>api.save({...fx,...ids,expectedRevision:1}),'IDB_LAB_INTEGRITY_HOLD');
});
test('IDB LAB: corrupt stored primary polygon in JSON is blocked and not auto repaired',async()=>{
 const db=dbSuffix('project-tamper'),fx=await fixture(),api=store(db);
 await api.save({...fx,...ids,expectedRevision:0});
 await mutateRow(db,r=>{r.manifest.projectJson=r.manifest.projectJson.replace('"polygon":[[35,139]','"polygon":[[33,139]');});
 await expectCode(()=>api.read(ids),'IDB_LAB_INTEGRITY_HOLD');
});
test('IDB LAB: failing separate-area geometry preflight does not overwrite prior bundle',async()=>{
 const db=dbSuffix('area-fail'),fx=await fixture(),api=store(db);
 await api.save({...fx,...ids,expectedRevision:0});
 const second=await fixture([area('a')]);
 const corrupted={...second,plan:{...second.plan,activityAreas:[{id:'a',points:ring(513)}]}};
 await expectCode(()=>api.save({...corrupted,...ids,expectedRevision:1}),'PAIR_PROJECT_PREFLIGHT_HOLD');
 const read=await api.read(ids);
 assert.equal(read.revision,1);assert.equal(read.activityAreas[0].points.length,31);
});
test('IDB LAB: malformed configuration or no revision blocks prior to any database write',async()=>{
 const db=dbSuffix('bad-config'),fx=await fixture(),api=store(db);
 await expectCode(()=>api.save({...fx,...ids}),'IDB_LAB_EXPECTED_REVISION');
 await expectCode(()=>api.save({...fx,...ids,expectedRevision:-1}),'IDB_LAB_EXPECTED_REVISION');
 await expectCode(()=>api.save({...fx,...ids,expectedRevision:0,plan:{...fx.plan,productionReady:true}}),'IDB_LAB_UNTYPED_PLAN');
 assert.equal(await api.read(ids),null);
 assert.throws(()=>store('campsiteProject.v1'),e=>e?.code==='IDB_LAB_NAMESPACE');
});
test('IDB LAB: current primary is never silently replaced by first area on roundtrip',async()=>{
 const db=dbSuffix('first-area'),fx=await fixture([area('first',512),area('second',5)]),api=store(db);
 await api.save({...fx,...ids,expectedRevision:0});
 const read=await api.read(ids);
 assert.equal(read.project.polygon.length,4);
 assert.deepEqual(read.project.polygon,design);
 assert.equal(read.activityAreas[0].points.length,512);
 assert.deepEqual(read.project.wayfarerObservation.polygon,design);
});
