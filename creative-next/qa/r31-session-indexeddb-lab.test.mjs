import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {indexedDB} from 'fake-indexeddb';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createWorkspace} from '../original-ui-r31-b3-b4/workspace.mjs';
import {connectB2} from '../original-ui-r31-b3-b4/adapter-review.mjs';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createX01IndexedDbSaveLab} from '../contracts/x01-indexeddb-save-lab.mjs';
import {createR31SessionIndexedDbLab} from '../contracts/r31-session-indexeddb-lab.mjs';
const deps={JSZip,DOMParser,XMLSerializer,cryptoProvider:webcrypto};
const ids={expectedProjectId:'r31-session-p',expectedHandoffId:'handoff:r31'};
const design=[[35,139],[35,139.002],[35.002,139.002],[35.002,139]];
const areas=()=>[];
const polygon=n=>Array.from({length:n},(_,i)=>[35.001+0.0003*Math.sin(i*2*Math.PI/n),139.001+0.0003*Math.cos(i*2*Math.PI/n)]);
const original={id:'old-record',role:'existing',kind:'pokestop',guid:'old-guid',title:'元POI',memo:'Original',lat:35.001,lng:139.001};
const project=()=>({
 schemaVersion:'1.0',source:'bridge',projectId:ids.expectedProjectId,
 polygon:JSON.parse(JSON.stringify(design)),
 sourcePois:[{guid:'old-guid'}],selectedPois:[{guid:'old-guid'}],
 currentPois:[{id:'old-guid',guid:'old-guid',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',title:'元POI',lat:35.001,lng:139.001}],
 addedPois:[],deletedPois:[],edits:[],
 meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:ids.expectedHandoffId},
 wayfarerObservation:{snapshotId:'wm3:r31',observedAt:'2026-10-12T06:00:00Z',polygon:JSON.parse(JSON.stringify(design)),
  acquisition:{coverageComplete:true,bufferMeters:200},
  zones:{
   interior:[{guid:'old-guid',poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE',lat:35.001,lng:139.001}],
   reference100:[{guid:'ref',poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE',lat:35.001,lng:138.9998}],
   reserve200:[{guid:'power',poiKind:'NOT_IN_GAME',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT',lat:35.001,lng:138.9986}]
  }
 },future:{nested:{some:'preserve me'}}
});
const clone=x=>JSON.parse(JSON.stringify(x));
const dbName=n=>'campsite-creative-next-x01-idb-lab-r31-'+n;
const db=n=>createX01IndexedDbSaveLab({indexedDB,dbName:dbName(n),...deps});
const workspace=()=>createWorkspace(deps);
const link=(ws,storage)=>createR31SessionIndexedDbLab({workspace:ws,store:storage,...deps});
async function source(){
 const {bytes}=await createFreshV1Kmz({records:[original],activityAreas:areas()},deps);return bytes;
}
async function setup(name){
 const bytes=await source(),w=workspace(),s=db(name),app=link(w,s);
 const result=await app.start({project:project(),kmzBytes:bytes,...ids,confirmed:true});
 assert.equal(result.status,'LAB_R31_STARTED');return {bytes,w,s,app};
}
const error=async(fn,code)=>assert.rejects(fn,e=>e?.code===code,'Expected '+code);
test('r31 actual Session -> B2 dispatch -> Undo/Redo -> persisted bundle -> fresh Session restored',async()=>{
 const x=await setup('primary');
 const originalBytes=x.bytes.slice(),initial=x.w.session.state();
 let reader,listener;const ui={onCommand:fn=>{listener=fn},setViewReader:fn=>{reader=fn},
  status:()=>({mapCount:1,stopped:false,dataConnected:false,ui:{selected:null}}),dispose(){}};
 const b=connectB2({session:x.w.session,ui});
 let seq=0;const dispatch=(action)=>b.dispatch({...action,requestId:'test-'+(++seq)},{confirmed:true});
 assert.equal(dispatch({type:'add',kind:'gym',position:{lat:35.0012,lng:139.0012}}).status,'APPLIED');
 const added=x.w.session.state().records.find(p=>p.role==='new');
 assert(added);
 assert.equal(dispatch({type:'edit',id:added.id,patch:{title:'新Gym',memo:'テスト'}}).status,'APPLIED');
 assert.equal(dispatch({type:'area-create',points:polygon(31)}).status,'APPLIED');
 assert.equal(dispatch({type:'undo'}).status,'APPLIED');
 assert.equal(x.w.session.state().areas.length,0);
 assert.equal(dispatch({type:'redo'}).status,'APPLIED');
 const mid=x.w.session.state();
 assert.equal(mid.areas.length,1);
 const baseline=mid.records.find(p=>p.role==='existing');
 assert.deepEqual(baseline,initial.records[0]);
 const done=await x.app.save({confirmed:true});
 assert.equal(done.status,'LAB_R31_SAVED');assert.equal(done.revision,1);
 assert.equal(done.areaCount,1);assert.equal(x.w.status().sessionCount,1);
 assert.deepEqual(x.bytes,originalBytes,'original NEW_V1 source KMZ protected');
 assert.equal(b.status().fault,false);
 const written=await x.s.read(ids);
 assert.equal(written.project.polygon.length,4);
 assert.equal(written.activityAreas[0].points.length,31);
 assert.equal(written.project.currentPois.length,2);
 assert.equal(written.project.currentPois[1].title,'新Gym');
 assert.equal(written.project.wayfarerObservation.zones.reserve200[0].gameStatus,'INACTIVE');
 assert.deepEqual(written.project.future,project().future);
 b.dispose();x.app.dispose();x.w.dispose();
 const fresh=workspace(),next=link(fresh,db('primary'));
 assert.equal(fresh.session.state().hasActive,false,'not auto restored');
 await error(()=>next.reopen({...ids}),'R31_LAB_CONFIRM_REQUIRED');
 const opened=await next.reopen({...ids,confirmed:true});
 assert.equal(opened.status,'LAB_R31_REOPENED');assert.equal(opened.sessionCount,1);
 assert.equal(opened.revision,1);
 assert.equal(fresh.session.state().history.undo,0);
 assert.equal(fresh.session.state().records.length,2);
 assert.equal(fresh.session.state().areas[0].points.length,31);
 assert.equal(fresh.session.state().records.find(p=>p.role==='new').title,'新Gym');
 assert.deepEqual(fresh.session.state().records.find(p=>p.role==='existing'),baseline);
 // A re-opened source-bearing new POI remains editable, existing remains locked.
 const newcomer=fresh.session.state().records.find(p=>p.role==='new');
 assert.equal(fresh.session.command({type:'edit',id:newcomer.id,patch:{memo:'続き'}},{confirmed:true}).changed,true);
 assert.throws(()=>fresh.session.command({type:'edit',id:'old-record',patch:{title:'不可'}},{confirmed:true}),e=>e?.code==='EXISTING_POI_READ_ONLY');
 assert.equal((await next.save({confirmed:true})).revision,2);
 const after=await db('primary').read(ids);
 assert.equal(after.project.currentPois.find(p=>p.role==='added').description,'続き');
 next.dispose();fresh.dispose();
});
test('r31 start, store and resume all require explicit confirmation',async()=>{
 const w=workspace(),app=link(w,db('confirm')),bytes=await source();
 await error(()=>app.start({project:project(),kmzBytes:bytes,...ids}),'R31_LAB_CONFIRM_REQUIRED');
 assert.equal(w.session.state().hasActive,false);
 await app.start({project:project(),kmzBytes:bytes,...ids,confirmed:true});
 await error(()=>app.save(),'R31_LAB_CONFIRM_REQUIRED');
 assert.equal(await db('confirm').read(ids),null);
 await error(()=>app.reopen({...ids,confirmed:true}),'R31_LAB_ALREADY_ATTACHED');
 app.dispose();w.dispose();
});
test('r31 never accepts existing POI edits or deletion tombstone silently',async()=>{
 const x=await setup('readonly');
 assert.throws(()=>x.w.session.command({type:'move',id:'old-record',lat:0,lng:0},{confirmed:true}),e=>e?.code==='EXISTING_POI_READ_ONLY');
 const add=x.w.session.command({type:'add',poi:{role:'new',kind:'pokestop',title:'Temporary',memo:'',lat:35.0013,lng:139.0013}},{confirmed:true});
 assert(add.changed);
 const p=x.w.session.state().records.find(r=>r.role==='new');
 assert(x.w.session.command({type:'delete',id:p.id},{confirmed:true}).changed);
 await error(()=>x.app.save({confirmed:true}),'R31_LAB_DELETED_POI_HOLD');
 assert.equal(await x.s.read(ids),null);
 assert(x.w.session.undo().changed);
 assert.equal((await x.app.save({confirmed:true})).revision,1);
 x.app.dispose();x.w.dispose();
});
test('r31 saved archive newer edits cannot overwrite revision without explicit stale-tolerant reconciliation',async()=>{
 const x=await setup('stale');
 assert.equal((await x.app.save({confirmed:true})).revision,1);
 // Same Session has revision 1; an out-of-band separately verified saver advances it.
 const stored=await x.s.read(ids);
 const plan={
  status:'LAB_GEOMETRY_PLAN_READY',productionReady:false,project:stored.project,
  activityAreas:stored.activityAreas,projectId:ids.expectedProjectId,handoffId:ids.expectedHandoffId
 };
 await x.s.save({plan,kmzBytes:stored.kmzBytes,...ids,expectedRevision:1});
 await error(()=>x.app.save({confirmed:true}),'IDB_LAB_REVISION_CONFLICT');
 assert.equal((await x.s.read(ids)).revision,2);
 x.app.dispose();x.w.dispose();
});
test('r31 attach rejects mistaken source Project/POIs before activation',async()=>{
 const bytes=await source(),w=workspace(),app=link(w,db('identity')),p=project();
 p.currentPois[0].title='different';
 await error(()=>app.start({project:p,kmzBytes:bytes,...ids,confirmed:true}),'PAIR_POI_MISMATCH');
 assert.equal(w.session.state().hasActive,false);
 app.dispose();w.dispose();
});

test('r31 Session mutation during awaited KMZ export is HOLD before any IndexedDB write',async()=>{
 const x=await setup('session-mutated-mid-save');
 let intercepted=0;
 const racedWorkspace={
  session:x.w.session,
  status:()=>x.w.status(),
  exportKmz:async()=>{
   const archive=await x.w.exportKmz();
   intercepted++;
   const edit=x.w.session.command({type:'add',poi:{
    role:'new',kind:'gym',title:'Mid-save mutation',memo:'race',lat:35.00125,lng:139.00125
   }},{confirmed:true});
   assert.equal(edit.changed,true);
   return archive;
  }
 };
 const guarded=createR31SessionIndexedDbLab({workspace:racedWorkspace,store:x.s,...deps});
 try{
  assert.equal((await guarded.attachLive({project:project(),kmzBytes:x.bytes,...ids,revision:0,confirmed:true})).status,'LAB_R31_ATTACHED');
  await error(()=>guarded.save({confirmed:true}),'R31_LAB_SESSION_CHANGED');
  assert.equal(intercepted,1);
  assert.equal(x.w.session.state().records.length,2);
  assert.equal(await x.s.read(ids),null,'no partial or stale bundle persisted');
 }finally{guarded.dispose();x.app.dispose();x.w.dispose();}
});
