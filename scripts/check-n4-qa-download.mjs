// Verify the exact Mozilla-signed N4 QA XPI before exposing a download link.
// This is intentionally a strict gate and does not generate, sign or replace an XPI.
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const file='downloads/campsite-bridge-android-n4-qa-0.3.7-signed.xpi';
const expected='d6d545b2a8234cc39daeeaa380f20417af782d252145754d7f7f188c72cd3ec2';
assert.ok(fs.existsSync(file), 'SIGNED QA XPI NOT PRESENT: download button must remain disabled');
const bytes=fs.readFileSync(file);
assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), expected, 'XPI checksum mismatch');
execFileSync('unzip',['-tqq',file],{stdio:'pipe'});
const manifest=JSON.parse(execFileSync('unzip',['-p',file,'manifest.json'],{encoding:'utf8'}));
assert.equal(manifest.version,'0.3.7');
assert.equal(manifest.browser_specific_settings?.gecko?.id,'campsite-bridge-android-n4-qa@local');
assert.ok(manifest.browser_specific_settings?.gecko_android, 'Firefox Android compatibility metadata missing');
const members=execFileSync('unzip',['-Z1',file],{encoding:'utf8'});
assert.match(members,/META-INF\/mozilla\.rsa/);
assert.match(members,/META-INF\/cose\.sig/);
assert.ok(fs.readFileSync('bridge-setup-n4.html','utf8').includes(file),'setup page does not reference signed QA file');
console.log('PASS: QA signing file SHA, manifest ID/version, Android metadata and setup link');
console.log('Mozilla signature cryptographic validation is performed by Firefox on installation, not this script.');
