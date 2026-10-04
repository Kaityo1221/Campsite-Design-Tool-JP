import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/creative-wm3b2b-test-injector.js', 'utf8');
const background = fs.readFileSync('bridge-pc/tab-relay-background.js', 'utf8');
const wayfarerRelay = fs.readFileSync('bridge-pc/wayfarer-tab-relay.js', 'utf8');
const creativeRelay = fs.readFileSync('bridge-pc/creative-tab-relay.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));

new vm.Script(source, { filename:'bridge-pc/creative-wm3b2b-test-injector.js' });

assert.equal(manifest.name, 'Campsite Bridge - WM-3C TEST');
assert.equal(manifest.background?.service_worker, 'tab-relay-background.js');
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
  "CAMPSITE_WAYFARER_OBSERVE_RESULT_V1",
  "CampsiteWayfarerObserve",
  "Wayfarerで観察中です…",
  "Production Creative未変更"
]) {
  assert.ok(source.includes(token), 'missing token: ' + token);
}

assert.ok(source.includes("window.syncCampsiteProjectFromCreative"));
assert.ok(source.includes("sessionStorage.getItem(PROJECT_KEY)"));
assert.ok(source.includes("document.close = function"), 'TEST panel must survive Creative document rewrites');
assert.ok(source.includes("function ensureMessageListener()"), 'Creative must be able to restore the message listener');
assert.ok(source.includes("window.removeEventListener('message', onMessage)"), 'Message listener restore must be idempotent');
assert.ok(source.includes("window.addEventListener('message', onMessage)"), 'Message listener must be reattached after rewrite');
assert.ok(source.includes("function checkConnection() {\n    ensureMessageListener();"), 'Connection check must restore the listener before PING');
assert.ok(source.includes("function startObservation() {\n    ensureMessageListener();"), 'Observation must restore the listener before request');
assert.ok(source.includes("setInterval(() =>"), 'TEST panel must have a short-lived reinstall fallback');
assert.ok(source.includes("z-index:2147483000"), 'TEST panel must stay above Creative runtime overlays');
assert.ok(source.includes("polygon.length >= 3 && polygon.length <= 30"));
assert.ok(source.includes("project.wayfarerObservation = observation"), 'WM-3B-2D must save only the observation field');
assert.ok(source.includes("campsiteWm3b2bTestDiagnostics"), 'WM-3B/3C diagnostic panel missing');
assert.ok(source.includes("Relay接続"));
assert.ok(source.includes("Polygon受信"));
assert.ok(source.includes("GCS開始"));
assert.ok(source.includes("RESULT返却"));
assert.ok(source.includes("Project保存"));
assert.ok(source.includes("Reference表示"));
assert.ok(source.includes("diagnostics:{ relay:'done' }"));
assert.ok(source.includes("gcs:'active'"));
assert.ok(source.includes("result:'done'"));
assert.ok(source.includes("save:'done'"));
assert.ok(source.includes("OBSERVE_RESULT_TIMEOUT_MS"));
assert.ok(source.includes("pending.stage = 'await-result'"));
assert.ok(source.includes("saveObservationResult(data.result)"));
assert.ok(background.includes("keepForObservationResult"));
assert.ok(background.includes("OBSERVE_ROUTE_TTL_MS"));
assert.ok(source.includes('CAMPSITE_CREATIVE_MAIN_TO_EXTENSION_V1'));
assert.ok(source.includes('CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1'));
assert.ok(!source.includes('window.open(WAYFARER_URL, WINDOW_NAME)'), 'TEST must not create a second Wayfarer tab');
assert.ok(background.includes('CAMPSITE_CREATIVE_RELAY_REQUEST_V1'));
assert.ok(background.includes('tabs.length !== 1'));
assert.ok(wayfarerRelay.includes('CAMPSITE_EXTENSION_TO_WAYFARER_MAIN_V1'));
assert.ok(creativeRelay.includes('CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1'));
assert.ok(creativeRelay.includes('function ensureWindowListener()'), 'Creative isolated relay must be able to restore its window listener');
assert.ok(creativeRelay.includes("window.removeEventListener('message', forwardFromMain)"), 'Creative isolated relay restore must be idempotent');
assert.ok(creativeRelay.includes("window.addEventListener('message', forwardFromMain)"), 'Creative isolated relay listener must be reattached after Creative document rewrite');
assert.ok(creativeRelay.includes('setInterval(() =>'), 'Creative isolated relay must retry listener attachment during Creative boot rewrites');
assert.ok(creativeRelay.includes("window.addEventListener('pageshow', ensureWindowListener)"), 'Creative isolated relay must restore on pageshow');


console.log('WM-3B-2C/2D live Creative result + Project save contract: OK');
