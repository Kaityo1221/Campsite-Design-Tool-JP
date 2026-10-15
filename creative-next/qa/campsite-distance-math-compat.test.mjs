import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {inspectCampsiteDistanceReturnStageLab}
 from '../contracts/campsite-distance-return-stage-lab.mjs';
import {previewDistanceCalculationLab,distanceMetersLab}
 from '../contracts/campsite-distance-math-preview-lab.mjs';

const clone=x=>JSON.parse(JSON.stringify(x));
const poly=[[35.700,139.800],[35.700,139.802],[35.702,139.802],[35.702,139.800]];
const activity={id:'area-creative-31',points:Array.from({length:31},(_,i)=>[
 35.701+0.00032*Math.cos(2*Math.PI*i/31),
 139.801+0.0004*Math.sin(2*Math.PI*i/31)
])};
const records=[
 {id:'from-wayfarer',guid:'wayfarer-a',role:'existing',kind:'pokestop',
  title:'Original Pokestop',lat:35.701,lng:139.801},
 {id:'candidate-gym-1',role:'new',kind:'gym',title:'Candidate Gym',
  lat:35.70115,lng:139.801},
 {id:'candidate-power-2',role:'new',kind:'power',title:'Candidate Power',
  lat:35.70140,lng:139.801}
];
const project={
 schemaVersion:'1.0',source:'bridge',projectId:'distance-math-synthetic',
 polygon:poly,meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:distance-math'},
 currentPois:[
  {id:'from-wayfarer',guid:'wayfarer-a',role:'existing',gameEntity:'POKESTOP',
   gameStatus:'ACTIVE',title:'Original Pokestop',lat:35.701,lng:139.801},
  {id:'candidate-gym-1',role:'added',gameEntity:'GYM',
   gameStatus:'UNKNOWN',title:'Candidate Gym',lat:35.70115,lng:139.801},
  {id:'candidate-power-2',role:'added',gameEntity:'POWERSPOT',
   gameStatus:'UNKNOWN',title:'Candidate Power',lat:35.70140,lng:139.801}
 ],
 addedPois:[{id:'candidate-gym-1'},{id:'candidate-power-2'}],
 sourcePois:[{guid:'wayfarer-a'}],selectedPois:[{guid:'wayfarer-a'}],
 deletedPois:[],edits:[],
 wayfarerObservation:{
  snapshotId:'snapshot:distance-synthetic',observedAt:'2026-10-15T00:00:00Z',
  polygon:poly,acquisition:{coverageComplete:true,bufferMeters:200},
  zones:{interior:[{guid:'wayfarer-a',lat:35.701,lng:139.801,poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
  reference100:[{guid:'external-ref',lat:35.70112,lng:139.80112,poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE'}],
  reserve200:[{guid:'hidden-reserve',lat:35.7028,lng:139.8028,poiKind:'POWERSPOT',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]}
 }
};
const original=clone(project);
const kmz=(await createFreshV1Kmz({records,activityAreas:[activity]},
 {JSZip,DOMParser,XMLSerializer,documentName:'synthetic-distance'})).bytes;
async function stage(){
 return inspectCampsiteDistanceReturnStageLab({
  project:clone(project),activityAreas:[clone(activity)],kmzBytes:new Uint8Array(kmz),
  expectedProjectId:project.projectId,expectedHandoffId:project.meta.bridgeHandoffId,
  JSZip,DOMParser,cryptoProvider:webcrypto
 });
}
function actualDistanceSandbox(stageInput){
 // These are the REAL unmodified production source functions, loaded in a
 // disposable VM. Analytics/file upload/map networks are deliberately stubs.
 const distanceCore=fs.readFileSync('js/distance-core.js','utf8');
 const poi=fs.readFileSync('js/distance-poi.js','utf8');
 const output={html:'',mapPoints:[],mapWarnings:[],polygons:[],analyticsCalled:0};
 const distanceResult={
  set innerHTML(x){output.html=x;},get innerHTML(){return output.html;},
  get textContent(){return output.html}
 };
 const sandbox={
  window:{_layerPoints:clone(stageInput.distanceInput.groups),
   _activityPolygons:stageInput.distanceInput.activityAreas.map(a=>clone(a.points)),
   _hasPolygon:true,_distanceSourceFile:null,
   CampsitePoiSpacingPolicy:{targetMeters:50}},
  document:{getElementById:id=>id==='distanceResult'?distanceResult:null},
  Math,JSON,Date,Number,String,Map,Set,console,
  File:class LabFakeFile{}, // Browser-global instanceof check, never upload.
  setWorkflowStep(){},getRiskAccordionHtml(warnings){output.mapWarnings=clone(warnings);return '';},
  renderSimpleDistanceMap(points,warnings){
   output.mapPoints=clone(points);output.mapWarnings=clone(warnings);
   output.polygons=clone(sandbox.window._activityPolygons);
  },
  sendDistanceCheckAnalytics(){output.analyticsCalled++},
  calculateCampsiteScore(){return {score:65,rank:'B',label:'LAB',
   summary:'LAB',comments:[]}},
  getStars(){return ''},getRankColor(){return '#000'},getScoreBar(){return ''},
  getPoiLimitWarningHtml(){return ''},renderPoiCountHtml(){return ''},
  countPoiTypesFromLayers(){return {pokestop:1,gym:1,power:1}},
  countExistingAndAddedPoi(){return {existing:1,added:2}},
  getTargetLayerDebugInfo(){return {allLayerCount:3,targetLayerCount:3,
   allPointCount:3,targetPointCount:3,targetLayerNames:['既存 PokéStop','新規 Gym','新規 PowerSpot']}}
 };
 const getMeterStart=distanceCore.indexOf('function getDistanceCheckMeters(');
 const getMeterEnd=distanceCore.indexOf('function getPrecheckDuplicatePois()',getMeterStart);
 assert(getMeterStart>0&&getMeterEnd>getMeterStart);
 vm.runInNewContext(distanceCore.slice(0,distanceCore.indexOf('/* POI上限'))+
  '\n'+distanceCore.slice(getMeterStart,getMeterEnd),sandbox);
 const auxiliaryStart=poi.lastIndexOf('function isAuxiliaryLayer(');
 assert(auxiliaryStart>0);
 vm.runInNewContext(poi.slice(auxiliaryStart),sandbox);
 // Use real Distance source from the repository, not copied math/logic.
 vm.runInNewContext(fs.readFileSync('js/distance.js','utf8'),sandbox);
 vm.runInNewContext('const POI_LIMITS={pokestop:12,gym:8,power:5};',sandbox);
 sandbox.cleanLayerName=x=>x.replace('既存','').trim();
 sandbox.escapeDistanceHtml=x=>String(x);
 sandbox.isExistingPoiPair=w=>w.a.role==='existing'&&w.b.role==='existing';
 return {run:()=>vm.runInNewContext('runDistanceCheck()',sandbox),output,
  meters:(a,b)=>vm.runInNewContext('getDistanceCheckMeters('+JSON.stringify(a)+','+JSON.stringify(b)+')',sandbox)};
}
test('actual Distance math and real 50m classification match isolated preview exactly',async()=>{
 const staged=await stage(),preview=previewDistanceCalculationLab(staged,{
  referencePois:project.wayfarerObservation.zones.reference100
 });
 const actual=actualDistanceSandbox(staged);
 await actual.run();
 assert.equal(actual.output.mapPoints.length,3);
 assert.equal(actual.output.mapWarnings.length,preview.summary.under50);
 assert.equal(preview.summary.checkedPoiPairs,3);
 assert.equal(preview.summary.under50,3);
 assert.equal(preview.summary.dense,1);
 assert.equal(preview.summary.stay,1);
 assert.equal(preview.summary.light,1);
 const pairs=actual.output.mapWarnings.map(w=>({
  a:w.a.id,b:w.b.id,meters:w.distance
 })).sort((a,b)=>a.meters-b.meters);
 for(let i=0;i<pairs.length;i++){
  const expected=preview.warnings[i],actualPair=pairs[i];
  assert.equal(actualPair.a,expected.a);
  assert.equal(actualPair.b,expected.b);
  assert(Math.abs(actualPair.meters-expected.meters)<1e-8);
 }
 assert.equal(actual.output.analyticsCalled,1,
  'real runtime would invoke analytics: sandbox must swallow it');
});
test('actual Distance map sees precisely one 31-vertex Creative area, not four-point design polygon',async()=>{
 const staged=await stage(),preview=previewDistanceCalculationLab(staged);
 const actual=actualDistanceSandbox(staged);
 await actual.run();
 assert.deepEqual(actual.output.polygons,preview.mapPreview.activityPolygons);
 assert.deepEqual(preview.mapPreview.activityAreaIds,['area-creative-31']);
 assert.equal(actual.output.polygons[0].length,31);
 assert.equal(preview.mapPreview.designPolygon.length,4);
 assert.notDeepEqual(actual.output.polygons[0],preview.mapPreview.designPolygon);
 assert.deepEqual(preview.mapPreview.acquisitionPolygon,project.wayfarerObservation.polygon);
 assert.equal(staged.legacyDistanceCommitAllowed,false);
 assert.equal(preview.realDistanceResult,false);
});
test('external reference is a separate 50m alert, never editable input; reserve remains hidden',async()=>{
 const staged=await stage(),preview=previewDistanceCalculationLab(staged,{
  referencePois:project.wayfarerObservation.zones.reference100
 });
 assert.equal(preview.summary.externalReferenceUnder50,3);
 assert.equal(preview.mapPreview.referenceCount,1);
 assert.equal(preview.mapPreview.currentPoiCount,3);
 assert(preview.externalReferenceWarnings.every(w=>w.referenceReadOnly));
 assert(preview.warnings.every(w=>w.a!=='external-ref'&&w.b!=='external-ref'));
 assert(preview.externalReferenceWarnings.every(w=>w.a!=='hidden-reserve'&&w.b!=='hidden-reserve'));
 assert.deepEqual(project,original);
});
test('real meter function matches derived preview meter function to sub-nanometer',async()=>{
 const staged=await stage(),actual=actualDistanceSandbox(staged);
 const coords=[[35.7,139.8],[35.701,139.8001],[35.702,139.802]];
 for(const a of coords)for(const b of coords){
  const x={lat:a[0],lng:a[1]},y={lat:b[0],lng:b[1]};
  assert(Math.abs(actual.meters(x,y)-distanceMetersLab(x,y))<1e-10);
 }
});
