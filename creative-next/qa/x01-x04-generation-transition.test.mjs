/*
 * Synthetic X-01/X-04 dry-run contract. No storage, prod Distance or UI writes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {webcrypto} from 'node:crypto';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {inspectCampsiteDistanceReturnStageLab} from '../contracts/campsite-distance-return-stage-lab.mjs';
import {createLinkedPairLab} from '../contracts/linked-project-kmz-lab.mjs';
import {previewX01AreaSelectionLab,previewX04GenerationTransitionLab}
 from '../contracts/x01-x04-transition-gate-lab.mjs';

const {project}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const clone=x=>JSON.parse(JSON.stringify(x));
const deps={JSZip,DOMParser,cryptoProvider:webcrypto};
const area=(id,n,lat)=>({id,points:Array.from({length:n},(_,i)=>[
 lat+Math.sin(i*2*Math.PI/n)*0.00014,
 139.8009+Math.cos(i*2*Math.PI/n)*0.00014
])});
async function make(areas=[]){
 const p=project();
 const made=await createFreshV1Kmz({records:[{id:'original-record',
  role:'existing',guid:'existing-guid',kind:'pokestop',title:'元のPOI',
  memo:'Original',lat:35.701,lng:139.801}],activityAreas:areas},
  {JSZip,DOMParser,XMLSerializer,documentName:'dry-run-x01-x04'});
 return {revision:1,project:p,activityAreas:clone(areas),kmzBytes:new Uint8Array(made.bytes)};
}
const ids=p=>({expectedProjectId:p.project.projectId,
 expectedHandoffId:p.project.meta.bridgeHandoffId});
const fp=async(row)=>{
 const pair=await createLinkedPairLab({...row,...ids(row),...deps});
 const m=pair.manifest;
 return {projectSha256:m.projectSha256,activityAreasSha256:m.activityAreasSha256,
  kmzSha256:m.kmzSha256};
};
const candidate=row=>({project:clone(row.project),
 activityAreas:clone(row.activityAreas),kmzBytes:new Uint8Array(row.kmzBytes)});
for(const [label,areas] of [
 ['zero',[]],['one',[area('one-area',31,35.701)]],
 ['multiple',[area('one-area',31,35.701),area('two-area',5,35.702)]]
]){
 test('X-01 explicit '+label+' mapping candidate retains typed areas and remains HOLD',async()=>{
  const row=await make(areas);
  const stage=await inspectCampsiteDistanceReturnStageLab({...row,...ids(row),...deps});
  const original=clone(stage.distanceInput);
  const chosen=previewX01AreaSelectionLab({distanceStage:stage,
   selectedActivityAreaIds:areas.map(a=>a.id).reverse()});
  assert.equal(chosen.status,'LAB_X01_EXPLICIT_AREA_SELECTION_HOLD');
  assert.equal(chosen.writeAllowed,false);
  assert.equal(chosen.approvedMapping,false);
  assert.equal(chosen.legacyDistanceCommitAllowed,false);
  assert.deepEqual(chosen.mappedAreaIds,areas.map(a=>a.id).reverse());
  assert.deepEqual(chosen.proposedActivityAreas,areas.slice().reverse());
  assert.deepEqual(chosen.designPolygon,row.project.polygon);
  assert.deepEqual(chosen.acquisitionPolygon,row.project.wayfarerObservation.polygon);
  assert.deepEqual(stage.distanceInput,original);
  if(areas.length){
   assert.throws(()=>previewX01AreaSelectionLab({distanceStage:stage,
    selectedActivityAreaIds:areas.slice(0,-1).map(a=>a.id)}),
    {code:'X01_EXPLICIT_SELECTION_INCOMPLETE'});
  }
  assert.throws(()=>previewX01AreaSelectionLab({distanceStage:stage,
   selectedActivityAreaIds:['not-a-real-area']}),
   {code:'X01_EXPLICIT_SELECTION_INCOMPLETE'});
  assert.throws(()=>previewX01AreaSelectionLab({distanceStage:stage,
   selectedActivityAreaIds:['not-a-real-area','not-a-real-area']}),
   {code:'X01_EXPLICIT_SELECTION_INCOMPLETE'});
 });
}
test('X-04 current generation fingerprint plus explicit REEDIT intent yields nonwritable candidate',async()=>{
 const current=await make([area('one-area',31,35.701)]);
 const prev=clone(current.project),old=Array.from(current.kmzBytes);
 const changed=candidate(current);
 changed.project.future.notes='synthetic edit without re-observation';
 const result=await previewX04GenerationTransitionLab({
  current,candidate:changed,baseRevision:1,baseFingerprint:await fp(current),
  operation:'REEDIT',confirmed:true,...ids(current),...deps
 });
 assert.equal(result.status,'LAB_X04_TRANSITION_REVIEWED_HOLD');
 assert.equal(result.proposedRevision,2);
 assert.equal(result.basedOnRevision,1);
 assert.equal(result.committed,false);
 assert.equal(result.writeAllowed,false);
 assert.equal(result.transportAuthenticated,false);
 assert.equal(result.producerIdentityVerified,false);
 assert.equal(result.rollbackPerformed,false);
 assert.equal(result.activityAreaCount,1);
 assert.deepEqual(current.project,prev);
 assert.deepEqual(Array.from(current.kmzBytes),old);
});
test('X-04 stale writer, tampered fingerprint and omitted confirmation fail closed',async()=>{
 const current=await make(),changed=candidate(current),fingerprint=await fp(current);
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current,candidate:changed,baseRevision:1,baseFingerprint:fingerprint,
  operation:'REEDIT',confirmed:false,...ids(current),...deps
 }),{code:'X04_CONFIRMATION_REQUIRED'});
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current:{...current,revision:2},candidate:changed,baseRevision:1,
  baseFingerprint:fingerprint,operation:'REEDIT',confirmed:true,...ids(current),...deps
 }),{code:'X04_STALE_GENERATION_HOLD'});
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current,candidate:changed,baseRevision:1,
  baseFingerprint:{...fingerprint,kmzSha256:'0'.repeat(64)},
  operation:'REEDIT',confirmed:true,...ids(current),...deps
 }),{code:'X04_STALE_GENERATION_HOLD'});
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current,candidate:{...changed,revision:2},baseRevision:1,
  baseFingerprint:fingerprint,operation:'REEDIT',confirmed:true,...ids(current),...deps
 }),{code:'X04_CANDIDATE_REVISION_NOT_ASSIGNED'});
});
test('X-04 explicit older rollback candidate reviewed, but cannot commit/rollback',async()=>{
 const ancestor=await make(),current={...ancestor,revision:3,project:clone(ancestor.project)};
 current.project.future.notes='generation three';
 const output=await previewX04GenerationTransitionLab({
  current,candidate:candidate(ancestor),baseRevision:3,baseFingerprint:await fp(current),
  operation:'ROLLBACK',rollbackSource:ancestor,confirmed:true,...ids(current),...deps
 });
 assert.equal(output.rollbackSourceRevision,1);
 assert.equal(output.proposedRevision,4);
 assert.equal(output.rollbackPerformed,false);
 assert.equal(output.committed,false);
 assert.equal(output.writeAllowed,false);
 const corrupted=candidate(ancestor);
 corrupted.project.future.notes='not the rollback source';
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current,candidate:corrupted,baseRevision:3,baseFingerprint:await fp(current),
  operation:'ROLLBACK',rollbackSource:ancestor,confirmed:true,...ids(current),...deps
 }),{code:'X04_ROLLBACK_SOURCE_MISMATCH'});
});
test('X-01/X-04 unapproved design polygon and WM7 re-observation changes always HOLD',async()=>{
 const current=await make(),baseFingerprint=await fp(current);
 const changed=candidate(current);changed.project.wayfarerObservation.snapshotId='changed';
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current,candidate:changed,baseRevision:1,baseFingerprint,
  operation:'REEDIT',confirmed:true,...ids(current),...deps
 }),e=>e.code==='PAIR_PROJECT_PREFLIGHT_HOLD'||e.code==='X04_WM7_REOBSERVATION_HOLD');
 const changedDesign=candidate(current);changedDesign.project.polygon=[
  [35.7,139.8],[35.7,139.803],[35.702,139.803],[35.702,139.8]
 ];
 await assert.rejects(()=>previewX04GenerationTransitionLab({
  current,candidate:changedDesign,baseRevision:1,baseFingerprint,
  operation:'REEDIT',confirmed:true,...ids(current),...deps
 }),{code:'X01_DESIGN_POLYGON_CHANGE_HOLD'});
});
