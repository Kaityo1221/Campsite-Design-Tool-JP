(() => {
  'use strict';

  function apply(src) {
    if (typeof src !== 'string') return src;
    let out = src;

    out = out.split('runtime/map-engine/map-renderer.js?v=5d14').join('runtime/map-engine/map-renderer.js?v=5d15');

    const engineTags = [
      '<script src="./runtime/map-engine/wayfarer-reserve-coverage.js?v=wm5a1"></script>',
      '<script src="./runtime/map-engine/wayfarer-local-reclassification.js?v=wm5b1"></script>',
      '<script src="./runtime/map-engine/wayfarer-observation-adapter.js?v=wm3c4"></script>',
      '<script src="./runtime/map-engine/wayfarer-reference-geometry.js?v=wm6a1"></script>',
      '<script src="./runtime/map-engine/wayfarer-reference-scene-builder.js?v=wm6a1"></script>'
    ].join('');
    const coreNeedle = "<script>\n(()=>{'use strict';";
    if (out.includes(coreNeedle) && !out.includes('wayfarer-observation-adapter.js?v=wm3c4')) {
      out = out.replace(coreNeedle, engineTags + coreNeedle);
    }

    const wm6Style = `<style id="cmWm6ReferenceInspectStyle">
      #cmWm6ReferencePanel[hidden]{display:none!important}
      #cmWm6ReferencePanel{position:fixed;left:12px;right:12px;bottom:calc(14px + env(safe-area-inset-bottom));z-index:1880;display:block;max-width:520px;margin:0 auto;padding:14px 16px;border:1px solid rgba(103,84,48,.24);border-radius:18px;background:rgba(255,253,248,.97);color:#342d22;box-shadow:0 12px 34px rgba(31,25,17,.20);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #cmWm6ReferencePanel .cm-wm6-head{display:flex;align-items:flex-start;gap:12px}
      #cmWm6ReferencePanel .cm-wm6-copy{min-width:0;flex:1}
      #cmWm6ReferenceTitle{display:block;font-size:16px;line-height:1.35;font-weight:900;overflow-wrap:anywhere}
      #cmWm6ReferenceType{display:block;margin-top:5px;font-size:12px;line-height:1.4;font-weight:800;color:#77684f}
      #cmWm6ReferenceClose{flex:0 0 34px;width:34px;height:34px;border:1px solid rgba(86,72,45,.18);border-radius:999px;background:#fff;color:#4c4030;font-size:21px;line-height:1;display:grid;place-items:center}
      body.cm-unified-renderer-interactive .cm-engine-reference-icon.leaflet-interactive{pointer-events:auto!important}
    </style>`;
    if (!out.includes('id="cmWm6ReferenceInspectStyle"')) out = out.replace('</head>', wm6Style + '</head>');

    const wm6ActivationNeedle = "function cmUnifiedRendererActivate(renderItem,event){";
    if (out.includes(wm6ActivationNeedle) && !out.includes('function cmWm6OpenReferencePanel(')) {
      const wm6Helper = `function cmWm6ReferenceTypeLabel(kind){
  const value=String(kind||'').toUpperCase();
  if(value==='POKESTOP')return 'PokéStop';
  if(value==='GYM')return 'Gym';
  if(value==='POWERSPOT'||value==='INACTIVE_POWERSPOT')return 'PowerSpot';
  return 'POI';
}
let cmWm6ReferencePanel=null;
function cmWm6EnsureReferencePanel(){
  if(cmWm6ReferencePanel?.isConnected)return cmWm6ReferencePanel;
  const panel=document.createElement('section');
  panel.id='cmWm6ReferencePanel';
  panel.hidden=true;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-label','設計範囲外の参照POI');
  panel.innerHTML='<div class="cm-wm6-head"><div class="cm-wm6-copy"><strong id="cmWm6ReferenceTitle"></strong><span id="cmWm6ReferenceType"></span></div><button id="cmWm6ReferenceClose" type="button" aria-label="閉じる">×</button></div>';
  document.body.appendChild(panel);
  panel.querySelector('#cmWm6ReferenceClose')?.addEventListener('click',cmWm6CloseReferencePanel);
  cmWm6ReferencePanel=panel;
  return panel;
}
function cmWm6CloseReferencePanel(){
  const panel=cmWm6ReferencePanel;
  if(panel?.isConnected){panel.hidden=true;panel.setAttribute('aria-hidden','true')}
}
function cmWm6OpenReferencePanel(renderItem){
  if(renderItem?.origin!=='reference'||renderItem?.observationZone!=='REFERENCE_100'||renderItem?.inspectable!==true)return false;
  const panel=cmWm6EnsureReferencePanel();
  const title=panel.querySelector('#cmWm6ReferenceTitle');
  const type=panel.querySelector('#cmWm6ReferenceType');
  if(title)title.textContent=String(renderItem?.title||'').trim()||'名称不明';
  if(type)type.textContent=cmWm6ReferenceTypeLabel(renderItem?.renderKind);
  panel.hidden=false;
  panel.setAttribute('aria-hidden','false');
  return true;
}
setTimeout(()=>{try{map.on('click',cmWm6CloseReferencePanel)}catch(_){}},0);
`;
      out = out.replace(wm6ActivationNeedle, wm6Helper + wm6ActivationNeedle);
      const wm6ActivationBody = "  try{if(event?.originalEvent)L.DomEvent.stopPropagation(event.originalEvent)}catch(_){}\n  const record=cmUnifiedRendererFindRecord(renderItem);";
      const wm6ActivationReplacement = "  try{if(event?.originalEvent)L.DomEvent.stopPropagation(event.originalEvent)}catch(_){}\n  if(renderItem?.origin==='reference'){cmWm6OpenReferencePanel(renderItem);return}\n  const record=cmUnifiedRendererFindRecord(renderItem);";
      if (!out.includes(wm6ActivationBody)) throw new Error('WM-6A unified activation target not found');
      out = out.replace(wm6ActivationBody, wm6ActivationReplacement);
    }

    if (!out.includes('cmWm3cReferenceRuntime')) {
      const coreStart = out.indexOf("(()=>{'use strict';");
      const coreEnd = coreStart >= 0 ? out.indexOf('})();\n</script>', coreStart) : -1;
      if (coreEnd >= 0) {
        const augment = `\n/* cmWm3cReferenceRuntime */
/* WM-4A: RESULT saves a fresh Project; Creative callbacks retain the loaded object. */
if(typeof syncCampsiteProjectFromCreative==='function'){
  const cmWm4aBaseSync=syncCampsiteProjectFromCreative;
  syncCampsiteProjectFromCreative=function(project){
    let latest;
    try{latest=JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null')}catch(_){return null}
    if(!project||!latest||latest.source!=='bridge'||project.source!=='bridge')return null;
    if(!project.projectId||String(latest.projectId||'')!==String(project.projectId))return null;
    if(String(latest.meta?.bridgeHandoffId||'')!==String(project.meta?.bridgeHandoffId||''))return null;
    // Observation is storage-owned; editable arrays and current polygon stay Creative-owned.
    if(Object.prototype.hasOwnProperty.call(latest,'wayfarerObservation'))project.wayfarerObservation=latest.wayfarerObservation;
    else delete project.wayfarerObservation;
    return cmWm4aBaseSync(project);
  };
}
const cmWm3cBaseScene=cmCandidateShadowScene;
let cmWm3cReferenceState={ready:false,display:0,reserve:0,suppressed:0,invalid:0,lastError:'',localCanUse:false,localReason:'',coverageReason:'',currentPolygon:[]};
let cmWm5cReferenceStateSignature='';
function cmWm5cPublishReferenceState(){
  const detail={
    ready:cmWm3cReferenceState.ready===true,
    display:Number(cmWm3cReferenceState.display||0),
    reserve:Number(cmWm3cReferenceState.reserve||0),
    localCanUse:cmWm3cReferenceState.localCanUse===true,
    localReason:String(cmWm3cReferenceState.localReason||''),
    coverageReason:String(cmWm3cReferenceState.coverageReason||'')
  };
  const signature=JSON.stringify(detail);
  if(signature===cmWm5cReferenceStateSignature)return;
  cmWm5cReferenceStateSignature=signature;
  try{window.dispatchEvent(new CustomEvent('campsite:wayfarer-reference-state',{detail}))}catch(_){}
}
function cmWm5cSetReferenceState(next){cmWm3cReferenceState=next;cmWm5cPublishReferenceState();return next}
function cmWm3cReadProject(){try{const project=JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null');return project&&project.source==='bridge'?project:null}catch(_){return null}}
function cmWm5bCurrentCreativePolygon(){
  try{
    const active=(polygons||[]).find(p=>p&&p.deleted!==true&&Array.isArray(p.points)&&p.points.length>=3);
    if(!active)return[];
    return active.points.map(point=>[Number(point?.[0]),Number(point?.[1])]).filter(point=>Number.isFinite(point[0])&&Number.isFinite(point[1]));
  }catch(_){return[]}
}
function cmWm5bDerivedObservation(observation,currentPolygon){
  const local=window.bridgeMapLab_reclassifyWayfarerObservation(observation,currentPolygon);
  if(!local?.canUseLocal)return{local,observation:null};
  return{local,observation:{...observation,zones:{
    interior:Array.from(local.zones?.interior||[]),
    reference100:Array.from(local.zones?.reference100||[]),
    reserve200:Array.from(local.zones?.reserve200||[])
  }}};
}
const cmWm5bBaseSignature=typeof cmCandidateShadowSignature==='function'?cmCandidateShadowSignature:null;
if(cmWm5bBaseSignature){
  cmCandidateShadowSignature=function(){
    const project=cmWm3cReadProject();
    return JSON.stringify({
      base:cmWm5bBaseSignature(),
      referencePolygon:cmWm5bCurrentCreativePolygon(),
      observationSnapshotId:String(project?.wayfarerObservation?.snapshotId||''),
      observationObservedAt:String(project?.wayfarerObservation?.observedAt||'')
    });
  };
}
function cmWm3cReferenceScene(){
  const project=cmWm3cReadProject();
  const observation=project?.wayfarerObservation;
  if(!observation){cmWm5cSetReferenceState({ready:true,display:0,reserve:0,suppressed:0,invalid:0,lastError:'',localCanUse:false,localReason:'NO_OBSERVATION',coverageReason:'',currentPolygon:cmWm5bCurrentCreativePolygon()});return Object.freeze({items:Object.freeze([])})}
  const required=['bridgeMapLab_evaluateWayfarerReserveCoverage','bridgeMapLab_reclassifyWayfarerObservation','bridgeMapLab_adaptWayfarerObservation','bridgeMapLab_buildWayfarerReferenceGeometry','bridgeMapLab_buildWayfarerReferenceScene'];
  const missing=required.filter(name=>typeof window[name]!=='function');
  if(missing.length)throw new Error('Wayfarer Reference modules unavailable: '+missing.join(', '));
  const currentPolygon=cmWm5bCurrentCreativePolygon();
  const derived=cmWm5bDerivedObservation(observation,currentPolygon);
  if(!derived.local?.canUseLocal){
    cmWm5cSetReferenceState({ready:true,display:0,reserve:0,suppressed:0,invalid:0,lastError:'',localCanUse:false,localReason:String(derived.local?.reason||'RECLASSIFICATION_UNAVAILABLE'),coverageReason:String(derived.local?.coverage?.reason||''),currentPolygon});
    return Object.freeze({items:Object.freeze([])});
  }
  const adapted=window.bridgeMapLab_adaptWayfarerObservation(derived.observation,records||[]);
  const geometry=window.bridgeMapLab_buildWayfarerReferenceGeometry(adapted.displayPois);
  const scene=window.bridgeMapLab_buildWayfarerReferenceScene(geometry);
  cmWm5cSetReferenceState({ready:true,display:adapted.counts.display,reserve:adapted.counts.reserve200,suppressed:adapted.counts.suppressedByEditableGuid,invalid:adapted.counts.invalid,lastError:'',localCanUse:true,localReason:String(derived.local.reason||''),coverageReason:String(derived.local.coverage?.reason||''),currentPolygon});
  return scene;
}
cmCandidateShadowScene=function(){
  const baseScene=cmWm3cBaseScene();
  try{
    if(typeof window.bridgeMapLab_mergeSceneWithWayfarerReferences!=='function')return baseScene;
    return window.bridgeMapLab_mergeSceneWithWayfarerReferences(baseScene,cmWm3cReferenceScene());
  }catch(error){cmWm5cSetReferenceState({...cmWm3cReferenceState,lastError:String(error?.message||error||'Reference Layer error')});console.warn('[WM-3C Reference] scene skipped',error);return baseScene}
};
function cmWm3cReferenceRefresh(){try{window.__cmCandidateShadow?.refresh?.()}catch(error){console.warn('[WM-3C Reference] refresh failed',error)}}
window.addEventListener('campsite:wayfarer-observation-saved',cmWm3cReferenceRefresh);
window.__cmWayfarerReference=Object.freeze({getState:()=>({...cmWm3cReferenceState,currentPolygon:cmWm3cReferenceState.currentPolygon.map(point=>point.slice())}),getCurrentPolygon:()=>cmWm5bCurrentCreativePolygon().map(point=>point.slice()),getScene:()=>cmCandidateShadowScene(),refresh:cmWm3cReferenceRefresh});
`;
        out = out.slice(0, coreEnd) + augment + out.slice(coreEnd);
      }
    }

    return out;
  }

  window.applyCreativeWayfarerReferenceLayerPatch = apply;
})();
