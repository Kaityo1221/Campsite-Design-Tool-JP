/*
 * X-01/X-04 boundary matrix. Synthetic read-only tests only.
 * This is NOT approval of a polygon ownership rule or portable authentication.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {inspectCampsiteDistanceReturnStageLab,stageCurrentPoisLab}
 from '../contracts/campsite-distance-return-stage-lab.mjs';
import {createPortableReturnBundleLab,inspectPortableReturnBundleLab}
 from '../contracts/portable-return-bundle-lab.mjs';
import {createCampsiteDistanceConfirmedImportLab}
 from '../contracts/campsite-distance-confirmed-import-lab.mjs';
import {indexedDB} from 'fake-indexeddb';

const {project}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const polygon=(id,vertices,lat,lng,scale)=>({
 id,points:Array.from({length:vertices},(_,i)=>[
  lat+scale*Math.sin(i*2*Math.PI/vertices),
  lng+scale*Math.cos(i*2*Math.PI/vertices)
 ])
});
const area31=polygon('activity-31',31,35.7007,139.8007,0.00017);
const area5=polygon('activity-5',5,35.7017,139.8017,0.00012);
const deps={JSZip,DOMParser,cryptoProvider:webcrypto};
async function fixture(areas){
 const p=project();
 const {bytes}=await createFreshV1Kmz({
  records:[{id:'original-record',role:'existing',guid:'existing-guid',
   kind:'pokestop',title:'元のPOI',memo:'Original',lat:35.701,lng:139.801}],
  activityAreas:clone(areas)
 },{JSZip,DOMParser,XMLSerializer,documentName:'x01-x04-matrix-only'});
 return {project:p,activityAreas:clone(areas),kmzBytes:new Uint8Array(bytes),
  expectedProjectId:p.projectId,expectedHandoffId:p.meta.bridgeHandoffId,...deps};
}
for(const [name,areas] of [
 ['zero',[]],['one',[area31]],['two',[area31,area5]]
]){
 test('X-01 '+name+' Creative independent areas remain distinct and uncommitted',async()=>{
  const f=await fixture(areas),original=clone(f.project),originalAreas=clone(f.activityAreas);
  const preview=await inspectCampsiteDistanceReturnStageLab(f);
  assert.equal(preview.productionReady,false);
  assert.equal(preview.writeAllowed,false);
  assert.equal(preview.legacyDistanceCommitAllowed,false);
  assert.equal(preview.distanceInput.legacyActivityPolygonMapping,'UNAPPROVED');
  assert.equal(preview.summary.designPolygonVertices,4);
  assert.equal(preview.summary.independentActivityAreaCount,areas.length);
  assert.deepEqual(preview.distanceInput.designPolygon,original.polygon);
  assert.deepEqual(preview.distanceInput.acquisitionPolygon,original.wayfarerObservation.polygon);
  assert.deepEqual(preview.distanceInput.activityAreas,originalAreas);
  assert.deepEqual(preview.distanceInput.activityAreas.map(x=>x.id),areas.map(x=>x.id));
  assert.equal(preview.distanceInput.recomputeDistanceRequired,true);
  assert.equal(preview.legacyActivityAreaConflict,areas.length>0);
  assert.equal(preview.reason,areas.length>0
   ?'DISTANCE_X01_ACTIVITY_AREA_MAPPING_HOLD':'DISTANCE_LIVE_IMPORT_NOT_APPROVED');
  assert.deepEqual(f.project,original);
  assert.deepEqual(f.activityAreas,originalAreas);
  const packed=await createPortableReturnBundleLab({...f,revision:2});
  assert.equal(packed.productionReady,false);
  assert.equal(packed.transportAuthenticated,false);
  assert.equal(packed.producerIdentityVerified,false);
  const received=await inspectPortableReturnBundleLab({...f,bytes:packed.bytes});
  assert.equal(received.transportAuthenticated,false);
  assert.equal(received.producerIdentityVerified,false);
  assert.deepEqual(received.project,original);
  assert.deepEqual(received.activityAreas,originalAreas);
  assert.deepEqual(received.kmzBytes,f.kmzBytes);
 });
}
test('X-04 self-consistent ZIP does NOT claim trusted producer identity',async()=>{
 const f=await fixture([]);
 const zipped=await createPortableReturnBundleLab({...f,revision:7});
 const checked=await inspectPortableReturnBundleLab({...f,bytes:zipped.bytes});
 assert.equal(checked.status,'LAB_PORTABLE_RETURN_VERIFIED');
 assert.equal(checked.revision,7);
 assert.equal(checked.transportAuthenticated,false);
 assert.equal(checked.producerIdentityVerified,false);
 const receiver=createCampsiteDistanceConfirmedImportLab({
  indexedDB,dbName:'campsite-creative-next-x01-idb-lab-x04-boundary-matrix',
  ...deps
 });
 const staged=await receiver.prepare({
  bytes:zipped.bytes,expectedProjectId:f.expectedProjectId,
  expectedHandoffId:f.expectedHandoffId
 });
 assert.equal(staged.transportAuthenticated,false);
 assert.equal(staged.producerIdentityVerified,false);
 assert.equal(staged.productionReady,false);
 assert.equal(staged.writeAllowed,false);
 // No confirmCreate: merely inspecting must not persist a Project.
 await assert.rejects(()=>receiver.reopen({
  expectedProjectId:f.expectedProjectId,expectedHandoffId:f.expectedHandoffId
 }),{code:'DISTANCE_IMPORT_SAVED_NOT_FOUND'});
});
test('X-01 no-current fallback and unknown entity cannot enter Distance staging',()=>{
 const p=project();
 p.selectedPois=clone(p.currentPois);
 p.currentPois=[];
 assert.throws(()=>stageCurrentPoisLab(p),{code:'DISTANCE_LEGACY_SELECTION_FALLBACK_HOLD'});
 p.currentPois=clone(p.selectedPois);
 p.currentPois[0].gameEntity='UNMAPPED_ENTITY';
 assert.throws(()=>stageCurrentPoisLab(p),{code:'DISTANCE_ENTITY_HOLD'});
});
