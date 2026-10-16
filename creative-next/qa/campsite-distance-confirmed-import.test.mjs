import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {indexedDB} from 'fake-indexeddb';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createPortableReturnBundleLab} from '../contracts/portable-return-bundle-lab.mjs';
import {createCampsiteDistanceConfirmedImportLab}
 from '../contracts/campsite-distance-confirmed-import-lab.mjs';
import {previewX01AreaSelectionLab}
 from '../contracts/x01-x04-transition-gate-lab.mjs';

const {project}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const ids={expectedProjectId:'r31-ui-lab-project',expectedHandoffId:'handoff:r31-ui-lab'};
const deps={indexedDB,JSZip,DOMParser,cryptoProvider:webcrypto};
const area={id:'explicit-31',points:Array.from({length:31},(_,i)=>[
 35.701+0.00025*Math.cos(2*Math.PI*i/31),139.801+0.00028*Math.sin(2*Math.PI*i/31)
])};
const from=async()=>{
 const p=project();
 const {bytes:kmzBytes}=await createFreshV1Kmz({
  records:[{id:'original-record',role:'existing',guid:'existing-guid',kind:'pokestop',
   title:'元のPOI',memo:'Original',lat:35.701,lng:139.801}],
  activityAreas:[area]
 },{JSZip,DOMParser,XMLSerializer,documentName:'isolated-receive'});
 return {p,kmzBytes};
};
async function fixture(){
 const {p,kmzBytes}=await from();
 const bundle=await createPortableReturnBundleLab({
  project:p,activityAreas:[area],kmzBytes,revision:3,...ids,...deps
 });
 return {bundle,p,kmzBytes};
}
const name=s=>'campsite-creative-next-x01-idb-lab-distance-receiver-'+s;
const api=s=>createCampsiteDistanceConfirmedImportLab({...deps,dbName:name(s)});
const reject=(f,c)=>assert.rejects(f,e=>e?.code===c,'Expected '+c);

test('explicit verify + cancel + retry + isolated save + readback, preserves unknown and 31-point area',async()=>{
 const x=await fixture(),a=api('explicit'),source=clone(x.p);
 const ready=await a.prepare({bytes:x.bundle.bytes,...ids});
 assert.equal(ready.status,'DISTANCE_LAB_AWAIT_EXPLICIT_CONFIRMATION');
 assert.equal(ready.sourceRevision,3);assert.equal(ready.existingRevision,0);
 assert.equal(ready.summary.independentActivityAreaCount,1);
 assert.equal(ready.x01Stage.productionReady,false);
 assert.equal(ready.x01Stage.writeAllowed,false);
 assert.deepEqual(ready.x01Stage.distanceInput.activityAreas,[area]);
 assert.deepEqual(ready.x01Stage.distanceInput.designPolygon,x.p.polygon);
 assert.deepEqual(ready.x01Stage.distanceInput.acquisitionPolygon,
   x.p.wayfarerObservation.polygon);
 const review=previewX01AreaSelectionLab({
  distanceStage:ready.x01Stage,selectedActivityAreaIds:['explicit-31']
 });
 assert.equal(review.approvedMapping,false);
 assert.equal(review.writeAllowed,false);
 assert.deepEqual(review.proposedActivityAreas,[area]);
 assert.equal(review.proposedActivityAreas[0].points.length,31);
 await reject(()=>a.confirmCreate({ticket:ready.ticket,confirmed:false}),'DISTANCE_IMPORT_CONSENT_REQUIRED');
 const saved=await a.confirmCreate({ticket:ready.ticket,confirmed:true});
 assert.equal(saved.revision,1);assert.equal(saved.productionProjectWritten,false);
 const b=await api('explicit').reopen(ids);
 assert.equal(b.revision,1);assert.equal(b.status,'DISTANCE_LAB_REOPEN_VERIFIED');
 assert.deepEqual(b.project,source);assert.deepEqual(b.activityAreas,[area]);
 assert.deepEqual(b.kmzBytes,x.kmzBytes);
 assert.equal(b.summary.designPolygonVertices,4);
 assert.equal(b.summary.independentActivityAreaCount,1);
 assert.equal(b.productionReady,false);
 assert.equal(b.x01Stage.productionReady,false);
 assert.deepEqual(b.x01Stage.distanceInput.activityAreas,[area]);
 assert.deepEqual(x.p,source);
});
test('two tabs verify first, only one creates; no stale overwrite, no destructive rollback',async()=>{
 const x=await fixture(),first=api('race'),second=api('race');
 const [a,b]=await Promise.all([
  first.prepare({bytes:x.bundle.bytes,...ids}),
  second.prepare({bytes:x.bundle.bytes,...ids})
 ]);
 assert.equal(a.existingRevision,0);assert.equal(b.existingRevision,0);
 const results=await Promise.allSettled([
  first.confirmCreate({ticket:a.ticket,confirmed:true}),
  second.confirmCreate({ticket:b.ticket,confirmed:true})
 ]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert(['IDB_LAB_REVISION_CONFLICT','IDB_LAB_CAS_ERROR'].includes(results.find(x=>x.status==='rejected').reason.code));
 const stored=await api('race').reopen(ids);
 assert.equal(stored.revision,1);assert.deepEqual(stored.project,x.p);
 const next=await api('race').prepare({bytes:x.bundle.bytes,...ids});
 assert.equal(next.canCreate,false);assert.equal(next.existingRevision,1);
 await reject(()=>api('race').confirmCreate({ticket:next.ticket,confirmed:true}),'DISTANCE_IMPORT_TICKET_STALE');
 const current=api('race'),existing=await current.prepare({bytes:x.bundle.bytes,...ids});
 await reject(()=>current.confirmCreate({ticket:existing.ticket,confirmed:true}),'DISTANCE_IMPORT_EXISTING_PROTECTED');
 assert.equal((await api('race').reopen(ids)).revision,1);
});
test('wrong Handoff, forged ticket and invalid ZIP reject before any original/recipient write',async()=>{
 const x=await fixture(),a=api('holds');
 await reject(()=>a.prepare({bytes:x.bundle.bytes,expectedProjectId:ids.expectedProjectId,
  expectedHandoffId:'handoff:bad'}),'PORTABLE_IDENTITY_MISMATCH');
 await reject(()=>a.prepare({bytes:new Uint8Array([1,2,3]),...ids}),'PORTABLE_ARCHIVE_SIZE');
 await reject(()=>a.confirmCreate({ticket:1,confirmed:true}),'DISTANCE_IMPORT_TICKET_STALE');
 await reject(()=>a.reopen(ids),'DISTANCE_IMPORT_SAVED_NOT_FOUND');
 const good=await a.prepare({bytes:x.bundle.bytes,...ids});
 await reject(()=>a.confirmCreate({ticket:good.ticket+1,confirmed:true}),'DISTANCE_IMPORT_TICKET_STALE');
 await reject(()=>a.reopen(ids),'DISTANCE_IMPORT_SAVED_NOT_FOUND');
});
test('readback enables a non-destructive next-edit candidate without silently committing it',async()=>{
 const x=await fixture(),a=api('rework');
 const ready=await a.prepare({bytes:x.bundle.bytes,...ids});
 await a.confirmCreate({ticket:ready.ticket,confirmed:true});
 const old=await a.reopen(ids),newProject=clone(old.project);
 newProject.syntheticUnknownFuture={keep:'editing draft only'};
 const paired=await createPortableReturnBundleLab({
  project:newProject,activityAreas:old.activityAreas,kmzBytes:old.kmzBytes,
  revision:4,...ids,...deps
 });
 assert(paired.bytes.length>0);
 const later=api('rework-successor');
 const next=await later.prepare({bytes:paired.bytes,...ids});
 assert.equal(next.sourceRevision,4);
 assert.equal(next.canCreate,true);
 await later.confirmCreate({ticket:next.ticket,confirmed:true});
 const advanced=await later.reopen(ids);
 assert.equal(advanced.revision,1);
 assert.deepEqual(advanced.project,newProject);
 assert.deepEqual(advanced.activityAreas,[area]);
 assert.deepEqual(advanced.kmzBytes,old.kmzBytes);
 assert.deepEqual(advanced.project.wayfarerObservation,x.p.wayfarerObservation);
 const retained=await api('rework').reopen(ids);
 assert.deepEqual(retained.project,x.p);
 assert.deepEqual(retained.activityAreas,[area]);
 assert.equal(retained.revision,1);
});
