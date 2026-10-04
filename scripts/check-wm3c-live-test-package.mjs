import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-pc-bridge.mjs'], { stdio:'inherit' });

const runtimePath = 'bridge-pc/creative-wm3c-test-runtime.js';
assert.ok(fs.existsSync(runtimePath), 'WM-3C generated Creative TEST runtime missing');

const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
new vm.Script(runtimeSource, { filename:runtimePath });

function FakeDocument() {}
FakeDocument.prototype.write = function() {};
FakeDocument.prototype.writeln = function() {};
const window = { Document:FakeDocument };
const context = { window, console };
vm.createContext(context);
new vm.Script(runtimeSource, { filename:runtimePath }).runInContext(context);

const api = context.window.__campsiteWm3cCreativeRuntime;
assert.equal(typeof api?.transformCreativeHtml, 'function', 'WM-3C TEST transform API missing');

const fixture = `<html><body><script>
(()=>{'use strict';
const records=[];
function cmCandidateShadowScene(){return Object.freeze({items:Object.freeze([])})}
})();
</script></body></html>`;
const transformed = api.transformCreativeHtml(fixture);

for (const token of [
  'bridgeMapLab_adaptWayfarerObservation',
  'bridgeMapLab_buildWayfarerReferenceGeometry',
  'bridgeMapLab_buildWayfarerReferenceScene',
  'cm-engine-reference-icon',
  'cmWm3cReferenceRuntime',
  'campsite:wayfarer-observation-saved'
]) {
  assert.ok(transformed.includes(token), `WM-3C transformed Creative missing: ${token}`);
}
assert.equal(api.transformCreativeHtml(transformed), transformed, 'WM-3C runtime injection must be idempotent');

const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
assert.equal(manifest.name, 'Campsite Bridge - PC TEST');
assert.deepEqual(manifest.permissions, []);
assert.deepEqual([...manifest.host_permissions].sort(), [
  'https://wayfarer.nianticlabs.com/*',
  'https://wayfarer.scopely.com/*'
]);

const creativeRuntimeEntry = (manifest.content_scripts || []).find(entry =>
  (entry.js || []).includes('creative-wm3c-test-runtime.js')
);
assert.ok(creativeRuntimeEntry, 'WM-3C document-start Creative entry missing');
assert.equal(creativeRuntimeEntry.world, 'MAIN');
assert.equal(creativeRuntimeEntry.run_at, 'document_start');
assert.deepEqual(creativeRuntimeEntry.matches, [
  'https://kaityo1221.github.io/Campsite-Design-Tool-JP/creative/*'
]);

assert.equal(
  (manifest.content_scripts || []).some(entry => (entry.js || []).includes('creative-wm3b2b-test-injector.js')),
  false,
  'Retired Creative observation panel must not ship'
);

const zip = fs.readFileSync('downloads/campsite-bridge-pc-0.1.0.zip');
assert.ok(zip.includes(Buffer.from('creative-wm3c-test-runtime.js')), 'WM-3C runtime not packaged in Bridge ZIP');
assert.equal(zip.includes(Buffer.from('creative-wm3b2b-test-injector.js')), false, 'Retired Creative observation panel must not enter Bridge ZIP');

console.log('WM-3C reference runtime package without retired observation panel: PASS');
