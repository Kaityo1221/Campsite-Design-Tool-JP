import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-pc-bridge.mjs'], { stdio:'inherit' });

const zipPath='downloads/campsite-bridge-pc-0.1.0.zip';
const zip=fs.readFileSync(zipPath);
assert.equal(zip.readUInt32LE(0),0x04034b50,'not a ZIP local header');

function readStoredZipEntries(buffer) {
  const entries=new Map();
  let offset=0;
  while (offset + 30 <= buffer.length) {
    const sig=buffer.readUInt32LE(offset);
    if (sig !== 0x04034b50) break;
    const method=buffer.readUInt16LE(offset+8);
    const compressedSize=buffer.readUInt32LE(offset+18);
    const uncompressedSize=buffer.readUInt32LE(offset+22);
    const nameLen=buffer.readUInt16LE(offset+26);
    const extraLen=buffer.readUInt16LE(offset+28);
    const nameStart=offset+30;
    const nameEnd=nameStart+nameLen;
    const dataStart=nameEnd+extraLen;
    const dataEnd=dataStart+compressedSize;
    assert.equal(method,0,'build-pc-bridge must use stored ZIP entries');
    assert.equal(compressedSize,uncompressedSize,'stored entry size mismatch');
    const name=buffer.subarray(nameStart,nameEnd).toString('utf8');
    entries.set(name,buffer.subarray(dataStart,dataEnd));
    offset=dataEnd;
  }
  return entries;
}

const entries=readStoredZipEntries(zip);
assert.ok(entries.size>0,'ZIP entries missing');
assert.ok(entries.has('manifest.json'),'manifest.json missing from ZIP');

const manifest=JSON.parse(entries.get('manifest.json').toString('utf8'));
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.name,'Campsite Bridge - PC TEST');
assert.deepEqual(manifest.permissions,[]);
assert.deepEqual([...manifest.host_permissions].sort(),[
  'https://wayfarer.nianticlabs.com/*',
  'https://wayfarer.scopely.com/*'
]);
assert.equal(manifest.host_permissions.some(v=>v.includes('<all_urls>')),false);
assert.equal(Boolean(manifest.background),false,'retired observation service worker must not ship');

for (const entry of manifest.content_scripts || []) {
  for (const script of entry.js || []) {
    assert.ok(entries.has(script),`manifest JS missing from ZIP: ${script}`);
  }
}

for (const retired of [
  'creative-tab-relay.js',
  'creative-wm3b2b-test-injector.js',
  'tab-relay-background.js',
  'wayfarer-tab-relay.js',
  'wm3b-tab-link.js',
  'wm3-observe-controller.js'
]) {
  assert.equal(entries.has(retired),false,`retired observation runtime must not enter package: ${retired}`);
}

for (const required of [
  'content.js',
  'polygon-ui.js',
  'page-collector.js',
  'wayfarer-polygon-controller.js',
  'wayfarer-observation-zone.js',
  'creative-wm3c-test-runtime.js'
]) {
  assert.ok(entries.has(required),`required current PC runtime missing: ${required}`);
}

const unsafePermissionTokens=['tabs','activeTab','scripting','webRequest','webRequestBlocking','storage'];
for (const token of unsafePermissionTokens) {
  assert.equal(manifest.permissions.includes(token),false,`unexpected permission shipped: ${token}`);
}

console.log(`PC Bridge package inspection: ${entries.size} files, obsolete observation runtime excluded`);
