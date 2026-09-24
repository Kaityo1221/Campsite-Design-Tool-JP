import fs from 'node:fs';
import assert from 'node:assert/strict';

const shared = fs.readFileSync('js/bridge-wayfarer-poi-colors.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const pcManifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const androidBuilder = fs.readFileSync('scripts/build-android-bridge-0.3.6-unsigned.mjs', 'utf8');

for (const entity of ['POKESTOP', 'GYM', 'POWERSPOT']) {
  assert.ok(shared.includes(entity), `shared overlay must support ${entity}`);
}
assert.ok(shared.includes("window.WFMM"), 'shared overlay must prefer WFMM when present');
assert.ok(shared.includes("overlayRoot.style.display = 'none'"), 'shared overlay must hide Bridge markers under WFMM');
assert.ok(shared.includes("pointerEvents: 'none'"), 'Bridge color markers must not block Wayfarer map interaction');
assert.ok(shared.includes("'/api/v1/vault/mapview/gcs'"), 'shared overlay must observe the Wayfarer map payload');
assert.ok(shared.includes("status === 'INACTIVE'"), 'inactive records must not be painted by the base overlay');
assert.ok(!shared.includes('NOT_IN_GAME'), 'Not in Game must not be a Bridge color-overlay entity');
assert.ok(!shared.includes('NOT IN GAME'), 'Not in Game must not be a Bridge color-overlay entity');

assert.ok(launcher.includes('bridge-wayfarer-poi-colors.js'), 'iPhone launcher must load shared POI colors');
assert.ok(launcher.includes('POI color overlay unavailable'), 'iPhone visual overlay must stay non-fatal');

const mainEntry = pcManifest.content_scripts?.find(entry => entry.world === 'MAIN');
assert.ok(mainEntry, 'PC manifest MAIN-world entry missing');
assert.ok(mainEntry.js?.includes('wayfarer-poi-colors.js'), 'PC must load shared POI colors in MAIN world');
assert.ok(mainEntry.js.indexOf('wayfarer-poi-colors.js') < mainEntry.js.indexOf('page-collector.js'), 'PC color overlay must load before the collector');

assert.ok(androidBuilder.includes('bridge-wayfarer-poi-colors.js'), 'Android 0.3.6 builder must embed the shared overlay');
assert.ok(androidBuilder.includes("VERSION = '0.3.6'"), 'Android candidate version must be 0.3.6');
assert.ok(androidBuilder.includes('Mozilla signing is required'), 'Android candidate must clearly remain unsigned');

console.log('Bridge WFMM-first POI color overlay checks: OK');
