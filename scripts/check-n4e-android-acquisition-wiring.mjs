import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const source=fs.readFileSync('bridge-android-n4/wayfarer-acquisition-coordinator.js','utf8');
assert.match(source,/BUFFER_METERS = 200/);
assert.match(source,/CELL_LEVEL = 14/);
assert.match(source,/GCS_RESPONSE/);
assert.match(source,/fitBounds/);
assert.match(source,/CampsiteWayfarerAcquisitionEngine/);
assert.match(source,/state\?\.completed !== true \|\| state\?\.active === true/,'acquisition must start from confirmed polygon state (completed=true, active=false)');
assert.doesNotMatch(source,/new XMLHttpRequest|XMLHttpRequest\s*\(/,'coordinator must not create XHR');
assert.doesNotMatch(source,/\bfetch\s*\(/,'coordinator must not create fetch transport');
assert.doesNotMatch(source,/Authorization|Bearer|setRequestHeader/,'coordinator must not own auth or headers');

execFileSync(process.execPath,['scripts/build-android-bridge-0.3.7-unsigned.mjs'],{stdio:'ignore'});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'n4e-wire-'));
try {
 execFileSync('unzip',['-q','downloads/campsite-bridge-android-0.3.7-unsigned.xpi','manifest.json','wayfarer-acquisition-coordinator.js','page-hook.js','-d',tmp]);
 const manifest=JSON.parse(fs.readFileSync(path.join(tmp,'manifest.json'),'utf8'));
 const main=manifest.content_scripts.find(item=>item.world==='MAIN');
 assert.ok(main?.js.includes('wayfarer-acquisition-coordinator.js'),'coordinator missing from MAIN world');
 assert.ok(main.js.indexOf('wayfarer-acquisition-coordinator.js')>main.js.indexOf('wayfarer-polygon-controller.js'),'coordinator must load after polygon controller');
 const hook=fs.readFileSync(path.join(tmp,'page-hook.js'),'utf8');
 assert.match(hook,/post\('GCS_RESPONSE'/,'existing GCS_RESPONSE seam missing');
 console.log('N4-E 200m acquisition wiring PASS');
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
