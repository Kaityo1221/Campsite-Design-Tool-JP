import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const dir = 'dist/bridge-shortcut/1.0.0/';
const host = fs.readFileSync(dir + 'runtime.part-08aa.iphone-i4-probe-host.js', 'utf8');
const ui = fs.readFileSync(dir + 'runtime.part-08b.iphone-i4-probe-ui.js', 'utf8');
const testLauncher = fs.readFileSync('lab/i4-3-iphone-test-shortcut.js', 'utf8');
execFileSync(process.execPath, ['--check', 'lab/i4-3-iphone-test-shortcut.js'], { stdio: 'pipe' });
assert.match(testLauncher, /__cbsI4ProbeTestEnabled = true/);
assert.match(testLauncher, /raw\\.githubusercontent\\.com/);
assert.match(testLauncher, /campsite-bridge-shortcut-runtime\\.js/);
const workflow = fs.readFileSync('.github/workflows/deploy-pages.yml', 'utf8');

for (const name of ['runtime.part-08aa.iphone-i4-probe-host.js','runtime.part-08b.iphone-i4-probe-ui.js']) {
  execFileSync(process.execPath, ['--check', dir + name], { stdio: 'pipe' });
  assert.ok(workflow.includes(name), name + ' missing from bundle');
}
assert.match(host, /cbsI4Probe/);
assert.match(ui, /cbsI4Probe/);
assert.match(host, /msg\.sid !== activeSid/);
assert.match(host, /STALE_OR_UNCONFIRMED_POLYGON/);
assert.match(ui, /sid, polygon: snapshot/);
assert.match(host, /credentials: 'include'/);
assert.match(host, /AbortController/);
assert.match(host, /coverageComplete: null, sourceComplete: null/);
assert.doesNotMatch(host + ui, /localStorage|sessionStorage|indexedDB|console\.log|sendBeacon/);
assert.doesNotMatch(host + ui, /cbs-i3:cmd/);
assert.ok(workflow.indexOf('runtime.part-08a.iphone-page-world-host.js') <
  workflow.indexOf('runtime.part-08aa.iphone-i4-probe-host.js'));
assert.ok(workflow.indexOf('runtime.part-08.iphone-activity-area-ui.js') <
  workflow.indexOf('runtime.part-08b.iphone-i4-probe-ui.js'));
console.log('I4-3 isolated diagnostic static checks: PASS');
