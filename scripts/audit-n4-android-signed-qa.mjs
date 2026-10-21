// Offline comparison of a Mozilla-returned signed QA XPI against the unsigned
// N4 QA candidate. No network, signing submission, deployment, or mutations.
// CAUTION: structural signature presence is NOT cryptographic authentication.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const [unsigned, purportedSigned, checksumFile] = process.argv.slice(2);
if (!unsigned || !purportedSigned || !checksumFile || process.argv.length !== 5) {
  console.error('Usage: node scripts/audit-n4-android-signed-qa.mjs <unsigned-QA.xpi> <Mozilla-returned-signed-QA.xpi> <unsigned-QA.sha256>');
  process.exit(2);
}

const EXPECTED_ID = 'campsite-bridge-android-n4-qa@local';
const EXPECTED_VERSION = '0.3.7';
const PROD_ID = 'campsite-bridge-android@local';
function readRegularFile(filename) {
  const stat = fs.statSync(filename);
  assert.ok(stat.isFile() && stat.size > 0 && stat.size < 30 * 1024 * 1024, 'XPI must be a regular nonempty file under 30 MB');
  return fs.readFileSync(filename);
}
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytesUnsigned = readRegularFile(unsigned);
const bytesSigned = readRegularFile(purportedSigned);
assert.notEqual(sha256(bytesUnsigned), sha256(bytesSigned), 'signed XPI unexpectedly equals unsigned XPI');

const sidecar = fs.readFileSync(checksumFile, 'utf8').trim();
const m = /^([a-f0-9]{64})\s+\*?(\S+)$/i.exec(sidecar);
assert.ok(m, 'checksum file must have one SHA-256 and filename');
assert.equal(path.basename(m[2]), path.basename(unsigned), 'checksum filename must identify exact unsigned XPI');
assert.equal(sha256(bytesUnsigned), m[1].toLowerCase(), 'unsigned XPI SHA-256 mismatch');

function members(filename) {
  execFileSync('unzip', ['-tqq', filename], { stdio: 'pipe' });
  const names = execFileSync('unzip', ['-Z1', filename], { encoding: 'utf8' }).trim().split(/\r?\n/);
  assert.ok(names.length > 1 && names.every(Boolean), 'invalid/empty ZIP members');
  assert.equal(new Set(names).size, names.length, 'duplicate archive paths rejected');
  for (const name of names) {
    assert.ok(!name.startsWith('/') && !name.includes('\\') &&
      !name.split('/').includes('..') && !name.includes('\0'), 'unsafe ZIP member path');
  }
  return names;
}
const uNames = members(unsigned);
const sNames = members(purportedSigned);
assert.ok(!uNames.some(n => /^META-INF\//i.test(n)), 'unsigned QA contains signature files');
const meta = sNames.filter(n => /^META-INF\//i.test(n));
assert.ok(meta.every(n => /^META-INF\/$/i.test(n) || /^META-INF\/(?:manifest\.mf|[^/]+\.(?:sf|rsa|dsa|ec))$/i.test(n)), 'unexpected META-INF member');
const sPayload = sNames.filter(n => !/^META-INF\//i.test(n)).sort();
assert.deepEqual(sPayload, [...uNames].sort(), 'signed XPI adds/removes an executable or manifest payload');
assert.ok(meta.some(n => /^META-INF\/manifest\.mf$/i.test(n)), 'signature manifest missing');
assert.ok(meta.some(n => /^META-INF\/[^/]+\.sf$/i.test(n)), 'signature .sf missing');
assert.ok(meta.some(n => /^META-INF\/[^/]+\.(rsa|dsa|ec)$/i.test(n)), 'signature block missing');

function entry(filename, name) {
  return execFileSync('unzip', ['-p', filename, name], { maxBuffer: 15 * 1024 * 1024 });
}
for (const name of uNames) {
  assert.ok(entry(unsigned, name).equals(entry(purportedSigned, name)), `signed XPI changes payload: ${name}`);
}
const manifest = JSON.parse(entry(purportedSigned, 'manifest.json').toString('utf8'));
assert.equal(manifest.version, EXPECTED_VERSION, 'wrong QA version');
assert.equal(manifest.browser_specific_settings?.gecko?.id, EXPECTED_ID, 'wrong QA add-on identity');
assert.notEqual(manifest.browser_specific_settings?.gecko?.id, PROD_ID, 'public ID must not be used');
assert.ok(manifest.browser_specific_settings?.gecko_android &&
  typeof manifest.browser_specific_settings.gecko_android === 'object', 'Android compatibility metadata missing');
assert.match(manifest.name || '', /N4 QA TEST/, 'QA label missing');

console.log('PASS: checksum + identity + exact payload equality + signature-file structure');
console.log(`Unsigned SHA-256: ${sha256(bytesUnsigned)}`);
console.log(`Returned XPI SHA-256: ${sha256(bytesSigned)}`);
console.log('NOT VERIFIED: cryptographic authenticity of Mozilla signature; Firefox must validate during installation.');
console.log('NOT VERIFIED: device QA D01-D09, Wayfarer GCS completeness, or production transfer.');
