import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {inspectCampsiteDistanceReturnStageLab,stageCurrentPoisLab}
 from '../contracts/campsite-distance-return-stage-lab.mjs';

const {project,makeKmz}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const expected=project(),kmzBytes=new Uint8Array(await makeKmz());
const clone=x=>JSON.parse(JSON.stringify(x));
const options=()=>({
 project:clone(expected),activityAreas:[],kmzBytes:new Uint8Array(kmzBytes),
 expectedProjectId:expected.projectId,expectedHandoffId:expected.meta.bridgeHandoffId,
 JSZip,DOMParser,cryptoProvider:webcrypto
});
// Instrument the genuine existing Distance runtime ONLY in the VM test.
// Nothing is modified in js/bridge-distance-project.js or in a running app.
const js=fs.readFileSync('js/bridge-distance-project.js','utf8');
const hook="  if (document.readyState === 'loading')";
assert(js.includes(hook),'legacy Distance runtime hook absent: investigate rather than skip');
const browser={window:{},document:{readyState:'loading',addEventListener(){},getElementById(){return null}},
 sessionStorage:{getItem(){return null},setItem(){throw Error('PRODUCTION_STORAGE_WRITE')}},
 URLSearchParams,location:{search:''},setInterval(){throw Error('LEGACY_BOOT_UNEXPECTED')},
 setTimeout(){throw Error('LEGACY_TIMER_UNEXPECTED')},console,Date,Number,String,Map,Set,Math,JSON};
vm.runInNewContext(js.replace(hook,
 "  window.__LAB__={buildLayerPoints,buildDistanceSnapshot,populateDistanceUi};\n"+hook),browser);
const legacy=browser.window.__LAB__;
assert(legacy,'legacy Distance functions not exposed by instrumentation');

test('return staging uses genuine legacy Distance POI grouping without coercion',()=>{
 const p=clone(expected);
 p.currentPois.push({
  id:'creative-added-1',role:'added',gameEntity:'GYM',gameStatus:'UNKNOWN',
  title:'New Gym',lat:35.7014,lng:139.8014,
  applicationComment:'Review later',provenance:[]
 });
 const groups=stageCurrentPoisLab(p);
 assert.deepEqual(groups,clone(legacy.buildLayerPoints(p)));
 assert.equal(groups['新規 Gym'][0].id,'creative-added-1');
 assert.equal(groups['既存 PokéStop'][0].guid,'existing-guid');
 assert.equal(groups['新規 Gym'][0].gameStatus,'UNKNOWN',
  'unknown is not upgraded to ACTIVE');
});

test('real Distance currently restores selectedPois after a zero-length currentPois; staging refuses',()=>{
 const p=clone(expected);p.currentPois=[];
 const legacyGroups=clone(legacy.buildLayerPoints(p));
 assert.equal(legacyGroups['既存 PokéStop'].length,1,
  'baseline hazard documented: old selected POI may reappear');
 assert.throws(()=>stageCurrentPoisLab(p),{code:'DISTANCE_LEGACY_SELECTION_FALLBACK_HOLD'});
});

test('actual Distance maps design polygon into activityPolygons; staging keeps channels typed and uncommitted',async()=>{
 const actual=await inspectCampsiteDistanceReturnStageLab(options());
 assert.equal(actual.status,'LAB_DISTANCE_INPUT_STAGED_READ_ONLY');
 assert.equal(actual.writeAllowed,false);
 assert.equal(actual.legacyDistanceCommitAllowed,false);
 assert.equal(actual.legacyActivityAreaConflict,false);
 assert.equal(actual.distanceInput.legacyActivityPolygonMapping,'UNAPPROVED');
 assert.deepEqual(actual.distanceInput.designPolygon,expected.polygon);
 assert.deepEqual(actual.distanceInput.acquisitionPolygon,expected.wayfarerObservation.polygon);
 assert.deepEqual(actual.distanceInput.activityAreas,[]);
 assert.equal(actual.distanceInput.recomputeDistanceRequired,true);
 const p=clone(expected);
 legacy.populateDistanceUi(p,legacy.buildLayerPoints(p));
 assert.deepEqual(clone(browser.window._activityPolygons),[p.polygon],
   'real legacy Distance map currently overloads activityPolygons with design polygon');
 assert.equal(actual.productionReady,false);
});

test('strict distance stage rejects ambiguous identity/entity/location without changing source',()=>{
 const source=clone(expected);
 const a=clone(source);a.currentPois[0].role='new';assert.throws(()=>stageCurrentPoisLab(a),{code:'DISTANCE_ROLE_HOLD'});
 const b=clone(source);b.currentPois[0].gameEntity='BANNED';assert.throws(()=>stageCurrentPoisLab(b),{code:'DISTANCE_ENTITY_HOLD'});
 const c=clone(source);c.currentPois[0].guid='';assert.throws(()=>stageCurrentPoisLab(c),{code:'DISTANCE_POI_ID_REQUIRED'});
 const d=clone(source);d.currentPois[0].lat=Infinity;assert.throws(()=>stageCurrentPoisLab(d),{code:'DISTANCE_COORD_HOLD'});
 const e=clone(source);e.currentPois.push(clone(e.currentPois[0]));assert.throws(()=>stageCurrentPoisLab(e),{code:'DISTANCE_POI_DUPLICATE'});
 assert.deepEqual(source,expected);
});
