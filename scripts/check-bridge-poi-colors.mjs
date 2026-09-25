import fs from 'node:fs';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('js/bridge-wayfarer-poi-colors.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const recovery = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-06z.iphone-recovery.js', 'utf8');
const policy = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-09.iphone-wfmm-color-policy.js', 'utf8');
const pcBuilder = fs.readFileSync('scripts/build-pc-bridge.mjs', 'utf8');
const androidBuilder = fs.readFileSync('scripts/build-android-bridge-0.3.6-unsigned.mjs', 'utf8');
const pcManifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
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

// Keep the retired source readable until Stage 7 finishes CI/archive cleanup,
// but Stage 6 forbids it from every shipped Bridge runtime.
assert.ok(shared.includes('CampsiteBridgePoiColors'), 'retired overlay source unexpectedly missing before Stage 7 cleanup');
new Function(builtRuntime);

// iPhone Stage 5 stays data-only.
assert.ok(launcher.includes("const LAUNCHER_VERSION = '1.3.0'"), 'iPhone launcher version must reflect Stage 5');
assert.ok(launcher.includes('campsite-bridge-shortcut-runtime.js'), 'iPhone launcher must stay runtime-only');
assert.ok(!launcher.includes('bridge-wayfarer-poi-colors.js'), 'iPhone launcher must not inject the retired Bridge overlay');
assert.ok(!launcher.includes('NATIVE_MARKER_POLICY_URL'), 'launcher must not fetch the legacy native marker policy');
assert.ok(!launcher.includes('runtime.part-10.iphone-native-wayfarer-marker-policy.js'), 'legacy native marker policy must not be loaded');

assert.ok(recovery.includes("const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs'"), 'iPhone runtime must keep GCS recovery for POI collection');
assert.ok(recovery.includes("map.addListener('idle'"), 'iPhone recovery must refresh from map idle instead of continuous polling');
assert.ok(recovery.includes('visualFallback: false'), 'iPhone recovery must declare visual fallback retired');
assert.ok(recovery.includes('continuousPolling: false'), 'iPhone recovery must declare continuous polling retired');
assert.ok(recovery.includes('bridgeOwnedMapVisuals: false'), 'Bridge-owned iPhone map visuals must stay disabled');
assert.ok(!recovery.includes('IPHONE_COLOR_ROOT_ID'), 'fixed iPhone color root must stay removed');
assert.ok(!recovery.includes('viewportPointForPoi'), 'manual iPhone viewport projection must stay removed');
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

// Stage 6: PC Bridge ships acquisition/classification/diagnostics/export only.
const mainEntry = pcManifest.content_scripts?.find(entry => entry.world === 'MAIN');
assert.ok(mainEntry, 'PC manifest MAIN-world entry missing');
assert.ok(mainEntry.js?.includes('wayfarer-map-adapter.js'), 'PC must load Wayfarer map adapter');
assert.ok(mainEntry.js?.includes('wayfarer-display-owner.js'), 'PC must load display owner diagnostics');
assert.ok(mainEntry.js?.includes('wayfarer-deck-compat.js'), 'PC must load guarded deck compatibility');
assert.ok(mainEntry.js?.includes('poi-parser.js'), 'PC must load POI Parser');
assert.ok(mainEntry.js?.includes('poi-classifier.js'), 'PC must load POI Classifier');
assert.ok(mainEntry.js?.includes('bridge-v1-exporter.js'), 'PC must load Bridge V1 exporter');
assert.ok(mainEntry.js?.includes('page-collector.js'), 'PC must load page collector');
assert.ok(!mainEntry.js?.includes('wayfarer-poi-colors.js'), 'PC must not load the retired POI overlay');
assert.ok(pcBuilder.includes("const retiredPoiOverlay = path.join(sourceDir, 'wayfarer-poi-colors.js')"), 'PC builder must identify stale retired overlay output');
assert.ok(pcBuilder.includes('fs.rmSync(retiredPoiOverlay, { force: true })'), 'PC builder must delete stale overlay output before packaging');
assert.ok(!pcBuilder.includes("const sharedPoiColors = 'js/bridge-wayfarer-poi-colors.js'"), 'PC builder must not source the retired overlay');
assert.ok(pcBuilder.includes("mainScripts.includes('wayfarer-poi-colors.js')"), 'PC builder must reject a manifest that re-adds the retired overlay');

// Stage 6: Android 0.3.6 also leaves map display to Wayfarer/WFMM.
assert.ok(androidBuilder.includes("VERSION = '0.3.6'"), 'Android candidate version must be 0.3.6');
assert.ok(!androidBuilder.includes("const SHARED_VISUALS = 'js/bridge-wayfarer-poi-colors.js'"), 'Android builder must not source the retired overlay');
assert.ok(!androidBuilder.includes('pageHook += `\\n\\n/* ${MARKER} */'), 'Android builder must not append the retired overlay');
assert.ok(androidBuilder.includes('RETIRED_VISUAL_MARKERS'), 'Android builder must guard against retired visual code');
assert.ok(androidBuilder.includes('POI display stays with Wayfarer/WFMM'), 'Android manifest description must reflect display ownership');
assert.ok(androidBuilder.includes('Mozilla signing is required'), 'Android candidate must clearly remain unsigned');

console.log('Bridge display policy checks: Stage 6 overlay retirement active on iPhone, PC and Android');
