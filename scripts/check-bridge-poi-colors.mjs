import fs from 'node:fs';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('js/bridge-wayfarer-poi-colors.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const runtimeParts = fs.readdirSync('dist/bridge-shortcut/1.0.0')
  .filter(name => /^runtime\.part-\d+\.js$/.test(name))
  .sort()
  .map(name => fs.readFileSync(`dist/bridge-shortcut/1.0.0/${name}`, 'utf8'))
  .join('');
const pcManifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const androidBuilder = fs.readFileSync('scripts/build-android-bridge-0.3.6-unsigned.mjs', 'utf8');

for (const entity of ['POKESTOP', 'GYM', 'POWERSPOT']) {
  assert.ok(shared.includes(entity), `shared overlay must support ${entity}`);
  assert.ok(runtimeParts.includes(entity), `iPhone native overlay must support ${entity}`);
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
assert.ok(!launcher.includes('bridge-wayfarer-poi-colors.js'), 'iPhone must not create a second overlay from the launcher');
assert.ok(runtimeParts.includes('function createGameEntityOverlay'), 'iPhone must draw POI colors on its existing native overlay');
assert.ok(runtimeParts.includes('if (!wfmmPresent)'), 'iPhone native markers must yield to WFMM');
assert.ok(runtimeParts.includes("marker.dataset.cbsGameEntity = entity"), 'iPhone native entity markers must use the Bridge overlay');
assert.ok(runtimeParts.includes("pointerEvents: 'none'"), 'iPhone native markers must not block map interaction');
assert.ok(runtimeParts.includes('function isWayfarerDetailSheetOpen'), 'iPhone overlay must detect Wayfarer detail sheets');
assert.ok(runtimeParts.includes("'mat-bottom-sheet-container'"), 'iPhone overlay should recognize Angular bottom sheets');
assert.ok(runtimeParts.includes('detailSheetOpen'), 'iPhone overlay must suppress POI markers while a detail sheet is open');
assert.ok(!runtimeParts.includes('runtime.part-08'), 'iPhone runtime must not depend on the removed duplicate overlay tail');

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

console.log('Bridge POI Engine map display checks: OK');
