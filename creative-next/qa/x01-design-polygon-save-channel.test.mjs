import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {webcrypto} from 'node:crypto';
import {planDesignPolygonSaveLab} from '../contracts/design-polygon-save-channel-lab.mjs';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createLinkedPairLab,reopenLinkedPairLab} from '../contracts/linked-project-kmz-lab.mjs';

const clone=v=>JSON.parse(JSON.stringify(v));
const polygon=n=>Array.from({length:n},(_,i)=>[
 35.001+0.0002*Math.sin(i*2*Math.PI/n),
 139.001+0.0002*Math.cos(i*2*Math.PI/n)
]);
const design=[[35,139],[35,139.002],[35.002,139.002],[35.002,139]];
function makeProject(){
 return {
  schemaVersion:'1.0',source:'bridge',projectId:'x01-project',polygon:clone(design),
  selectedPois:[{guid:'inside',title:'Inside'}],
  currentPois:[
   {id:'inside',guid:'inside',role:'existing',gameEntity:'POKESTOP',title:'Inside',lat:35.001,lng:139.001},
   {id:'gym-new',role:'added',guid:'',gameEntity:'GYM',title:'Added',lat:35.0011,lng:139.0011}
  ],
  addedPois:[{id:'gym-new',title:'Added'}],deletedPois:[],edits:[],
  meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:x01',futureField:true},
  wayfarerObservation:{
   version:'0.1.0',snapshotId:'wm3:protected',observedAt:'2026-10-12T01:00:00Z',
   polygon:clone(design),
   zones:{
    interior:[{guid:'inside',lat:35.001,lng:139.001,poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
    reference100:[{guid:'outside',lat:35.001,lng:138.9997,poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE'}],
    reserve200:[{guid:'reserve',lat:35.001,lng:138.9986,poiKind:'NOT_IN_GAME',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]
   },
   acquisition:{coverageComplete:true,bufferMeters:200,coverageStatus:'complete'}
  },
  futureMetadata:{doNotDrop:{veryImportant:'kept'}}
 };
}
const primary=(p=design)=>({kind:'project-design-polygon',projectId:'x01-project',
 handoffId:'handoff:x01',basePolygon:clone(design),points:clone(p),deleted:false});
const area=(id,points=polygon(31))=>({kind:'activity-area',id,points:clone(points),deleted:false});
const props=(project=makeProject(),geometryObjects=[area('long-area'),primary()])=>({
 project,expectedProjectId:'x01-project',expectedHandoffId:'handoff:x01',
 expectedBasePolygon:clone(design),geometryObjects
});
const requireHold=(f,code)=>assert.throws(f,e=>e?.code===code,'must HOLD: '+code);
function realCoverage(){
 const sandbox={window:{},console,Object,Array,Math,Number,String,Infinity};
 vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync('creative/runtime/map-engine/wayfarer-reserve-coverage.js','utf8'),sandbox);
 return sandbox.window.bridgeMapLab_evaluateWayfarerReserveCoverage;
}
const coverage=realCoverage();

test('X01: Legacy bridge sync currently selects first polygon; this LAB changes no production file',()=>{
 const code=fs.readFileSync('creative/bridge-project-patch.js','utf8');
 assert.match(code,/const activePolygon=\(polygons\|\|\[\]\)\.find\(p=>!p\.deleted/);
});
test('X01: area-first layout retains 4-point project design polygon and 31-point area',()=>{
 const p=makeProject(),shapes=[area('a31'),primary()];
 const before=clone({p,shapes});
 const r=planDesignPolygonSaveLab(props(p,shapes));
 assert.equal(r.status,'LAB_GEOMETRY_PLAN_READY');assert.equal(r.productionReady,false);
 assert.equal(r.project.polygon.length,4);assert.equal(r.activityAreas[0].points.length,31);
 assert.deepEqual(r.project.polygon,p.polygon);assert.deepEqual({p,shapes},before);
 assert.deepEqual(r.project.wayfarerObservation.polygon,p.wayfarerObservation.polygon);
});
test('X01: reordering geometry objects does not change primary ownership',()=>{
 const p=makeProject(),one=planDesignPolygonSaveLab(props(p,[area('a'),primary(),area('b',polygon(4))]));
 const two=planDesignPolygonSaveLab(props(p,[primary(),area('b',polygon(4)),area('a')]));
 assert.deepEqual(one.project.polygon,two.project.polygon);
 assert.equal(one.activityAreas.length,2);assert.equal(two.activityAreas.length,2);
});
test('X01: editing only Creative activity area never calls coverage or changes project polygon',()=>{
 const p=makeProject(),original=clone(p.wayfarerObservation);
 const r=planDesignPolygonSaveLab(props(p,[area('one',polygon(32)),primary()]));
 assert.equal(r.primaryChanged,false);assert.equal(r.coverageStatus,'UNCHANGED');
 assert.deepEqual(r.project.polygon,p.polygon);
 assert.deepEqual(r.project.wayfarerObservation,original);
 assert.equal(r.activityAreas[0].points.length,32);
});
test('X01: explicit small primary edit uses real WM5 reserve coverage, preserves acquisition polygon',()=>{
 const p=makeProject(),historical=clone(p.wayfarerObservation);
 const moved=design.map(([lat,lng])=>[lat,lng+0.00005]);
 const r=planDesignPolygonSaveLab({...props(p,[area('a31'),primary(moved)]),evaluateCoverage:coverage});
 assert.equal(r.primaryChanged,true);assert.equal(r.coverageStatus,'LOCALLY_COVERED');
 assert.deepEqual(r.project.polygon,moved);assert.deepEqual(r.project.wayfarerObservation,historical);
 assert.deepEqual(p.polygon,design,'source unchanged');
});
test('X01: primary edit outside reserve HOLD; original project untouched',()=>{
 const p=makeProject(),before=clone(p),moved=design.map(([lat,lng])=>[lat,lng+0.008]);
 requireHold(()=>planDesignPolygonSaveLab({...props(p,[primary(moved)]),evaluateCoverage:coverage}),'X01_REACQUISITION_REQUIRED');
 assert.deepEqual(p,before);
});
test('X01: no unverified auto-local coverage on an incomplete acquisition',()=>{
 const p=makeProject();p.wayfarerObservation.acquisition.coverageComplete=false;
 const moved=design.map(([lat,lng])=>[lat,lng+0.00005]);
 requireHold(()=>planDesignPolygonSaveLab({...props(p,[primary(moved)]),evaluateCoverage:coverage}),'X01_ACQUISITION_INCOMPLETE');
});
test('X01: primary edit cannot proceed without real coverage evaluator',()=>{
 const moved=design.map(([lat,lng])=>[lat,lng+0.00005]);
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(moved)])),'X01_COVERAGE_EVALUATOR_REQUIRED');
});
test('X01: untyped legacy geometry cannot impersonate primary by array position',()=>{
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[{points:clone(design)},area('one'),primary()])),'X01_UNTYPED_OR_UNKNOWN_SHAPE');
});
test('X01: unknown shape kind cannot silently disappear on save',()=>{
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(),{kind:'distance-circle',points:clone(design)}])),'X01_UNTYPED_OR_UNKNOWN_SHAPE');
});
test('X01: zero or duplicated typed primary polygon HOLD',()=>{
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[area('a')])),'X01_EXACTLY_ONE_PRIMARY_REQUIRED');
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(),primary()])),'X01_EXACTLY_ONE_PRIMARY_REQUIRED');
});
test('X01: ownership and handoff identity mismatches HOLD',()=>{
 const wrong=primary();wrong.handoffId='handoff:someone-else';
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[wrong])),'X01_PRIMARY_OWNER_MISMATCH');
 const p=makeProject();p.projectId='other';
 requireHold(()=>planDesignPolygonSaveLab(props(p,[primary()])),'X01_PROJECT_HANDOFF_MISMATCH');
});
test('X01: stale polygon base blocks overwrite after another editor changed primary',()=>{
 const p=makeProject();p.polygon=design.map(([lat,lng])=>[lat,lng+0.00001]);
 requireHold(()=>planDesignPolygonSaveLab(props(p,[primary()])),'X01_STALE_BASE_POLYGON');
 const wrong=primary();wrong.basePolygon=polygon(3);
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[wrong])),'X01_PRIMARY_SOURCE_MISMATCH');
});
test('X01: 31 points valid as activity, invalid as primary',()=>{
 const r=planDesignPolygonSaveLab(props(makeProject(),[primary(),area('31',polygon(31))]));
 assert.equal(r.activityAreas[0].points.length,31);
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(polygon(31))])),'X01_PRIMARY_VERTEX_COUNT');
});
test('X01: 512 activity points allowed; 513 or 65 areas rejected, never truncated',()=>{
 const r=planDesignPolygonSaveLab(props(makeProject(),[primary(),area('long',polygon(512))]));
 assert.equal(r.activityAreas[0].points.length,512);
 const tooLong=area('long',polygon(513));
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(),tooLong])),'X01_AREA_VERTEX_COUNT');
 assert.equal(tooLong.points.length,513);
 const tooMany=[primary(),...Array.from({length:65},(_,i)=>area('area-'+i,polygon(3)))];
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),tooMany)),'X01_TOO_MANY_AREAS');
});
test('X01: activity ID duplicates and unsupported deletion retain HOLD (no silent loss)',()=>{
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(),area('a'),area('a')])),'X01_AREA_ID');
 const deleted=area('a');deleted.deleted=true;
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(),deleted])),'X01_AREA_DELETION_UNSUPPORTED');
});
test('X01: project primary deletion and self intersection HOLD',()=>{
 const deleted=primary();deleted.deleted=true;
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[deleted])),'X01_PRIMARY_DELETION_FORBIDDEN');
 const crossing=primary([[35,139],[35.002,139.002],[35.0002,139.0018],[35.002,139]]);
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[crossing])),'X01_PRIMARY_AREA_INTERSECTION');
});
test('X01: unsupported shape metadata and silent JSON loss are refused',()=>{
 const shape=area('a');shape.extra='unknown';
 requireHold(()=>planDesignPolygonSaveLab(props(makeProject(),[primary(),shape])),'X01_AREA_FIELDS');
 const p=makeProject();p.futureMetadata.unsafe=undefined;
 requireHold(()=>planDesignPolygonSaveLab(props(p,[primary()])),'X01_NON_JSON_VALUE');
});
test('X01: safe geometry plan can feed existing NEW_V1 + linked-pair LAB without overriding Project polygon',async()=>{
 const p=makeProject();
 const shapes=[area('long-area'),primary(),area('tiny-area',polygon(4))];
 const plan=planDesignPolygonSaveLab(props(p,shapes));
 const records=[
  {id:'kmz-inside',role:'existing',guid:'inside',kind:'pokestop',title:'Inside',memo:'Original',lat:35.001,lng:139.001},
  {id:'gym-new',role:'new',kind:'gym',title:'Added',memo:'Candidate',lat:35.0011,lng:139.0011}
 ];
 const {bytes}=await createFreshV1Kmz({records,activityAreas:plan.activityAreas},{JSZip,DOMParser,XMLSerializer,documentName:'synthetic-x01'});
 const pair=await createLinkedPairLab({project:plan.project,activityAreas:plan.activityAreas,kmzBytes:bytes,
  expectedProjectId:'x01-project',expectedHandoffId:'handoff:x01',JSZip,DOMParser,cryptoProvider:webcrypto});
 const restored=await reopenLinkedPairLab({pair,expectedProjectId:'x01-project',expectedHandoffId:'handoff:x01',JSZip,DOMParser,cryptoProvider:webcrypto});
 assert.equal(restored.productionReady,false);
 assert.deepEqual(restored.project.polygon,design);
 assert.deepEqual(restored.project.wayfarerObservation.polygon,design);
 assert.equal(restored.activityAreas[0].points.length,31);
 assert.deepEqual(restored.project.currentPois,p.currentPois);
 assert.deepEqual(restored.project.futureMetadata,p.futureMetadata);
 assert.deepEqual(restored.kmzBytes,bytes);
});
