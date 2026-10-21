// Synthetic regression for the offline package-only audit. Synthetic .rsa/.sf
// members are NOT Mozilla signatures and MUST NEVER be distributed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'noah-n4-signed-audit-fixture-'));
const script = path.resolve('scripts/audit-n4-android-signed-qa.mjs');
const run = args => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
const makeZip = (destination, members) => {
  execFileSync('zip', ['-q', '-X', destination, ...members], { cwd: dir });
};
try {
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({
    name: 'Campsite Bridge N4 QA TEST (UNSIGNED)', version: '0.3.7',
    browser_specific_settings: { gecko: { id: 'campsite-bridge-android-n4-qa@local' }, gecko_android: {} },
    permissions: ['storage']
  }));
  fs.writeFileSync(path.join(dir, 'content.js'), 'const knownGood = true;\n');
  const unsigned = path.join(dir, 'qa-unsigned.xpi');
  const signedLike = path.join(dir, 'qa-signed-like.xpi');
  const checksum = path.join(dir, 'qa-unsigned.sha256');
  makeZip(unsigned, ['manifest.json', 'content.js']);
  fs.writeFileSync(checksum, crypto.createHash('sha256').update(fs.readFileSync(unsigned)).digest('hex') + '  qa-unsigned.xpi\n');

  fs.mkdirSync(path.join(dir, 'META-INF'));
  for (const file of ['manifest.mf', 'mozilla.sf', 'mozilla.rsa']) {
    fs.writeFileSync(path.join(dir, 'META-INF', file), 'TEST FIXTURE ONLY: NOT MOZILLA-SIGNED');
  }
  makeZip(signedLike, ['manifest.json', 'content.js', 'META-INF/manifest.mf', 'META-INF/mozilla.sf', 'META-INF/mozilla.rsa']);
  const positive = run([unsigned, signedLike, checksum]);
  assert.equal(positive.status, 0, positive.stderr);
  assert.match(positive.stdout, /NOT VERIFIED: cryptographic authenticity/);
  assert.notEqual(run([unsigned, unsigned, checksum]).status, 0, 'unsigned cannot be signed');
  assert.notEqual(run([unsigned, signedLike, path.join(dir, 'content.js')]).status, 0, 'bad checksum must fail');

  fs.writeFileSync(path.join(dir, 'content.js'), 'const maliciousChange = true;\n');
  const altered = path.join(dir, 'qa-altered.xpi');
  makeZip(altered, ['manifest.json', 'content.js', 'META-INF/manifest.mf', 'META-INF/mozilla.sf', 'META-INF/mozilla.rsa']);
  assert.notEqual(run([unsigned, altered, checksum]).status, 0, 'payload modification must fail');
  console.log('N4 signed-QA offline audit fixtures PASS: same payload accepted structurally, unsigned/bad SHA/modified code rejected.');
  console.log('NOTE: synthetic META-INF fixture does not test Mozilla cryptographic signature validation.');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
