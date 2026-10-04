import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const legacySources = [
  'bridge-pc/creative-wm3b2b-test-injector.js',
  'bridge-pc/tab-relay-background.js',
  'bridge-pc/wayfarer-tab-relay.js',
  'bridge-pc/creative-tab-relay.js',
  'bridge-pc/wm3b-tab-link.js',
  'bridge-pc/wm3-observe-controller.js'
];

assert.equal(manifest.name, 'Campsite Bridge PC');
assert.equal(Boolean(manifest.background), false, 'Retired observation relay service worker must not ship');
assert.deepEqual([...manifest.host_permissions].sort(), [
  'https://wayfarer.nianticlabs.com/*',
  'https://wayfarer.scopely.com/*'
]);

const shippedScripts = (manifest.content_scripts || []).flatMap(entry => entry.js || []);
for (const retired of [
  'creative-wm3b2b-test-injector.js',
  'wayfarer-tab-relay.js',
  'creative-tab-relay.js',
  'wm3b-tab-link.js',
  'wm3-observe-controller.js'
]) {
  assert.equal(shippedScripts.includes(retired), false, `retired observation runtime must not ship: ${retired}`);
}

for (const path of legacySources) {
  const source = fs.readFileSync(path, 'utf8');
  new vm.Script(source, { filename:path });
}

console.log('WM-3B observation relay retirement contract: obsolete runtime remains parseable but is not shipped');
