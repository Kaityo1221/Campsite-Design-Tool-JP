// Static QA-only setup gates. This intentionally does not alter production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page=fs.readFileSync('bridge-setup-n4-qa.html','utf8');
const production=fs.readFileSync('js/bridge-setup-config.js','utf8');
assert.match(page,/<div class="version">0\.3\.7<\/div>/);
assert.match(page,/STEP 0[\s\S]*?0\.3\.5を無効化/);
assert.ok(page.indexOf('STEP 0') < page.indexOf('STEP 1'));
assert.match(page,/Campsite Bridge 0\.3\.5/);
assert.match(page,/0\.3\.7[\s\S]*?OFF/);
assert.match(page,/GCS全件完全性が未検証/);
assert.match(page,/D10：BLOCKED/);
assert.match(page,/d6d545b2a8234cc39daeeaa380f20417af782d252145754d7f7f188c72cd3ec2/);
assert.match(page,/campsite-bridge-android-n4-qa-0\.3\.7-signed\.xpi/);
assert.match(production,/androidRuntimeVersion: '0\.3\.5'/);
assert.match(production,/androidExtensionUrl: '\.\/downloads\/campsite-bridge-android-0\.3\.5\.xpi'/);
assert.ok(!page.includes('sourceComplete=true'), 'do not claim verified source completeness');
console.log('N4 QA 0.3.7 setup content gates PASS. Signed XPI hosting NOT checked by this static test.');
