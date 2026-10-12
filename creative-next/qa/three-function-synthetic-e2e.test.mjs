/*
 * Cross-feature LAB rehearsal with synthetic input only.
 * Actual WM3 Creative<->Wayfarer relay and observation controller -> Project save,
 * actual Bridge exporter -> actual Creative Next NEW_V1 writer -> linked pair
 * -> real Creative reference adapter/reclassification. No browser/UI/storage migration.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {webcrypto} from 'node:crypto';
import {createHarness,makeProject} from '../../scripts/wm3b2d-pseudo-harness.mjs';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createLinkedPairLab,reopenLinkedPairLab} from '../contracts/linked-project-kmz-lab.mjs';

const OPTIONS={JSZip,DOMParser,cryptoProvider:webcrypto};
const clone=x=>JSON.parse(JSON.stringify(x));
function loadWindow(...paths){
 const sandbox={window:{},console,Object,Array,String,Number,Boolean,JSON,Math,Map,Set,Infinity,Error};
 vm.createContext(sandbox);
 for(const p of paths)vm.runInContext(fs.readFileSync(p,'utf8'),sandbox,{filename:p});
 return sandbox.window;
}
const bridge=loadWindow('bridge-pc/bridge-v1-exporter.js').CampsiteBridgeV1Exporter;
const creative=loadWindow('creative/runtime/map-engine/wayfarer-observation-adapter.js',
  'creative/runtime/map-engine/wayfarer-reserve-coverage.js',
  'creative/runtime/map-engine/wayfarer-local-reclassification.js');
const ring=n=>Array.from({length:n},(_,i)=>[35.004+0.001*Math.sin(i*2*Math.PI/n),139.004+0.001*Math.cos(i*2*Math.PI/n)]);

function projectFixture(){
 const p=makeProject();p.projectId='three-flow-synthetic';
 p.meta={...p.meta,projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:three-flow'};
 p.currentPois=[
  {id:'inside',guid:'inside',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',title:'Inside',lat:35.005,lng:139.005},
  {id:'new-local',guid:'',role:'added',gameEntity:'GYM',gameStatus:'ACTIVE',title:'Local Gym',lat:35.006,lng:139.006}
 ];
 p.selectedPois=[{guid:'inside',role:'existing',title:'Inside',lat:35.005,lng:139.005}];
 p.addedPois=[{id:'new-local',title:'Local Gym'}];p.deletedPois=[];
 p.futureTopLevel={keep:'future metadata',seq:[1,2,3]};
 return p;
}
const areasFixture=()=>[{id:'area-long-31',points:ring(31)},{id:'area-short',points:[[35.001,139.001],[35.002,139.001],[35.002,139.002]]}];
const poiRecords=()=>[
 {id:'kmz-existing-id',role:'existing',kind:'pokestop',title:'Inside',memo:'Original',guid:'inside',lat:35.005,lng:139.005},
 {id:'new-local',role:'new',kind:'gym',title:'Local Gym',memo:'Candidate',lat:35.006,lng:139.006}
];
async function entireFlow(){
 const p=projectFixture();const preObservation=clone(p);
 const harness=createHarness({project:p});
 const connected=await harness.connect();assert.equal(connected.status,'success');
 const observed=await harness.observe();assert.equal(observed.status,'success');
 const saved=harness.sessionStorage.dump();
 assert.equal(saved.wayfarerObservation.acquisition.coverageComplete,true,'observation must explicitly prove complete');
 assert.equal(saved.wayfarerObservation.zones.interior.length,1);
 assert.equal(saved.wayfarerObservation.zones.reference100.length,1);
 assert.equal(saved.wayfarerObservation.zones.reserve200.length,1);
 const reference=creative.bridgeMapLab_adaptWayfarerObservation(saved.wayfarerObservation,[
  {id:'inside',guid:'inside',layer:'existing-pokestop',latlng:[35.005,139.005]},
  {id:'new-local',layer:'new-gym',latlng:[35.006,139.006]}
 ]);
 assert.equal(reference.displayPois.length,1,'only outside 0-100m shows as reference');
 assert.equal(reference.reservePois.length,1,'100-200m reserve retained but hidden');
 assert.equal(reference.suppressedByEditableGuid.length,1,'inside existing POI not double rendered');
 assert.equal(reference.displayPois[0].readOnly,true);
 assert.equal(reference.reservePois[0].readOnly,true);
 const payload=bridge.makePayload({
  enginePois:saved.wayfarerObservation.zones.interior,
  polygon:saved.polygon,wayfarerObservation:saved.wayfarerObservation
 },'handoff:three-flow');
 assert.equal(payload.type,'CAMPSITE_BRIDGE_POI_V1');
 assert.equal(payload.pois.length,1,'only interior active should be editable');
 assert.equal(payload.wayfarerObservation.zones.reference100.length,1);
 assert.equal(payload.wayfarerObservation.zones.reserve200.length,1);
 // Import of Bridge payload into Project is covered separately by WM4A tests;
 // do not silently assert that this test runs the actual receiver UI.
 const areas=areasFixture();
 const {bytes}=await createFreshV1Kmz({records:poiRecords(),activityAreas:areas},
  {JSZip,DOMParser,XMLSerializer,documentName:'synthetic-wayfarer-project'});
 const originalBytes=new Uint8Array(bytes);
 const sourcePair=await createLinkedPairLab({
  project:saved,activityAreas:areas,kmzBytes:bytes,
  expectedProjectId:'three-flow-synthetic',expectedHandoffId:'handoff:three-flow',...OPTIONS
 });
 assert.equal(sourcePair.productionReady,false);
 const restored=await reopenLinkedPairLab({pair:sourcePair,expectedProjectId:'three-flow-synthetic',
  expectedHandoffId:'handoff:three-flow',...OPTIONS});
 assert.equal(restored.productionReady,false);
 return {preObservation,saved,payload,reference,areas,bytes,originalBytes,sourcePair,restored};
}

const flow=await entireFlow();

test('3 features LAB: real Wayfarer observation/relay -> Project -> KMZ -> Project reload conserves data',()=>{
 const {preObservation,saved,restored,sourcePair,originalBytes}=flow;
 assert.equal(sourcePair.status,'LAB_PAIR_CREATED');
 assert.equal(restored.status,'LAB_PAIR_VERIFIED');
 assert.deepEqual(restored.project,saved);
 assert.deepEqual(restored.kmzBytes,originalBytes);
 assert.deepEqual(restored.activityAreas,flow.areas);
 assert.deepEqual(restored.project.polygon,preObservation.polygon);
 assert.deepEqual(restored.project.currentPois,preObservation.currentPois);
 assert.deepEqual(restored.project.selectedPois,preObservation.selectedPois);
 assert.deepEqual(restored.project.edits,preObservation.edits);
 assert.deepEqual(restored.project.futureTopLevel,preObservation.futureTopLevel);
 assert.equal(restored.project.wayfarerObservation.zones.reserve200[0].guid,'reserve');
 assert.equal(restored.project.wayfarerObservation.acquisition.coverageComplete,true);
 assert.equal(restored.project.wayfarerObservation.zones.reference100[0].guid,'outer');
 assert.equal(restored.project.polygon.length,4,'Wayfarer polygon must stay primary');
 assert.equal(restored.activityAreas[0].points.length,31,'Creative activity polygon must stay separate');
});
test('3 features LAB: actual Creative reference adapter hides reserve and locks outer POIs',()=>{
 const r=creative.bridgeMapLab_adaptWayfarerObservation(flow.restored.project.wayfarerObservation,[
  {guid:'inside',id:'inside',layer:'existing-pokestop'},
  {id:'new-local',layer:'new-gym'}
 ]);
 assert.deepEqual([...r.displayPois.map(x=>x.guid)],['outer']);
 assert.deepEqual([...r.reservePois.map(x=>x.guid)],['reserve']);
 assert.deepEqual([...r.suppressedByEditableGuid.map(x=>x.guid)],['inside']);
 assert(r.displayPois.every(p=>p.readOnly===true));
 assert(!flow.restored.project.currentPois.some(p=>p.guid==='outer'||p.guid==='reserve'));
});
test('3 features LAB: reserve-covered polygon change reclassifies without editing historical observation',()=>{
 const restored=flow.restored.project,original=JSON.stringify(restored.wayfarerObservation);
 const shifted=restored.polygon.map(p=>[p[0],p[1]+.00005]);
 const next=creative.bridgeMapLab_reclassifyWayfarerObservation(restored.wayfarerObservation,shifted);
 assert.equal(next.canUseLocal,true);
 assert.equal(next.counts.total,3);
 assert.equal(next.sourceSnapshotId,restored.wayfarerObservation.snapshotId);
 assert.equal(JSON.stringify(restored.wayfarerObservation),original,'accepted acquisition polygon is immutable');
 assert.equal(restored.polygon[0][1],139,'current polygon is unchanged by preview');
});
test('3 features LAB: beyond 200m reserve requests reacquisition; never fabricates coverage',()=>{
 const restored=flow.restored.project,far=restored.polygon.map(p=>[p[0],p[1]+.007]);
 const next=creative.bridgeMapLab_reclassifyWayfarerObservation(restored.wayfarerObservation,far);
 assert.equal(next.canUseLocal,false);
 assert.equal(next.reason,'REFERENCE_OUT_OF_COVERAGE');
 assert.equal(next.counts.total,0);
});
test('3 features LAB: incomplete observation cannot be paired even when KMZ is valid',async()=>{
 const bad=clone(flow.saved);bad.wayfarerObservation.acquisition.coverageComplete=false;
 await assert.rejects(()=>createLinkedPairLab({
  project:bad,activityAreas:flow.areas,kmzBytes:flow.bytes,
  expectedProjectId:'three-flow-synthetic',expectedHandoffId:'handoff:three-flow',...OPTIONS
 }),e=>e?.code==='PAIR_PROJECT_PREFLIGHT_HOLD');
 assert.equal(bad.wayfarerObservation.acquisition.coverageComplete,false);
});
test('3 features LAB: swapped Wayfarer snapshot identity rejected on reopen',async()=>{
 const forged={...flow.sourcePair,manifest:{...flow.sourcePair.manifest,sourceSnapshotId:'different'}};
 await assert.rejects(()=>reopenLinkedPairLab({
  pair:forged,expectedProjectId:'three-flow-synthetic',expectedHandoffId:'handoff:three-flow',...OPTIONS
 }),e=>e?.code==='PAIR_SNAPSHOT_MISMATCH');
});
test('3 features LAB: duplicate GUID across outer/reserve rejects transport',async()=>{
 const bad=clone(flow.saved);bad.wayfarerObservation.zones.reserve200[0].guid='outer';
 await assert.rejects(()=>createLinkedPairLab({
  project:bad,activityAreas:flow.areas,kmzBytes:flow.bytes,
  expectedProjectId:'three-flow-synthetic',expectedHandoffId:'handoff:three-flow',...OPTIONS
 }),e=>e?.code==='PAIR_PROJECT_PREFLIGHT_HOLD');
});
test('3 features LAB: changed Creative primary polygon or POI cannot be inferred from an activity area',async()=>{
 const bad=clone(flow.saved);bad.polygon=ring(31);
 await assert.rejects(()=>createLinkedPairLab({
  project:bad,activityAreas:flow.areas,kmzBytes:flow.bytes,
  expectedProjectId:'three-flow-synthetic',expectedHandoffId:'handoff:three-flow',...OPTIONS
 }),e=>e?.code==='PAIR_PROJECT_PREFLIGHT_HOLD');
 assert.equal(flow.restored.project.polygon.length,4);
});
