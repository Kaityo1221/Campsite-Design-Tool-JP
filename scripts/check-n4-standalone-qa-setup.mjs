import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const html = fs.readFileSync('bridge-setup-n4.html','utf8');
const conventional = fs.readFileSync('bridge-setup.html','utf8');
const config = fs.readFileSync('js/bridge-setup-config.js','utf8');
for (const value of [
'Android Firefox 新フロー・実機QA 0.3.7','STEP 0','既存の0.3.5を無効化',
'削除は不要','campsite-bridge-android-n4-qa@local',
'd6d545b2a8234cc39daeeaa380f20417af782d252145754d7f7f188c72cd3ec2',
'STEP 9','QA版0.3.7を無効化','0.3.5を再び有効化',
'sourceComplete = null','coverageComplete = false',
'D10（Receiver→Creative）はBLOCKED'
]) assert.ok(html.includes(value), 'Missing from N4 setup: '+value);
for(const bad of ['ここまで進めば、セットアップ完了です。','少し待ってから再送信','js/bridge-setup-config.js','id="androidExtensionLink"']){
 assert.ok(!html.includes(bad),'Unsafe or misleading text/unsafe link: '+bad);
}
assert.ok(html.includes('テスター用配布キットに同梱'));
assert.ok(conventional.includes('M3.5 / 0.3.5'),'conventional setup must remain unchanged');
assert.ok(config.includes("androidRuntimeVersion: '0.3.5'"),'normal setup must remain 0.3.5');
execFileSync('bash',['-c',"echo 'f5c7d300c6cdd82758f88f651116c1b7af42863ef03e80f8ac89e39afa0fa7b7  downloads/campsite-bridge-android-0.3.5.xpi' | sha256sum -c -"],{stdio:'inherit'});
console.log('PASS: standalone N4 QA 0.3.7 setup, stop-at-D09, old 0.3.5 safe');
