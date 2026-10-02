import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const window = {};
const context = { window, console, Object, Array, Set, String, Number, TypeError };
for (const path of [
  '../creative/runtime/map-engine/wayfarer-observation-adapter.js',
  '../creative/runtime/map-engine/wayfarer-reference-geometry.js',
  '../creative/runtime/map-engine/wayfarer-reference-scene-builder.js'
]) {
  vm.runInNewContext(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), context);
}

const observation = {
  zones: {
    interior: [
      { guid: 'inside-stop', title: 'Inside', lat: 35, lng: 139, poiKind: 'POKESTOP', gameStatus: 'ACTIVE' }
    ],
    reference100: [
      { guid: 'outer-gym', title: 'Outer', lat: 35.001, lng: 139.001, poiKind: 'GYM', gameStatus: 'ACTIVE' }
    ],
    reserve200: [
      { guid: 'reserve-power', title: 'Reserve', lat: 35.002, lng: 139.002, poiKind: 'POWERSPOT', gameStatus: 'ACTIVE' }
    ]
  }
};

const adapted = window.bridgeMapLab_adaptWayfarerObservation(observation, []);
assert.equal(adapted.displayPois.length, 2);
assert.equal(adapted.reservePois.length, 1);

const geometry = window.bridgeMapLab_buildWayfarerReferenceGeometry(adapted.displayPois);
assert.equal(geometry.entries.length, 2);
assert.ok(geometry.entries.every(entry => entry.circle50Geometry?.radiusMeters === 50));
assert.ok(geometry.entries.every(entry => !('circle40Geometry' in entry) && !('circle30Geometry' in entry)), 'Reference Geometry must not create 40m/30m circles');
assert.ok(geometry.entries.every(entry => entry.readOnly === true));

const scene = window.bridgeMapLab_buildWayfarerReferenceScene(geometry);
assert.equal(scene.items.length, 4, 'Each visible reference POI should produce marker + 50m circle only');
assert.deepEqual(new Set(scene.items.map(item => item.layerKey)), new Set(['marker', 'circle-50']));
assert.ok(scene.items.every(item => item.origin === 'reference' && item.readOnly === true && item.source === 'wayfarer-observation'));
assert.ok(scene.items.every(item => !String(item.ownerKey).includes('reserve-power')), 'RESERVE_200 must not enter Reference Scene');

const insideMarker = scene.items.find(item => item.key === 'marker:reference:inside-stop');
const outerMarker = scene.items.find(item => item.key === 'marker:reference:outer-gym');
assert.equal(insideMarker?.observationZone, 'INTERIOR');
assert.equal(outerMarker?.observationZone, 'REFERENCE_100');
assert.ok(Number(outerMarker?.style?.opacity) < Number(insideMarker?.style?.opacity), 'REFERENCE_100 marker must be lighter than INTERIOR');
assert.ok(scene.items.some(item => item.key === 'circle50:reference:inside-stop'));
assert.ok(scene.items.some(item => item.key === 'circle50:reference:outer-gym'));
assert.ok(!scene.items.some(item => /circle(30|40):/.test(item.key)), 'Reference Scene must not contain 30m/40m circles');

const baseScene = Object.freeze({ items: Object.freeze([
  Object.freeze({ key: 'marker:poi:editable-1', layerKey: 'marker', geometry: { type: 'point', lat: 35, lng: 139 } })
]) });
const merged = window.bridgeMapLab_mergeSceneWithWayfarerReferences(baseScene, scene);
assert.equal(merged.items.length, 5);
assert.equal(baseScene.items.length, 1, 'Scene merge must not mutate base Scene');
assert.equal(scene.items.length, 4, 'Scene merge must not mutate Reference Scene');
assert.throws(() => window.bridgeMapLab_mergeSceneWithWayfarerReferences(
  { items: [{ key: 'marker:reference:inside-stop' }] },
  scene
), /Duplicate merged Scene key/);

console.log('WM-3C-2 Reference Geometry + Scene: PASS');
