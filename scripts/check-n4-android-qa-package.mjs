import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const orig='downloads/campsite-bridge-android-0.3.7-unsigned.xpi';
const qa='downloads/campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi';
const signed='downloads/campsite-bridge-android-0.3.5.xpi';
const shaFile='downloads/campsite-bridge-android-n4-qa-0.3.7-unsigned.sha256';
const unzip=(file,p)=>execFileSync('unzip',['-p',file,p],{encoding:'utf8'});
const list=file=>execFileSync('unzip',['-Z1',file],{encoding:'utf8'}).trim().split(/\r?\n/).sort();

execFileSync(process.execPath,['scripts/build-n4-android-qa-unsigned.mjs'],{stdio:'inherit'});
const before=JSON.parse(unzip(orig,'manifest.json'));
const after=JSON.parse(unzip(qa,'manifest.json'));
assert.equal(after.version,'0.3.7');
assert.equal(before.browser_specific_settings.gecko.id,'campsite-bridge-android@local');
assert.equal(after.browser_specific_settings.gecko.id,'campsite-bridge-android-n4-qa@local');
assert.ok(after.browser_specific_settings.gecko_android,'Android signing metadata missing');
assert.match(after.name,/N4 QA TEST/);
const sanitized=m=>{
 const copy=JSON.parse(JSON.stringify(m));
 delete copy.name;
 delete copy.description;
 delete copy.browser_specific_settings.gecko.id;
 delete copy.browser_specific_settings.gecko_android;
 return copy;
};
assert.deepEqual(sanitized(after),sanitized(before),
 'QA manifest must preserve permissions/content scripts/host scope and everything else');
assert.deepEqual(list(orig).filter(n=>!n.startsWith('META-INF/')),list(qa),
 'QA package must contain only the original code files');
for (const name of list(qa)) {
 if (name==='manifest.json') continue;
 const a=execFileSync('unzip',['-p',orig,name]);
 const b=execFileSync('unzip',['-p',qa,name]);
 assert.ok(a.equals(b),'QA cannot change original N4 code file: '+name);
}
assert.ok(!list(qa).some(n=>n.startsWith('META-INF/')),'unsigned QA must not claim Mozilla signature');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(signed)).digest('hex'),
'f5c7d300c6cdd82758f88f651116c1b7af42863ef03e80f8ac89e39afa0fa7b7');
const computed=crypto.createHash('sha256').update(fs.readFileSync(qa)).digest('hex');
assert.ok(fs.readFileSync(shaFile,'utf8').startsWith(computed+'  '),'published artifact SHA mismatch');
console.log('N4 QA package guards PASS (only extension identity/name changed, no code/runtime changes)');
console.log('UNSIGNED artifact: Android Firefox Release install GATE still HOLD');
