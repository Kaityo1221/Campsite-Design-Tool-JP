import fs from 'node:fs';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const pcBuilder = fs.readFileSync('scripts/build-pc-bridge.mjs', 'utf8');
const androidBuilder = fs.readFileSync('scripts/build-android-bridge-0.3.6-unsigned.mjs', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const recovery = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-06z.iphone-recovery.js', 'utf8');
const networkRecovery = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-06zz.iphone-network-recovery.js', 'utf8');
const iphonePolicy = fs.readFileSync('dist/bridge-shortcut/1.0.0/runtime.part-09.iphone-wfmm-color-policy.js', 'utf8');
const displayOwner = fs.readFileSync('js/bridge-wayfarer-display-owner.js', 'utf8');
const deckCompat = fs.readFileSync('js/bridge-wayfarer-deck-compat.js', 'utf8');
const collector = fs.readFileSync('bridge-pc/page-collector.js', 'utf8');
const parser = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifier = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const diagnostics = fs.readFileSync('bridge-pc/poi-diagnostics.js', 'utf8');
const exporter = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');

assert.equal(
  fs.existsSync('js/bridge-wayfarer-poi-colors.js'),
  false,
  'Retired Bridge POI overlay source must stay deleted'
);

const mainEntry = manifest.content_scripts?.find(entry => entry.world === 'MAIN');
assert.ok(mainEntry, 'PC manifest MAIN-world entry missing');
assert.deepEqual(mainEntry.js, [
  'wayfarer-map-adapter.js',
  'wayfarer-display-owner.js',
  'wayfarer-deck-compat.js',
  'poi-parser.js',
  'poi-classifier.js',
  'poi-diagnostics.js',
  'bridge-v1-exporter.js',
  'page-collector.js'
], 'PC MAIN-world architecture changed');
assert.ok(!mainEntry.js.includes('wayfarer-poi-colors.js'), 'PC must never load a Bridge POI renderer');

const runtimeSources = {
  displayOwner,
  deckCompat,
  collector,
  parser,
  classifier,
  diagnostics,
  exporter
};
const forbiddenVisualTokens = [
  'CampsiteBridgePoiColors',
  'campsite-bridge-poi-colors',
  'google.maps.OverlayView',
  'fromLatLngToDivPixel(',
  'makeIphoneColorMarker',
  'createGameEntityOverlay'
];
for (const [name, source] of Object.entries(runtimeSources)) {
  for (const token of forbiddenVisualTokens) {
    assert.ok(!source.includes(token), `${name} must not contain retired Bridge visual token: ${token}`);
  }
}

assert.ok(displayOwner.includes("WAYFARER: 'WAYFARER'"), 'Display owner must recognize Wayfarer');
assert.ok(displayOwner.includes("WFMM: 'WFMM'"), 'Display owner must recognize WFMM');
assert.ok(displayOwner.includes("NONE: 'NONE'"), 'Display owner must recognize missing map state');
assert.ok(displayOwner.includes('readOnly: true'), 'Display-owner diagnostics must stay read-only');
assert.ok(deckCompat.includes("owner !== 'WFMM'"), 'Deck compatibility may mutate only under WFMM ownership');
assert.ok(deckCompat.includes("pointerEvents === 'none'"), 'Passive deck canvases must remain protected');

assert.ok(pcBuilder.includes("const retiredPoiOverlay = path.join(sourceDir, 'wayfarer-poi-colors.js')"), 'PC builder must keep stale-output cleanup guard');
assert.ok(pcBuilder.includes('fs.rmSync(retiredPoiOverlay, { force: true })'), 'PC builder must delete stale retired overlay output');
assert.ok(pcBuilder.includes("mainScripts.includes('wayfarer-poi-colors.js')"), 'PC builder must reject overlay reintroduction');

assert.ok(androidBuilder.includes('RETIRED_VISUAL_MARKERS'), 'Android builder must guard against retired visual code');
assert.ok(androidBuilder.includes('POI display stays with Wayfarer/WFMM'), 'Android display ownership must remain Wayfarer/WFMM');
assert.ok(!androidBuilder.includes("const SHARED_VISUALS = 'js/bridge-wayfarer-poi-colors.js'"), 'Android builder must not source a Bridge POI overlay');

assert.ok(launcher.includes("const LAUNCHER_VERSION = '1.3.0'"), 'iPhone launcher version contract changed');
assert.ok(!launcher.includes('bridge-wayfarer-poi-colors.js'), 'iPhone launcher must not inject a Bridge POI overlay');
assert.ok(recovery.includes('visualFallback: false'), 'iPhone visual fallback must stay retired');
assert.ok(recovery.includes('bridgeOwnedMapVisuals: false'), 'iPhone Bridge-owned map visuals must stay disabled');
assert.ok(!recovery.includes('MutationObserver'), 'iPhone recovery must not scan the document continuously');
assert.ok(!recovery.includes('setInterval('), 'iPhone recovery must not poll continuously');
assert.ok(!networkRecovery.includes('MutationObserver'), 'iPhone network recovery must not scan the document continuously');
assert.ok(!networkRecovery.includes('setInterval('), 'iPhone network recovery must not poll continuously');
assert.ok(networkRecovery.includes('const baseResetForNetworkRecovery = reset;'), 'iPhone network recovery must hook Bridge reset');
assert.ok(networkRecovery.includes('observedPerformanceGcsUrls.clear();'), 'iPhone network recovery must clear URL de-duplication on reset');
assert.ok(networkRecovery.includes('performanceGeneration += 1;'), 'iPhone network recovery must invalidate in-flight replay work on reset');
assert.ok(iphonePolicy.includes("provider: 'WAYFARER_OR_WFMM'"), 'iPhone display provider must remain Wayfarer/WFMM');
assert.ok(iphonePolicy.includes('bridgeColors: false'), 'iPhone Bridge colors must stay disabled');
assert.ok(iphonePolicy.includes('legacyDomScanning: false'), 'Legacy iPhone DOM scanning must stay disabled');
assert.ok(iphonePolicy.includes('legacyCanvasSampling: false'), 'Legacy iPhone canvas sampling must stay disabled');

console.log('Bridge display ownership architecture: Wayfarer/WFMM only, Bridge data-only: OK');
