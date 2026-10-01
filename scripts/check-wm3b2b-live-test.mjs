import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/creative-wm3b2b-test-injector.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));

new vm.Script(source, { filename:'bridge-pc/creative-wm3b2b-test-injector.js' });

assert.equal(manifest.name, 'Campsite Bridge - WM-3B-2 TEST');
assert.deepEqual([...manifest.host_permissions].sort(), ['https://wayfarer.nianticlabs.com/*','https://wayfarer.scopely.com/*']);

const entry = manifest.content_scripts.find(item =>
  Array.isArray(item.js) && item.js.includes('creative-wm3b2b-test-injector.js')
);
assert.ok(entry, 'WM-3B-2 Creative test injector entry missing');
assert.deepEqual(entry.matches, ['https://kaityo1221.github.io/Campsite-Design-Tool-JP/creative/*']);
assert.equal(entry.world, 'MAIN');

for (const token of [
  "campsiteProject.v1",
  "CAMPSITE_WAYFARER_OBSERVE_PING_V1",
  "CAMPSITE_WAYFARER_OBSERVE_PONG_V1",
  "CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1",
  "CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1",
  "CampsiteWayfarerObserve",
  "Wayfarerで観察を開始しました。",
  "Production Creative未変更"
]) {
  assert.ok(source.includes(token), 'missing token: ' + token);
}

assert.ok(source.includes("window.syncCampsiteProjectFromCreative"));
assert.ok(source.includes("sessionStorage.getItem(PROJECT_KEY)"));
assert.ok(source.includes("document.close = function"), 'TEST panel must survive Creative document rewrites');
assert.ok(source.includes("setInterval(() =>"), 'TEST panel must have a short-lived reinstall fallback');
assert.ok(source.includes("z-index:2147483000"), 'TEST panel must stay above Creative runtime overlays');
assert.ok(source.includes("polygon.length >= 3 && polygon.length <= 30"));
assert.ok(!source.includes("wayfarerObservation ="), 'Live gate must not save observation result yet');
assert.ok(!source.includes("CAMPSITE_WAYFARER_OBSERVE_RESULT_V1"), 'WM-3B-2C must not leak into live gate');

console.log('WM-3B-2 live Creative injector contract: OK');
