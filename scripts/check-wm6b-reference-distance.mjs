import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
const context = { window, console, Object, Array, String, Number, Math, Set };
vm.createContext(context);
new vm.Script(
  fs.readFileSync(new URL('../creative/runtime/map-engine/wayfarer-reference-distance.js', import.meta.url), 'utf8'),
  { filename:'wayfarer-reference-distance.js' }
).runInContext(context);

const findNearest = window.bridgeMapLab_findNearestCreativePoi;
assert.equal(typeof findNearest, 'function');

const records = [
  { id:'existing-near', guid:'guid-existing', title:'Existing', layer:'existing-pokestop', latlng:[35,139], deleted:false },
  { id:'candidate-near', title:'Candidate', layer:'new-pokestop', latlng:[35,139.00025], deleted:false },
  { id:'candidate-deleted', title:'Deleted', layer:'new-gym', latlng:[35,139.00001], deleted:true },
  { id:'other-layer', title:'Ignored', layer:'notes', latlng:[35,139.00001], deleted:false }
];
const references = [
  {
    key:'marker:reference:outer-near', ownerKey:'reference:outer-near',
    origin:'reference', layerKey:'marker', observationZone:'REFERENCE_100',
    title:'Outer', geometry:{type:'point',lat:35,lng:139.00010}
  },
  {
    key:'marker:reference:inside-ignore', ownerKey:'reference:inside-ignore',
    origin:'reference', layerKey:'marker', observationZone:'INTERIOR',
    title:'Inside', geometry:{type:'point',lat:35,lng:139.000001}
  },
  {
    key:'circle50:reference:outer-near', ownerKey:'reference:outer-near',
    origin:'reference', layerKey:'circle-50', observationZone:'REFERENCE_100',
    title:'Outer', geometry:{type:'circle',lat:35,lng:139.00010,radiusMeters:50}
  },
  {
    key:'marker:reference:reserve-ignore', ownerKey:'reference:reserve-ignore',
    origin:'reference', layerKey:'marker', observationZone:'RESERVE_200',
    title:'Reserve', geometry:{type:'point',lat:35,lng:139.000001}
  }
];

const recordsBefore = JSON.stringify(records);
const refsBefore = JSON.stringify(references);

let nearest = findNearest([35,139.00008], records, references);
assert.equal(nearest.sourceType, 'REFERENCE_100');
assert.equal(nearest.guid, 'outer-near');
assert.equal(nearest.readOnly, true);
assert.ok(nearest.distanceMeters < 5);

nearest = findNearest([35,139.00024], records, references);
assert.equal(nearest.sourceType, 'NEW_CANDIDATE');
assert.equal(nearest.recordId, 'candidate-near');
assert.equal(nearest.readOnly, false);

nearest = findNearest([35,139.00024], records, references, 'candidate-near');
assert.notEqual(nearest?.recordId, 'candidate-near');
assert.equal(nearest.sourceType, 'REFERENCE_100');

nearest = findNearest([35,139.00001], records, [], '');
assert.equal(nearest.sourceType, 'EXISTING_POI');
assert.equal(nearest.recordId, 'existing-near');

assert.equal(findNearest(['bad',139], records, references), null);
assert.equal(findNearest([35,139], [], [
  references[1],
  references[2],
  references[3]
]), null, 'INTERIOR, circles and RESERVE_200 must not participate');

assert.equal(JSON.stringify(records), recordsBefore, 'editable records must not be mutated');
assert.equal(JSON.stringify(references), refsBefore, 'Reference Scene items must not be mutated');

console.log('WM-6B Reference-aware nearest distance: PASS');
