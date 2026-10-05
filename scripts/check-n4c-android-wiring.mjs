import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.7-unsigned.mjs'], { stdio: 'inherit' });
const xpi='downloads/campsite-bridge-android-0.3.7-unsigned.xpi';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'campsite-n4c-'));
try {
  execFileSync('unzip',['-q',xpi,'-d',tmp]);
  const manifest=JSON.parse(fs.readFileSync(path.join(tmp,'manifest.json'),'utf8'));
  const scripts=(manifest.content_scripts||[]).map(x=>({world:x.world||'ISOLATED',js:x.js||[]}));
  const flat=scripts.flatMap(x=>x.js);
  for(const file of ['page-hook.js','bridge-core.js','bridge-ui.js','wayfarer-map-adapter.js','wayfarer-polygon-controller.js','polygon-ui.js','wayfarer-observation-zone.js','wayfarer-acquisition-engine.js']) assert.ok(flat.includes(file),`missing ${file}`);
  const hook=fs.readFileSync(path.join(tmp,'page-hook.js'),'utf8');
  const ui=fs.readFileSync(path.join(tmp,'bridge-ui.js'),'utf8');
  const controller=fs.readFileSync(path.join(tmp,'wayfarer-polygon-controller.js'),'utf8');
  const polygonUi=fs.readFileSync(path.join(tmp,'polygon-ui.js'),'utf8');
  assert.ok(hook.includes('CAMPSITE_BRIDGE_ANDROID_M24_PAGE'));
  assert.ok(ui.includes('CAMPSITE_BRIDGE_ANDROID_M24_PAGE'));
  assert.ok(ui.includes('CAMPSITE_BRIDGE_ANDROID_M24_UI'));
  assert.ok(controller.includes("campsite-bridge-pc:polygon-command"),'shared controller still has PC event namespace');
  assert.ok(polygonUi.includes("campsite-bridge-pc:polygon-command"),'shared polygon UI still has PC event namespace');
  console.log('N4-C wiring audit');
  console.log(JSON.stringify({version:manifest.version,scripts,existingAndroidChannel:true,sharedPcEventNamespace:true,verdict:'HOLD: adapter required before real-device gate'},null,2));
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
