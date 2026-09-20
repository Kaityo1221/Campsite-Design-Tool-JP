import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const nextFlow = fs.readFileSync('js/bridge-next-flow.js', 'utf8');
const creativePatch = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');
const creativeBridge = fs.readFileSync('creative/bridge.html', 'utf8');
const distanceBridge = fs.readFileSync('bridge-distance.html', 'utf8');
const distanceProject = fs.readFileSync('js/bridge-distance-project.js', 'utf8');
const previewPage = fs.readFileSync('bridge-next-preview.html', 'utf8');
const gateway = fs.readFileSync('bridge-gateway.html', 'utf8');
const creativeIndex = fs.readFileSync('creative/index.html', 'utf8');
const creativeBootstrapMarker = '<script>\n(async()=>{';
const creativeScriptStart = creativeIndex.indexOf(creativeBootstrapMarker);
const creativeCodeStart = creativeScriptStart + '<script>\n'.length;
const creativeScriptEnd = creativeIndex.indexOf('</script>', creativeCodeStart);
assert.ok(creativeScriptStart >= 0 && creativeScriptEnd > creativeCodeStart, 'Creative inline bootstrap script missing');
const creativeInlineScript = creativeIndex.slice(creativeCodeStart, creativeScriptEnd);
new vm.Script(creativeInlineScript, { filename: 'creative/index.html:inline-bootstrap' });
const selection = fs.readFileSync('js/bridge-selection.js', 'utf8');
const distanceBandClarity = fs.readFileSync('js/distance-band-clarity-v2.js', 'utf8');
const poiSpacingConfig = fs.readFileSync('js/poi-spacing-config.js', 'utf8');
const distanceEntry = fs.readFileSync('js/distance-entry.js', 'utf8');

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); }
  };
}

const sessionStorage = storage();
const localStorage = storage();
localStorage.setItem('campsiteBridgeNextPreview.v1', '1');
const nextContext = {
  window: {},
  location: { search: '?campsiteBridgeImport=1', href: '' },
  sessionStorage,
  localStorage,
  document: { addEventListener() {}, getElementById() { return null; } },
  URLSearchParams,
  console,
  setTimeout() {},
  crypto: crypto.webcrypto,
  Math,
  Date,
  JSON,
  Map,
  Object,
  Number,
  String,
  Array
};
vm.createContext(nextContext);
vm.runInContext(nextFlow, nextContext);

const api = nextContext.window.CampsiteBridgeNextFlow;
assert.ok(api, 'Bridge Next API missing');
assert.equal(api.projectKey, 'campsiteProject.v1');
assert.equal(api.previewKey, 'campsiteBridgeNextPreview.v1');

const project = api.buildProject({
  version: '0.8.5',
  sourceCount: 3,
  polygon: [[35.0, 139.0], [35.1, 139.0], [35.1, 139.1]],
  pois: [
    { guid: 'a', title: 'Stop', lat: 35.05, lng: 139.05, gameEntity: 'POKESTOP' },
    { guid: 'b', title: 'Gym', lat: 35.06, lng: 139.06, gameEntity: 'GYM' }
  ]
}, {
  version: '0.8.9.4',
  adaptedAt: '2026-09-18T00:00:00.000Z',
  pois: [
    { guid: 'a', title: 'Stop', lat: 35.05, lng: 139.05, gameEntity: 'POKESTOP', provenance: ['WAYFARER_PASSIVE'] },
    { guid: 'b', title: 'Gym', lat: 35.06, lng: 139.06, gameEntity: 'GYM', sponsored: true },
    { guid: 'c', title: 'Power', lat: 35.07, lng: 139.07, gameEntity: 'POWERSPOT' }
  ]
});

assert.equal(project.schemaVersion, '1.0');
assert.equal(project.source, 'bridge');
assert.equal(project.sourcePois.length, 3);
assert.equal(project.selectedPois.length, 2);
assert.equal(project.currentPois.length, 2);
assert.equal(project.polygon.length, 3);
assert.deepEqual([...project.circleRadii], [50, 40, 30]);
assert.equal(project.meta.preview, true);
assert.deepEqual([...project.selectedPois[0].provenance], ['WAYFARER_PASSIVE']);
assert.equal(project.selectedPois[1].sponsored, true);
assert.deepEqual([...project.edits], []);
assert.deepEqual([...project.addedPois], []);
assert.deepEqual([...project.deletedPois], []);
assert.equal(project.distanceResult, null);

const offContext = {
  window: {},
  location: { search: '?campsiteBridgeImport=1', href: '' },
  sessionStorage: storage(),
  localStorage: storage(),
  document: { addEventListener() {}, getElementById() { return null; } },
  URLSearchParams,
  console,
  setTimeout() {},
  crypto: crypto.webcrypto,
  Math,
  Date,
  JSON,
  Map,
  Object,
  Number,
  String,
  Array
};
vm.createContext(offContext);
vm.runInContext(nextFlow, offContext);
assert.equal(offContext.window.CampsiteBridgeNextFlow, undefined, 'Preview OFF must keep legacy flow');

const patchContext = { window: {}, console, JSON, String };
vm.createContext(patchContext);
vm.runInContext(creativePatch, patchContext);
assert.equal(typeof patchContext.window.applyCreativeBridgeProjectPatch, 'function');
const transformed = patchContext.window.applyCreativeBridgeProjectPatch(`before\nfunction beginEditor(){return true}\nfunction restore(){return true}\nafter`);
assert.ok(transformed.includes('loadCampsiteBridgeProject'));
assert.ok(transformed.includes('syncCampsiteProjectFromCreative'));
assert.ok(transformed.includes('installCampsiteProjectNext'));
assert.ok(!transformed.includes('installCampsiteProjectMobileUi'), 'Bridge must not override the canonical Next-Lab Creative UI');
assert.ok(transformed.includes("btn.textContent='次へ →'"), 'Bridge-only next action should stay compact');
assert.ok(transformed.includes("aria-label','次へ：距離チェック'"), 'Bridge-only next action must keep an accessible distance-check label');
assert.ok(transformed.includes('あと少し！ 50m未満のPOIがあります'), 'Creative next gate copy missing');
assert.ok(transformed.includes('Zen Maru Gothic'), 'Creative next gate must use Zen Maru Gothic');
assert.ok(transformed.includes('campsProjectWarningRecords()'), 'Creative next must check new POI spacing before distance handoff');
assert.ok(transformed.includes("if(warnings.length){campsProjectShowDistanceGate(warnings);return}"), 'Creative next must block while warnings remain');
assert.ok(transformed.includes("role:campsProjectRole(r.layer)"));
assert.ok(transformed.includes('project.circleRadii='), 'Project must carry Creative circle state');
assert.ok(transformed.includes('campsProjectApplyCircleRadii(project.circleRadii)'), 'Creative must apply Bridge circle policy');
assert.ok(transformed.includes('circleExtras=radii.slice()'), 'Bridge must normalize the current circle state');
assert.ok(transformed.includes('function campsProjectNormalizeCircleRadii(){return [50,40,30]}'), 'Bridge circle policy must default to all three radii');
assert.ok(transformed.includes("typeof circleVisible!=='undefined'"), 'Bridge must normalize both circle state models');
assert.ok(transformed.includes('project.circleRadii=campsProjectCurrentCircleRadii()'), 'Project must save the canonical Creative circle state');
assert.ok(transformed.includes('Array.isArray(project&&project.currentPois)?project.currentPois'), 'Bridge rework must restore currentPois instead of the original selection');
assert.ok(transformed.includes('function campsProjectLoadLayer(poi)'), 'Bridge rework must preserve existing/new POI roles');
assert.ok(transformed.includes("location.href='../bridge-distance.html?campsiteProject=bridge'"));
assert.ok(transformed.includes("type==='GYM'"));
assert.ok(transformed.includes("type==='POWERSPOT'"));
assert.ok(transformed.includes("return'existing-pokestop'"));
assert.ok(transformed.includes("sessionStorage.getItem(CAMPSITE_PROJECT_KEY)"));

assert.ok(creativeIndex.includes("fetch('./bridge-project-patch.js'"), 'Creative runtime must load the Bridge project patch');
assert.ok(creativeIndex.includes("new URLSearchParams(location.search).get('campsiteProject')==='bridge'"), 'Creative runtime must detect Bridge projects');
assert.ok(creativeIndex.includes('html=window.applyCreativeBridgeProjectPatch(html)'), 'Creative runtime must apply the Bridge patch to final HTML');
assert.ok(creativeBridge.includes("location.replace(target.href)"), 'Legacy Bridge entry must redirect instead of document.write');
assert.ok(!creativeBridge.includes("document.write("), 'Legacy Bridge entry must not rehydrate Creative with document.write');
assert.ok(nextFlow.includes("./creative/index.html?campsiteProject=bridge"), 'Next flow must enter Creative index directly');
assert.ok(!nextFlow.includes("./creative/bridge.html?campsiteProject=bridge"), 'Next flow must not use the nested Bridge wrapper');

assert.ok(distanceBridge.includes('js/bridge-distance-project.js?v=2'));
assert.ok(distanceBridge.includes("fetch('./index.html'"));
assert.ok(distanceBridge.includes("params.get('campsiteProject')!=='bridge'"));
assert.ok(distanceProject.includes("const PROJECT_KEY = 'campsiteProject.v1'"));
assert.ok(distanceProject.includes("'既存 PokéStop'"));
assert.ok(distanceProject.includes("'既存 Gym'"));
assert.ok(distanceProject.includes("'既存 PowerSpot'"));
assert.ok(distanceProject.includes("'新規 PokéStop'"));
assert.ok(distanceProject.includes("'新規 Gym'"));
assert.ok(distanceProject.includes("'新規 PowerSpot'"));
assert.ok(distanceProject.includes('window._layerPoints = groups'));
assert.ok(distanceProject.includes('window._activityPolygons'));
assert.ok(distanceProject.includes("window._inputType = 'project'"));
assert.ok(distanceProject.includes('buildDistanceSnapshot'));
assert.ok(distanceProject.includes("latest.phase = 'distance'"));
assert.ok(distanceProject.includes("latest.phase = 'pre-submit'"));
assert.ok(distanceProject.includes("'[data-go-pre-submit]'"));
assert.ok(distanceProject.includes('💾 保存して作り直す'), 'Distance footer must offer save-and-rework');
assert.ok(distanceProject.includes("location.href = './creative/index.html?campsiteProject=bridge'"), 'Save-and-rework must return to Bridge Creative');
assert.ok(distanceProject.includes("guide.insertAdjacentElement('afterend', wrap)"), 'Save-and-rework must be placed at the bottom after the checklist guide');
assert.ok(distanceBandClarity.includes('対象：既存×新規 / 新規×新規'), 'Distance result must state the target pair types');
assert.ok(poiSpacingConfig.includes('distance-band-clarity-v2.js?v=3'), 'Distance clarity cache key must be bumped');
assert.ok(distanceEntry.includes('distance-postcheck-mode .distance-file-step{display:none!important}'), 'Distance UI must hide the full precheck step after a run');
assert.ok(distanceEntry.includes('enterDistancePostcheckMode();'), 'Distance run must switch into postcheck mode');
assert.ok(fs.readFileSync('index.html','utf8').includes('js/distance-entry.js?v=6'), 'Distance entry cache key must be bumped');

assert.ok(previewPage.includes("const KEY='campsiteBridgeNextPreview.v1'"));
assert.ok(previewPage.includes("localStorage.setItem(KEY,'1')"));
assert.ok(previewPage.includes("localStorage.removeItem(KEY)"));
assert.ok(previewPage.includes('新フローをON'));
assert.ok(previewPage.includes('新フローをOFF'));

assert.ok(selection.includes('id="bridgeScrollHandle"'), 'Bridge map must expose a mobile scroll handle');
assert.ok(!selection.includes('function selectedRadii()'), 'Bridge must not expose circle selection state');
assert.ok(!selection.includes('bridge-radius-step'), 'Bridge must not mount the legacy circle options');
assert.ok(selection.includes('campsite-bridge-selection-active #tool .poi-spacing-radius-step{display:none!important}'), 'Bridge must hard-hide the legacy radius step');
assert.ok(selection.includes("document.body.classList.add('campsite-bridge-selection-active')"), 'Bridge must activate the radius-step suppression class');
assert.ok(nextFlow.includes('const circleRadii = [50, 40, 30];'), 'Bridge project must start Creative with all circle layers');
assert.ok(selection.includes("touch-action:pan-y"), 'Bridge scroll handle must allow page panning');
assert.ok(selection.includes("$('campsiteBridgeSelection')?.querySelector('.bridge-tools')"), 'Bridge scroll handle must not depend on a removed local box');
assert.ok(selection.includes("height:52svh"), 'Bridge map must use a viewport-aware mobile height');
assert.ok(selection.includes("const NEXT_PREVIEW_KEY = 'campsiteBridgeNextPreview.v1'"), 'Selection must know the Next preview flag');
assert.ok(selection.includes('if (isNextPreviewEnabled())'), 'Selection must save the snapshot before skipping legacy CSV handoff');
assert.ok(selection.indexOf('sessionStorage.setItem(SELECTION_STORAGE_KEY') < selection.indexOf('if (isNextPreviewEnabled())'), 'Selection snapshot must be saved before preview skips CSV');
assert.ok(selection.indexOf('if (isNextPreviewEnabled())') < selection.indexOf("const input = $('fileInput')"), 'Preview must skip only the legacy virtual CSV path');
assert.ok(nextFlow.includes('setTimeout(continueToCreative, 0)'), 'Next flow must wait until selection snapshot is saved');
assert.ok(!nextFlow.includes('stopImmediatePropagation'), 'Next flow must not block the selection save listener');
const selectionPos = gateway.indexOf('js/bridge-selection.js?v=9');
const nextPos = gateway.indexOf('js/bridge-next-flow.js?v=5');
assert.ok(selectionPos >= 0 && nextPos > selectionPos, 'Next flow must load after polygon selection');


const caAccess = fs.readFileSync('js/ca-access.js', 'utf8');
const caBootstrap = fs.readFileSync('js/ca-access-bootstrap.js', 'utf8');
const labSupabase = fs.readFileSync('js/lab-supabase.js', 'utf8');
const receiver = fs.readFileSync('bridge-receiver.html', 'utf8');
const mainIndex = fs.readFileSync('index.html', 'utf8');

assert.ok(caBootstrap.indexOf('const BOOTSTRAP_SCRIPT_SRC') < caBootstrap.indexOf('async function boot()'), 'Bootstrap base must be captured before first await');
assert.ok(caBootstrap.includes("ca-access.js?v=5"), 'Standalone bootstrap must load CA access v5');
assert.ok(creativeIndex.includes('ca-access-bootstrap.js?v=3'), 'Creative must bust stale auth bootstrap cache');
assert.ok(caBootstrap.indexOf("ca-access.js?v=5") < caBootstrap.indexOf("CampsitePolicy?.ready"), 'Authentication must start before policy readiness is observed');
assert.ok(creativeIndex.includes("isBridgeProject?'CREATIVE MODEを開いています…':'認証システムを準備しています…'"), 'Bridge handoff must hide repeated auth copy');
assert.ok(creativeIndex.includes("while(document.getElementById('caAccessGate'))"), 'Creative must keep authentication enforcement in the background');
assert.ok(creativeIndex.includes("setBootStatus('CREATIVE MODE本体を準備しています…')"), 'Creative must move directly from hidden auth to runtime preparation');
assert.ok(creativeIndex.includes("fetch('./runtime/runtime-vnext.html',{cache:'no-store'})"), 'Creative must load the vendored runtime after auth');
assert.ok(creativeIndex.includes("10000"), 'Creative auth bootstrap must have a bounded startup wait');
assert.ok(caAccess.includes('HANDOFF_PARAMS.get("campsiteBridgeImport") === "1"'), 'Gateway handoff must be recognized');
assert.ok(caAccess.includes('HANDOFF_PARAMS.get("campsiteProject") === "bridge"'), 'Creative/distance handoff must be recognized');
assert.ok(caAccess.includes('ca-gate-handoff-pending'), 'Handoff auth gate must stay hidden while session is checked');
assert.ok(caAccess.includes('unlockMainPage({ silent: true })'), 'Approved handoff must auto-enter');
assert.ok(labSupabase.includes("js/ca-access.js?v=5"), 'Main tool must load seamless CA access v5');
assert.ok(mainIndex.includes('js/lab-supabase.js?v=20260918-bridge1'), 'Main index must bust stale auth loader cache');
assert.ok(receiver.includes("setTimeout(goToCampsite, 450)"), 'Receiver must preserve ACK window before handoff');
assert.ok(receiver.includes("setTimeout(showReceiverDetail, 2500)"), 'Receiver detail should be fallback-only');
assert.ok(receiver.includes('bridge-receiver-detail'), 'Receiver must support diagnostic detail mode');
assert.ok(gateway.includes('#loginScreen,#splashScreen,#openingScreen{display:none!important}'), 'Gateway must suppress legacy login/splash flash');


const creativeManifest = JSON.parse(fs.readFileSync('creative/runtime/next-lab-manifest.json', 'utf8'));
assert.equal(creativeManifest.sourceRepo, 'Kaityo1221/Campsite-Design-Tool-Next-Lab');
assert.equal(creativeManifest.sourceCommit, 'c10b910344952ade36b2791a122f9f38e6c54d0b');
assert.equal(creativeManifest.order.length, 35, 'Next-Lab runtime + 34 patch files must be pinned');

function gitBlobSha(text){
  const body=Buffer.from(text,'utf8');
  return crypto.createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}

for(const name of creativeManifest.order){
  const source=fs.readFileSync('creative/runtime/'+name,'utf8');
  assert.equal(gitBlobSha(source),creativeManifest.sha1[name],`Pinned Next-Lab file changed: ${name}`);
  if(name.endsWith('.js'))new vm.Script(source,{filename:'creative/runtime/'+name});
  assert.ok(creativeIndex.includes(name),`Creative loader missing Next-Lab file: ${name}`);
}

const creativeRuntime = fs.readFileSync('creative/runtime/runtime-vnext.html', 'utf8');
const runtimeStart=creativeRuntime.indexOf('<script>');
const runtimeEnd=creativeRuntime.lastIndexOf('</script>');
assert.ok(runtimeStart>=0&&runtimeEnd>runtimeStart,'Pinned runtime inline script missing');
new vm.Script(creativeRuntime.slice(runtimeStart+'<script>'.length,runtimeEnd),{filename:'creative/runtime/runtime-vnext.html:inline'});
assert.ok(creativeIndex.includes("const NEXT_LAB_SOURCE='c10b910344952ade36b2791a122f9f38e6c54d0b'"),'Creative loader must identify the synced Next-Lab source commit');

assert.ok(creativeIndex.includes("const NEXT_LAB_SOURCE='c10b910344952ade36b2791a122f9f38e6c54d0b'"),'Creative loader must identify the synced Next-Lab source commit');
assert.ok(creativeIndex.includes("fetch('./runtime/runtime-vnext.html'"),'Creative must load the vendored runtime locally');
assert.ok(creativeIndex.includes("const PATCH_FILES="),'Creative must declare the canonical Next-Lab patch chain');
assert.ok(creativeIndex.includes("html=window.applyCreativePatches(html)"),'Creative must apply Next-Lab patches to base-v7 HTML');
assert.ok(creativeIndex.includes("fetch('./jp-creative-patch.js'"),'Creative must load the JP final-HTML patch');
assert.ok(creativeIndex.includes("fetch('./bridge-project-patch.js'"),'Creative must load the Bridge final-HTML patch');
assert.ok(creativeIndex.indexOf("html=window.applyCreativePatches(html)") < creativeIndex.indexOf("window.applyCreativeJpPatch"),'JP patch must run after canonical Next-Lab patches');
assert.ok(creativeIndex.indexOf("window.applyCreativeJpPatch") < creativeIndex.indexOf("window.applyCreativeBridgeProjectPatch"),'Bridge patch must run after JP patch');
assert.ok(creativeIndex.includes('"creative-patches-v37-bottom-dock.js"'),'Canonical Next-Lab bottom dock patch missing');
assert.ok(creativeIndex.includes('"creative-patches-v39-layer-panel-top.js"'),'Canonical Next-Lab layer-panel patch missing');
assert.ok(creativeIndex.includes('"creative-patches-v43-save-standalone.js"'),'Canonical Next-Lab save UI patch missing');
assert.ok(creativeIndex.includes('"creative-patches-v44-lab-update-3-lines.js"'),'Canonical Next-Lab latest UI patch missing');
assert.ok(!creativeIndex.includes('raw.githubusercontent.com/Kaityo1221/Campsite-Design-Tool-Next-Lab'),'Creative must not depend on raw Next-Lab at runtime');
assert.ok(creativeIndex.includes("document.open();document.write(runtime);document.close();"),'Creative must boot the vendored runtime using the current Next-Lab architecture');
const creativeBase = fs.readFileSync('creative/base-v7.html', 'utf8');
assert.ok(creativeBase.includes('<title>CREATIVE MODE | Next Lab</title>'), 'Pinned base-v7 snapshot missing');
assert.ok(creativeBase.includes("const map=L.map('map'"), 'Pinned base-v7 map runtime missing');
assert.ok(creativeIndex.includes('id="creativeBootStatus"'), 'Creative loading status must stay visible during bootstrap');
assert.ok(creativeIndex.includes('CREATIVE MODE本体を準備しています'), 'Creative loading status must advance after auth');
console.log('Bridge -> Project -> Creative -> Distance -> Pre-submit preview contract: OK');
