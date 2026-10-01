import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('creative/wayfarer-observe-link-patch.js', 'utf8');
const index = fs.readFileSync('creative/index.html', 'utf8');

new vm.Script(source, { filename: 'creative/wayfarer-observe-link-patch.js' });

const window = {};
const context = vm.createContext({ window, console, String, Object, Set, Date, Math });
vm.runInContext(source, context);

assert.equal(typeof window.applyCreativeWayfarerObserveLinkPatch, 'function');

const input = [
  'function installCampsiteProjectNext(project){}',
  'function loadCampsiteBridgeProject(project){',
  '  installCampsiteProjectNext(project);',
  '}'
].join('\n');
const output = window.applyCreativeWayfarerObserveLinkPatch(input);

assert.ok(output.includes('CampsiteCreativeWayfarerLink'));
assert.ok(output.includes('installCampsiteWayfarerObserveLink(project);'));
assert.ok(output.includes('https://wayfarer.scopely.com/new/mapview'));
assert.ok(output.includes('CAMPSITE_WAYFARER_OBSERVE_PING_V1'));
assert.ok(output.includes('CAMPSITE_WAYFARER_OBSERVE_PONG_V1'));
assert.ok(output.includes('CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1'));
assert.ok(output.includes('CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1'));
assert.ok(output.includes('Wayfarer Mapが複数タブで開いています。1つだけ残してから再確認してください。'));
assert.ok(output.includes('Wayfarer Mapに接続できました。'));
assert.ok(output.includes("event.source !== wayfarerWindow"));
assert.ok(output.includes("syncCampsiteProjectFromCreative(project)"));
assert.ok(output.includes("window.open(WAYFARER_URL, WINDOW_NAME)"));
assert.ok(output.includes('startObservation'));
assert.ok(output.includes('normalizeProjectPolygon(project)'));
assert.ok(output.includes("message: 'Wayfarerで観察を開始しました。'"));
assert.ok(output.includes('この範囲を観察'));
assert.ok(!output.includes('wayfarerObservation ='), 'WM-3B-2 must not save observation results yet');

assert.ok(index.includes("fetch('./wayfarer-observe-link-patch.js'"));
assert.ok(index.includes('applyCreativeWayfarerObserveLinkPatch'));
assert.ok(index.includes('if(bridgeProject)'));

console.log('WM-3B-1 / WM-3B-2A Creative Wayfarer connection + polygon sender: OK');