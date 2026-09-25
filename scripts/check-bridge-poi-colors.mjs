import fs from 'node:fs';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('js/bridge-wayfarer-poi-colors.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const iPhoneRuntimeParts = [
  'runtime.part-00.js',
  'runtime.part-01.js',
  'runtime.part-02.js',
  'runtime.part-03.js',
  'runtime.part-04.js',
  'runtime.part-05.js',
  'runtime.part-06.js',
  'runtime.part-06z.iphone-recovery.js',
  'runtime.part-07.js',
  'runtime.part-09.iphone-wfmm-color-policy.js'
];
const builtRuntime = iPhoneRuntimeParts
  .map(name => fs.readFileSync(`dist/bridge-shortcut/1.0.0/${name}`, 'utf8'))
  .join('');
const policy = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-09.iphone-wfmm-color-policy.js', 'utf8');
const pcManifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const androidBuilder = fs.readFileSync('scripts/build-android-bridge-0.3.6-unsigned.mjs', 'utf8');

for (const entity of ['POKESTOP', 'GYM', 'POWERSPOT']) {
  assert.ok(shared.includes(entity), `shared overlay must support ${entity}`);
}

assert.ok(shared.includes("VERSION = '1.1.0'"), 'shared map display version must be 1.1.0');
assert.ok(shared.includes('window.CampsiteBridgePoiParser'), 'PC map display must be able to consume the shared POI Parser');
assert.ok(shared.includes('window.CampsiteBridgePoiClassifier'), 'PC map display must use POI Engine classification when available');
assert.ok(shared.includes('classifier.run(parsed)'), 'classification source of truth must feed map display');
assert.ok(shared.includes('raw.poiKind || raw.gameEntity'), 'renderer must accept Engine poiKind without reclassification');
assert.ok(shared.includes("window.WFMM"), 'shared overlay must prefer WFMM when present');
assert.ok(shared.includes("overlayRoot.style.display = 'none'"), 'shared overlay must hide Bridge markers under WFMM');
assert.ok(shared.includes("pointerEvents: 'none'"), 'Bridge markers must not block Wayfarer map interaction');
assert.ok(shared.includes("'/api/v1/vault/mapview/gcs'"), 'shared overlay must observe the Wayfarer map payload');
assert.ok(shared.includes("status === 'INACTIVE'"), 'inactive records must not be painted by the base overlay');
assert.ok(!shared.includes('NOT_IN_GAME'), 'Not in Game must remain hidden from the Bridge map overlay');
assert.ok(!shared.includes('NOT IN GAME'), 'Not in Game must remain hidden from the Bridge map overlay');

assert.ok(shared.includes('fromLatLngToDivPixel(new LatLng(poi.lat, poi.lng))'), 'markers must be projected directly from normalized lat/lng');
assert.ok(!shared.includes('poi.lat +'), 'renderer must not apply latitude offsets');
assert.ok(!shared.includes('poi.lng +'), 'renderer must not apply longitude offsets');
assert.ok(shared.includes("POKESTOP: { fill: '#22b8f0', border: '#1738b8', size: 24"), 'PokéStop visual contract changed unexpectedly');
assert.ok(shared.includes("GYM: { fill: '#f04463', border: '#b91c3c', size: 24"), 'Gym visual contract changed unexpectedly');
assert.ok(shared.includes("POWERSPOT: { fill: '#de65d2', border: '#9b2aa7', size: 28"), 'Power Spot must remain visually larger than the other two entities');
assert.ok(shared.includes("glyph: '●'"), 'PokéStop marker glyph missing');
assert.ok(shared.includes("glyph: '▲'"), 'Gym marker glyph missing');
assert.ok(shared.includes("glyph: '◆'"), 'Power Spot marker glyph missing');

assert.ok(launcher.includes('campsite-bridge-shortcut-runtime.js'), 'iPhone launcher must stay runtime-only');
assert.ok(!launcher.includes('bridge-wayfarer-poi-colors.js'), 'iPhone launcher must not inject the shared Bridge color overlay');
assert.ok(builtRuntime.includes("const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs'"), 'iPhone runtime must keep GCS recovery for POI collection');
assert.ok(builtRuntime.includes('window.CampsiteBridgeIPhonePoiColorPolicy'), 'iPhone runtime must publish the WFMM-only color policy');
assert.ok(policy.includes("provider: 'WFMM'"), 'iPhone POI color provider must be WFMM');
assert.ok(policy.includes('bridgeColors: false'), 'iPhone Bridge colors must stay disabled');
assert.ok(policy.includes('[data-cbs-game-entity]'), 'policy must suppress the base Bridge entity markers');
assert.ok(!iPhoneRuntimeParts.includes('runtime.part-08.iphone-native-markers.js'), 'native marker experiment must not ship');
assert.ok(!iPhoneRuntimeParts.includes('runtime.part-06zz.iphone-dom-overlay.js'), 'DOM overlay experiment must not ship');
assert.ok(!iPhoneRuntimeParts.includes('runtime.part-06zzzzzz.iphone-forced-poi-colors.js'), 'forced color experiment must not ship');

const mainEntry = pcManifest.content_scripts?.find(entry => entry.world === 'MAIN');
assert.ok(mainEntry, 'PC manifest MAIN-world entry missing');
assert.ok(mainEntry.js?.includes('poi-parser.js'), 'PC must load POI Parser');
assert.ok(mainEntry.js?.includes('poi-classifier.js'), 'PC must load POI Classifier');
assert.ok(mainEntry.js?.includes('wayfarer-poi-colors.js'), 'PC must load shared POI map display');
assert.ok(mainEntry.js.indexOf('poi-parser.js') < mainEntry.js.indexOf('poi-classifier.js'), 'Parser must load before Classifier');
assert.ok(mainEntry.js.indexOf('poi-classifier.js') < mainEntry.js.indexOf('wayfarer-poi-colors.js'), 'Classifier must load before map display');
assert.ok(mainEntry.js.indexOf('wayfarer-poi-colors.js') < mainEntry.js.indexOf('page-collector.js'), 'map display must load before collector passive fetches begin');

assert.ok(androidBuilder.includes('bridge-wayfarer-poi-colors.js'), 'Android 0.3.6 builder must embed the shared overlay');
assert.ok(androidBuilder.includes("VERSION = '0.3.6'"), 'Android candidate version must be 0.3.6');
assert.ok(androidBuilder.includes('Mozilla signing is required'), 'Android candidate must clearly remain unsigned');

console.log('Bridge POI display policy checks: OK');
