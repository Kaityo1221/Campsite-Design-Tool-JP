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
  for(const file of ['page-hook.js','bridge-core.js','bridge-ui.js','wayfarer-map-adapter.js','wayfarer-polygon-controller.js','polygon-ui.js','wayfarer-observation-zone.js','wayfarer-acquisition-engine.js','panel-polygon-adapter.js','panel-ui-adapter.js']) assert.ok(flat.includes(file),`missing ${file}`);
  const hook=fs.readFileSync(path.join(tmp,'page-hook.js'),'utf8');
  const ui=fs.readFileSync(path.join(tmp,'bridge-ui.js'),'utf8');
  const controller=fs.readFileSync(path.join(tmp,'wayfarer-polygon-controller.js'),'utf8');
  const polygonUi=fs.readFileSync(path.join(tmp,'polygon-ui.js'),'utf8');
  const panelAdapter=fs.readFileSync(path.join(tmp,'panel-polygon-adapter.js'),'utf8');
  const panelUi=fs.readFileSync(path.join(tmp,'panel-ui-adapter.js'),'utf8');
  assert.ok(hook.includes('CAMPSITE_BRIDGE_ANDROID_M24_PAGE'));
  assert.ok(ui.includes('CAMPSITE_BRIDGE_ANDROID_M24_PAGE'));
  assert.ok(ui.includes('CAMPSITE_BRIDGE_ANDROID_M24_UI'));
  const main=scripts.find(x=>x.world==='MAIN');
  const isolated=scripts.find(x=>x.world==='ISOLATED');
  assert.ok(main?.js.includes('page-hook.js'),'page-hook must stay MAIN');
  for(const file of ['wayfarer-map-adapter.js','wayfarer-observation-zone.js','wayfarer-acquisition-engine.js','wayfarer-polygon-controller.js']) {
    assert.ok(main?.js.includes(file), `${file} must execute in MAIN`);
  }
  for(const file of ['bridge-core.js','polygon-ui.js','panel-polygon-adapter.js','bridge-ui.js','panel-ui-adapter.js']) assert.ok(isolated?.js.includes(file), `${file} must execute in ISOLATED`);
  assert.ok(controller.includes("campsite-bridge-android-n4:polygon-command"),'controller must use Android N4 event namespace');
  assert.ok(polygonUi.includes("campsite-bridge-android-n4:polygon-command"),'polygon UI must use Android N4 event namespace');
  assert.equal(controller.includes("campsite-bridge-pc:polygon-command"),false,'PC command namespace leaked into Android controller');
  assert.equal(polygonUi.includes("campsite-bridge-pc:polygon-command"),false,'PC command namespace leaked into Android polygon UI');
  assert.ok(panelAdapter.includes("campsite-bridge-android-n4:panel-state"),'panel adapter state seam missing');
  assert.ok(panelAdapter.includes("campsite-bridge-android-n4:panel-command"),'panel adapter command seam missing');
  assert.ok(panelUi.includes("campsite-bridge-android-n4:panel-state"),'panel UI state seam missing');
  assert.ok(panelUi.includes("campsite-bridge-android-n4:panel-command"),'panel UI command seam missing');
  for (const label of ['設計範囲を編集中','作成途中の設計範囲があります','設計範囲を決めてください','設計範囲はまだありません','Campsiteへ送信！','範囲を編集']) assert.ok(panelUi.includes(label), `panel semantic label missing: ${label}`);
  console.log('N4-C wiring audit');
  console.log(JSON.stringify({version:manifest.version,scripts,existingAndroidChannel:true,androidPolygonNamespace:true,executionWorldsAligned:true,verdict:'PASS: execution-world and polygon event seam'},null,2));
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
