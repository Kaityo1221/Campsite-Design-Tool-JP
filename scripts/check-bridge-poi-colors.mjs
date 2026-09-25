import fs from 'node:fs';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('js/bridge-wayfarer-poi-colors.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const recovery = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-06z.iphone-recovery.js', 'utf8');
const policy = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-09.iphone-wfmm-color-policy.js', 'utf8');
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
const pcManifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const androidBuilder = fs.readFileSync('scripts/build-android-bridge-0.3.6-unsigned.mjs', 'utf8');

// The concatenated Shortcut runtime must remain syntactically valid.
new Function(builtRuntime);

for (const entity of ['POKESTOP', 'GYM', 'POWERSPOT']) {
  assert.ok(shared.includes(entity), `shared overlay must support ${entity}`);
}

// PC/Android still use the shared overlay until Stage 6.
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

// iPhone Stage 5: data collection remains, every legacy visual intervention is retired.
assert.ok(launcher.includes("const LAUNCHER_VERSION = '1.3.0'"), 'iPhone launcher version must reflect Stage 5');
assert.ok(launcher.includes('campsite-bridge-shortcut-runtime.js'), 'iPhone launcher must stay runtime-only');
assert.ok(!launcher.includes('bridge-wayfarer-poi-colors.js'), 'iPhone launcher must not inject the shared Bridge color overlay');
assert.ok(!launcher.includes('NATIVE_MARKER_POLICY_URL'), 'launcher must not fetch the legacy native marker policy');
assert.ok(!launcher.includes('runtime.part-10.iphone-native-wayfarer-marker-policy.js'), 'legacy native marker policy must not be loaded');
assert.ok(launcher.includes('legacy native marker policy: retired'), 'launcher diagnostics must report native marker retirement');

assert.ok(recovery.includes("const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs'"), 'iPhone runtime must keep GCS recovery for POI collection');
assert.ok(recovery.includes("credentials: 'include'"), 'iPhone GCS recovery must retain authenticated fetches');
assert.ok(recovery.includes("map.addListener('idle'"), 'iPhone recovery must refresh from map idle instead of continuous polling');
assert.ok(recovery.includes('window.CampsiteBridgeIPhoneRecovery'), 'iPhone recovery API must remain available');
assert.ok(recovery.includes('visualFallback: false'), 'iPhone recovery must declare visual fallback retired');
assert.ok(recovery.includes('continuousPolling: false'), 'iPhone recovery must declare continuous polling retired');
assert.ok(recovery.includes('window.CampsiteBridgeIPhoneVisualPolicy'), 'iPhone visual retirement policy must be published');
assert.ok(recovery.includes('bridgeOwnedMapVisuals: false'), 'Bridge-owned iPhone map visuals must stay disabled');
assert.ok(recovery.includes('gameEntityOverlay: false'), 'iPhone game entity overlay must stay disabled');
assert.ok(recovery.includes('sponsorRingOverlay: false'), 'iPhone sponsor ring overlay must stay disabled');
assert.ok(recovery.includes('manualViewportProjection: false'), 'manual iPhone viewport projection must stay disabled');
assert.ok(recovery.includes('createGameEntityOverlay = () => null'), 'legacy game entity renderer must be neutralized');
assert.ok(recovery.includes('scheduleOverlayRender = clearBridgeMapVisuals'), 'legacy overlay scheduler must be neutralized');
assert.ok(!recovery.includes('IPHONE_COLOR_ROOT_ID'), 'fixed iPhone color root must be removed');
assert.ok(!recovery.includes('viewportPointForPoi'), 'manual viewport projection must be removed');
assert.ok(!recovery.includes('makeIphoneColorMarker'), 'fixed color marker creation must be removed');
assert.ok(!recovery.includes('renderLatestRangeFallback'), 'latest-range visual fallback must be removed');
assert.ok(!recovery.includes('setInterval('), 'iPhone recovery must not run continuous polling');
assert.ok(!recovery.includes('MutationObserver'), 'iPhone recovery must not observe the whole document');

assert.ok(policy.includes("provider: 'WAYFARER_OR_WFMM'"), 'iPhone display provider must remain Wayfarer/WFMM');
assert.ok(policy.includes('bridgeColors: false'), 'iPhone Bridge colors must stay disabled');
assert.ok(policy.includes('hideWayfarerHollowDots: false'), 'Bridge must no longer hide native Wayfarer dots');
assert.ok(policy.includes('legacyDomScanning: false'), 'legacy DOM color scanning must remain disabled');
assert.ok(policy.includes('legacyCanvasSampling: false'), 'legacy canvas sampling must remain disabled');
assert.ok(policy.includes('mutationObserver: false'), 'legacy display observer must remain disabled');
assert.ok(policy.includes('polling: false'), 'legacy display polling must remain disabled');
assert.ok(!policy.includes('MutationObserver'), 'iPhone display policy must not create MutationObservers');
assert.ok(!policy.includes('setInterval('), 'iPhone display policy must not poll');
assert.ok(!policy.includes('querySelectorAll('), 'iPhone display policy must not scan marker DOM');
assert.ok(!policy.includes('getImageData('), 'iPhone display policy must not sample marker pixels');
assert.ok(!policy.includes('isWayfarerOrange'), 'color-guess detection must stay removed');

assert.ok(!iPhoneRuntimeParts.includes('runtime.part-08.iphone-native-markers.js'), 'native marker experiment must not ship');
assert.ok(!iPhoneRuntimeParts.includes('runtime.part-06zz.iphone-dom-overlay.js'), 'DOM overlay experiment must not ship');
assert.ok(!iPhoneRuntimeParts.includes('runtime.part-06zzzzzz.iphone-forced-poi-colors.js'), 'forced color experiment must not ship');
assert.ok(!iPhoneRuntimeParts.includes('runtime.part-10.iphone-native-wayfarer-marker-policy.js'), 'Angular marker policy must not ship');

const mainEntry = pcManifest.content_scripts?.find(entry => entry.world === 'MAIN');
assert.ok(mainEntry, 'PC manifest MAIN-world entry missing');
assert.ok(mainEntry.js?.includes('poi-parser.js'), 'PC must load POI Parser');
assert.ok(mainEntry.js?.includes('poi-classifier.js'), 'PC must load POI Classifier');
assert.ok(mainEntry.js?.includes('wayfarer-poi-colors.js'), 'PC must load shared POI map display until Stage 6');
assert.ok(mainEntry.js.indexOf('poi-parser.js') < mainEntry.js.indexOf('poi-classifier.js'), 'Parser must load before Classifier');
assert.ok(mainEntry.js.indexOf('poi-classifier.js') < mainEntry.js.indexOf('wayfarer-poi-colors.js'), 'Classifier must load before map display');

assert.ok(androidBuilder.includes('bridge-wayfarer-poi-colors.js'), 'Android 0.3.6 builder must embed the shared overlay until Stage 6');
assert.ok(androidBuilder.includes("VERSION = '0.3.6'"), 'Android candidate version must be 0.3.6');
assert.ok(androidBuilder.includes('Mozilla signing is required'), 'Android candidate must clearly remain unsigned');

console.log('Bridge display policy checks: iPhone data-only Stage 5 + PC/Android pre-Stage-6 OK');
