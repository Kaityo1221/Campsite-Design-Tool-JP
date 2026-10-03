import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const manifest=JSON.parse(fs.readFileSync('creative/runtime/next-lab-manifest.json','utf8'));
const baseHtml=fs.readFileSync('creative/base-v7.html','utf8');
const jpPatch=fs.readFileSync('creative/jp-creative-patch.js','utf8');
const bridgePatch=fs.readFileSync('creative/bridge-project-patch.js','utf8');
const mapRendererSource=fs.readFileSync('creative/runtime/map-engine/map-renderer.js','utf8');
const livePostManifestPatches=[
  'creative-patches-v45-unified-map-ui.js',
  'creative-patches-v46-field-feedback-polish.js',
  'creative-patches-v48-comet-a-arc.js',
  'creative-patches-v49-remove-add-text.js',
  'creative-patches-v50-add-crosshair-cleanup.js',
  'creative-patches-v51-coordinate-jump.js',
  'creative-patches-v52-existing-new-placement.js',
  'creative-patches-v53-new-poi-auto-memo.js',
  'creative-patches-v54-coordinate-memo-reason.js',
  'creative-patches-v55-unified-visible.js',
  'creative-patches-v56-unified-interaction.js',
  'creative-patches-v57-dev-default-unified.js',
  'creative-patches-v58-new-entry-current-map.js',
  'creative-patches-v59-help-button.js',
  'creative-patches-v60-rules-carousel.js',
  'creative-patches-v61-saved-session-hint.js'
];

function gitBlobShaBuffer(body){
  return crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');
}

for(const [name,expected] of Object.entries(manifest.assets||{})){
  const body=fs.readFileSync('creative/'+name);
  assert.equal(gitBlobShaBuffer(body),expected,'Pinned Next-Lab asset changed: '+name);
}

const context={window:{},console,JSON,String,URLSearchParams};
vm.createContext(context);
context.window.applyCreativePatches=s=>s;

for(const name of manifest.order.slice(1)){
  const source=fs.readFileSync('creative/runtime/'+name,'utf8');
  new vm.Script(source,{filename:'creative/runtime/'+name}).runInContext(context);
  assert.equal(typeof context.window.applyCreativePatches,'function',name+' registration failed');
}

for(const name of livePostManifestPatches){
  const source=fs.readFileSync('creative/runtime/'+name,'utf8');
  new vm.Script(source,{filename:'creative/runtime/'+name}).runInContext(context);
  assert.equal(typeof context.window.applyCreativePatches,'function',name+' registration failed');
}

let html=context.window.applyCreativePatches(baseHtml);

new vm.Script(jpPatch,{filename:'creative/jp-creative-patch.js'}).runInContext(context);
assert.equal(typeof context.window.applyCreativeJpPatch,'function','JP Creative patch registration failed');
html=context.window.applyCreativeJpPatch(html);

new vm.Script(bridgePatch,{filename:'creative/bridge-project-patch.js'}).runInContext(context);
assert.equal(typeof context.window.applyCreativeBridgeProjectPatch,'function','Bridge Creative patch registration failed');
html=context.window.applyCreativeBridgeProjectPatch(html);

assert.ok(html.includes('id="locate"'),'Canonical Next-Lab current-location control missing');
assert.ok(html.includes('cmStandaloneSaveButton'),'Canonical Next-Lab standalone save UI missing');
assert.ok(html.includes('cmV58NewEntryStyle'),'New Creative entry style missing');
assert.ok(html.includes("if(start.classList.contains('ready'))start.disabled=false"),'Creative START must re-enable when returning to entry with a ready file');
assert.ok(!html.includes("location.href=location.origin+location.pathname"),'Creative back must not reload the page');
assert.ok(html.includes('cmV59HelpButton'),'Creative help button missing');
assert.ok(html.includes('cmV60RulesPanel'),'Creative rules carousel missing');
assert.ok(html.includes('cmV61SavedSessionHintStyle'),'Creative saved-session hint missing');
assert.ok(html.includes('creative-mode-opening-final.webp'),'New Creative opening artwork missing');
assert.ok(html.includes('creative-mode-start-transition.webp'),'New Creative START artwork missing');
assert.ok(html.includes('cmV45UnifiedMapUiStyle'),'Current Creative map UI must remain loaded');
assert.ok(html.includes('cmV37BottomDockStyle'),'Canonical Next-Lab bottom dock missing');
assert.ok(html.includes('cmLayerPanelTopStyle'),'Canonical Next-Lab layer panel position patch missing');
assert.ok(html.includes('campsiteProjectNext'),'Bridge next action missing from final Creative HTML');
assert.ok(html.includes('50m未満の候補地があります'),'Creative 50m next-gate copy missing');
assert.ok(html.includes('Zen Maru Gothic'),'Creative 50m next-gate font missing');
assert.ok(!html.includes('installCampsiteProjectMobileUi'),'Legacy JP mobile UI override must stay removed');
assert.ok(html.includes('JP_MAX_ADDITIONAL=25'),'JP design policy helper missing');
assert.ok(html.includes('function cmOpenCoords(){if(cmCoordView?.isConnected)return;'),'Coordinate view singleton guard missing');
assert.ok(html.includes('cmV46Near&&cmV46Near.distance<50'),'Coordinate reason must only render for candidates under 50m');
assert.ok(html.includes("./assets/pokestop.png"),'Canonical Next-Lab PokéStop icon reference missing');
assert.ok(html.includes("./assets/gym.png"),'Canonical Next-Lab Gym icon reference missing');
assert.ok(html.includes("./assets/powerspot.png"),'Canonical Next-Lab PowerSpot icon reference missing');
assert.ok(html.includes('workspaceId:cmEnsureWorkspaceId()'),'Creative workspace payload must carry workspaceId');
assert.ok(html.includes('campsite-workspace-id'),'Creative KMZ must carry workspace identity metadata');
assert.ok(html.includes('window.CampsiteCreativeWorkspace=Object.freeze'),'Creative workspace API missing');
assert.ok(
  html.includes("circleExtras.slice().filter(radius=>Number(radius)!==50).sort((a,b)=>b-a).forEach(radius=>appendDistanceFolder(xml,doc,radius))"),
  'Creative KMZ export must exclude duplicate 50m circle from circleExtras'
);
assert.ok(
  !html.includes("appendDistanceFolder(xml,doc,50);circleExtras.slice().sort((a,b)=>b-a).forEach(radius=>appendDistanceFolder(xml,doc,radius))"),
  'Creative KMZ export must not write the canonical 50m circle twice'
);
assert.ok(html.includes('existing-records-adapter.js?v=5d8'),'D8 existing records adapter cache-bust missing');
assert.ok(html.includes('existing-records-refresh-store.js?v=5d8'),'D8 existing refresh store cache-bust missing');
assert.ok(html.includes('existing-geometry.js?v=5d8'),'D8 existing geometry cache-bust missing');
assert.ok(html.includes('candidate-records-adapter.js?v=5d8'),'D8 candidate adapter cache-bust missing');
assert.ok(html.includes('map-renderer.js?v=5d14'),'D14 feedback renderer cache-bust missing');
assert.ok(html.includes('let cmExistingShadowStore=null'),'D7 existing shadow store binding missing');
assert.ok(html.includes('bridgeMapLab_createExistingRecordsRefreshStore'),'D7 existing store integration missing');
assert.ok(html.includes('existingCounts:cmExistingShadowStore'),'D7 existing diagnostics publishing missing');
assert.ok(html.includes('unified:true'),'D7 Unified Scene state marker missing');
assert.ok(html.includes('cmD8UnifiedRendererVisible'),'D8 unified visible runtime missing');
assert.ok(html.includes('cm-unified-renderer-visible'),'D8 legacy existing marker suppression class missing');
assert.ok(html.includes("mode:unifiedVisible?'unified-visible'"),'D8 unified visible diagnostics mode missing');
assert.ok(html.includes('cmD9UnifiedInteractionRuntime'),'D9 unified interaction runtime missing');
assert.ok(html.includes('cmUnifiedRendererInteractive'),'D9 interactive query gate missing');
assert.ok(html.includes('onMarkerActivate:cmUnifiedRendererInteractive()?cmUnifiedRendererActivate:null'),'D9 renderer activation bridge missing');
assert.ok(html.includes("interactionOwner:cmUnifiedRendererInteractive()?'map-engine':'legacy'"),'D9 interaction ownership diagnostics missing');
assert.ok(html.includes('cmD11DevDefaultRenderer'),'D11 dev-default renderer gate missing');
assert.ok(html.includes("params.get('rendererMode')==='legacy'"),'D11 legacy escape hatch missing');
assert.ok(html.includes('if(params.get(\'candidateRenderer\')!==null)return false;'),'D11 candidate-only explicit mode preservation missing');
assert.ok(html.includes('devDefaultUnified:!explicit'),'D11 default-mode diagnostics missing');
assert.ok(html.includes('legacyOverride:cmD11LegacyRendererRequested()'),'D11 legacy diagnostics missing');
assert.ok(html.includes('cmD14FeedbackHotfixStyle'),'D14 feedback hotfix style missing');
assert.ok(html.includes('#cmCoordinateJumpPanel{z-index:7200!important}'),'Feedback #001 coordinate panel front-layer guard missing');
assert.ok(html.includes('body.cm-unified-renderer-interactive .cm-engine-legacy-candidate{opacity:0!important}'),'Feedback #002 duplicate legacy candidate suppression missing');
assert.ok(mapRendererSource.includes("POKESTOP: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'"),'Feedback #002 PokéStop candidate icon missing');
assert.ok(mapRendererSource.includes("GYM: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'"),'Feedback #002 Gym candidate icon missing');
assert.ok(mapRendererSource.includes("POWERSPOT: 'https://maps.google.com/mapfiles/ms/icons/purple-dot.png'"),'Feedback #002 PowerSpot candidate icon missing');
assert.ok(mapRendererSource.includes('entry.layer.setIcon(bridgeMapLab_candidateIcon(renderItem.renderKind));'),'Feedback #002 candidate type-change icon refresh missing');
assert.ok(html.includes('.cm-v45-power{background:var(--cm-purple);box-shadow:0 0 0 2px #681fc1}'),'Feedback #003 active PowerSpot visual baseline missing');
assert.ok(html.includes('.cm-v45-inactive{background:var(--cm-purple);box-shadow:0 0 0 2px #681fc1;opacity:1}'),'Feedback #003 inactive PowerSpot must match active PowerSpot visual');
assert.ok(mapRendererSource.includes("INACTIVE_POWERSPOT: 'cm-v45-inactive'"),'Feedback #003 inactive PowerSpot render-kind mapping must remain intact');

function extractScripts(source){
  const scripts=[];
  let cursor=0;
  const close='</script>';
  while(true){
    const open=source.indexOf('<script',cursor);
    if(open<0)break;
    const bodyStart=source.indexOf('>',open);
    if(bodyStart<0)break;
    const end=source.indexOf(close,bodyStart+1);
    if(end<0)break;
    scripts.push(source.slice(bodyStart+1,end));
    cursor=end+close.length;
  }
  return scripts;
}

const scripts=extractScripts(html);
assert.ok(scripts.length>=1,'Generated Creative HTML scripts missing');
scripts.forEach((code,index)=>{
  if(!code.trim())return;
  new vm.Script(code,{filename:`generated-creative-final-${index}.js`});
});

console.log(`Generated Creative final HTML syntax: OK (${scripts.length} scripts)`);
