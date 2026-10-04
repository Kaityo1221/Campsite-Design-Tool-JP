import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const patchSource = fs.readFileSync(new URL('../creative/wayfarer-reference-layer-patch.js', import.meta.url), 'utf8');
const indexSource = fs.readFileSync(new URL('../creative/index.html', import.meta.url), 'utf8');
const observeSource = fs.readFileSync(new URL('../creative/wayfarer-observe-link-patch.js', import.meta.url), 'utf8');

assert.ok(indexSource.includes("fetch('./wayfarer-reference-layer-patch.js'"), 'Creative loader must fetch WM-3C patch');
assert.ok(indexSource.includes("Function(await extras[4].text())();"), 'Creative loader must execute WM-3C patch source');
assert.ok(indexSource.includes('applyCreativeWayfarerReferenceLayerPatch'), 'Creative loader must apply WM-3C patch for Bridge Project');
assert.ok(observeSource.includes("campsite:wayfarer-observation-saved"), 'Observation save must publish Reference refresh event');

const patchWindow = {};
vm.runInNewContext(patchSource, { window: patchWindow, console, String, Object, Array });
assert.equal(typeof patchWindow.applyCreativeWayfarerReferenceLayerPatch, 'function');

const fixture = `<html><head><script src="./runtime/map-engine/map-renderer.js?v=5d14"></script></head><body><script>
(()=>{'use strict';
const records=[{guid:'editable-1',layer:'existing-pokestop',latlng:[35.001,139.001]}];
const polygons=[{id:'activity-1',deleted:false,points:[[35,139],[35,139.002],[35.002,139.002],[35.002,139]]}];
function cmCandidateShadowSignature(){return '{}'}
function cmCandidateShadowScene(){return Object.freeze({items:Object.freeze([{key:'marker:poi:editable-1',ownerKey:'poi:editable-1',origin:'existing',renderKind:'POKESTOP',layerKey:'marker',geometry:{type:'point',lat:35.001,lng:139.001}}])})}
window.__wm5bSetPolygon=points=>{polygons[0].points=points;polygons[0].deleted=false};
})();
</script></body></html>`;
const html = patchWindow.applyCreativeWayfarerReferenceLayerPatch(fixture);
assert.ok(html.includes('wayfarer-reserve-coverage.js?v=wm5a1'));
assert.ok(html.includes('wayfarer-local-reclassification.js?v=wm5b1'));
assert.ok(html.includes('wayfarer-observation-adapter.js?v=wm3c4'));
assert.ok(html.includes('wayfarer-reference-geometry.js?v=wm6a1'));
assert.ok(html.includes('wayfarer-reference-scene-builder.js?v=wm6a1'));
assert.ok(html.includes('wayfarer-reference-distance.js?v=wm6b1'));
assert.ok(html.includes('map-renderer.js?v=5d15'), 'Bridge Project must cache-bust Reference-capable renderer');
assert.ok(html.includes('cmWm3cReferenceRuntime'));

const start = html.indexOf("(()=>{'use strict';");
const end = html.indexOf('</script>', start);
const core = html.slice(start, end);
new vm.Script(core, { filename: 'wm3c-generated-core.js' });

const listeners = new Map();
let refreshCount = 0;
const window = {
  addEventListener(name, callback) { listeners.set(name, callback); },
  __cmCandidateShadow: { refresh() { refreshCount += 1; } }
};
const observation = {
  snapshotId:'wm5b2a-static',
  observedAt:'2026-10-02T14:20:00.000Z',
  polygon:[[35,139],[35,139.002],[35.002,139.002],[35.002,139]],
  acquisition:{bufferMeters:200,coverageComplete:false},
  zones: {
    interior: [
      { guid:'inside-1', title:'Inside', lat:35.0014, lng:139.0014, poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE' },
      { guid:'editable-1', title:'Duplicate editable', lat:35.001, lng:139.001, poiKind:'POKESTOP', gameEntity:'POKESTOP', gameStatus:'ACTIVE' }
    ],
    reference100: [
      { guid:'outer-1', title:'Outer', lat:35.0024, lng:139.001, poiKind:'GYM', gameEntity:'GYM', gameStatus:'ACTIVE' }
    ],
    reserve200: [
      { guid:'reserve-1', title:'Reserve', lat:35.003, lng:139.002, poiKind:'POWERSPOT', gameEntity:'POWERSPOT', gameStatus:'ACTIVE' }
    ]
  }
};
const sessionStorage = { getItem(key) { return key === 'campsiteProject.v1' ? JSON.stringify({source:'bridge',wayfarerObservation:observation}) : null; } };
const context = { window, sessionStorage, console, JSON, Object, Array, Set, String, Number, TypeError, Error };
vm.createContext(context);
for (const path of [
  '../creative/runtime/map-engine/wayfarer-reserve-coverage.js',
  '../creative/runtime/map-engine/wayfarer-local-reclassification.js',
  '../creative/runtime/map-engine/wayfarer-observation-adapter.js',
  '../creative/runtime/map-engine/wayfarer-reference-geometry.js',
  '../creative/runtime/map-engine/wayfarer-reference-scene-builder.js',
  '../creative/runtime/map-engine/wayfarer-reference-distance.js'
]) {
  new vm.Script(fs.readFileSync(new URL(path, import.meta.url), 'utf8')).runInContext(context);
}
new vm.Script(core).runInContext(context);

const merged = window.__cmWayfarerReference.getScene();
assert.equal(merged.items.filter(item => item.origin === 'reference' && item.layerKey === 'marker').length, 2, 'Only non-duplicate INTERIOR/REFERENCE_100 POIs should render');
assert.ok(!merged.items.some(item => String(item.ownerKey).includes('reserve-1')), 'RESERVE_200 must stay hidden');
assert.ok(!merged.items.some(item => item.key === 'marker:reference:editable-1'), 'Editable GUID must suppress observation duplicate');
const state = window.__cmWayfarerReference.getState();
assert.equal(state.display, 2);
assert.equal(state.reserve, 1);
assert.equal(state.suppressed, 1);
assert.equal(state.localCanUse, true);
assert.equal(state.localReason, 'LOCAL_RECLASSIFICATION_AVAILABLE');
assert.equal(state.coverageReason, 'COVERED');

window.__wm5bSetPolygon([[35.0012,139],[35.0012,139.002],[35.0032,139.002],[35.0032,139]]);
const outside = window.__cmWayfarerReference.getScene();
assert.equal(outside.items.filter(item => item.origin === 'reference').length, 0, 'Outside-reserve polygon must not keep stale Reference items');
const outsideState = window.__cmWayfarerReference.getState();
assert.equal(outsideState.localCanUse, false);
assert.equal(outsideState.localReason, 'REACQUIRE_REQUIRED');
assert.equal(outsideState.coverageReason, 'OUTSIDE_RESERVE');

listeners.get('campsite:wayfarer-observation-saved')?.({});
assert.equal(refreshCount, 1, 'Observation save event must trigger keyed renderer refresh');

console.log('WM-3C-4 Creative Reference Integration: PASS');
