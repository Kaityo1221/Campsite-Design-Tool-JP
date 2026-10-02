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
      '<script src="./runtime/map-engine/wayfarer-reference-geometry.js?v=wm3c4"></script>',
      '<script src="./runtime/map-engine/wayfarer-reference-scene-builder.js?v=wm3c4"></script>'
    ].join('');
    const coreNeedle = "<script>\n(()=>{'use strict';";
    if (out.includes(coreNeedle) && !out.includes('wayfarer-observation-adapter.js?v=wm3c4')) {
      out = out.replace(coreNeedle, engineTags + coreNeedle);
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
const cmWm5bBaseSignature=cmCandidateShadowSignature;
cmCandidateShadowSignature=function(){
  const project=cmWm3cReadProject();
  return JSON.stringify({
    base:cmWm5bBaseSignature(),
    referencePolygon:cmWm5bCurrentCreativePolygon(),
    observationSnapshotId:String(project?.wayfarerObservation?.snapshotId||''),
    observationObservedAt:String(project?.wayfarerObservation?.observedAt||'')
  });
};
function cmWm3cReferenceScene(){
  const project=cmWm3cReadProject();
  const observation=project?.wayfarerObservation;
  if(!observation){cmWm3cReferenceState={ready:true,display:0,reserve:0,suppressed:0,invalid:0,lastError:'',localCanUse:false,localReason:'NO_OBSERVATION',coverageReason:'',currentPolygon:cmWm5bCurrentCreativePolygon()};return Object.freeze({items:Object.freeze([])})}
  const required=['bridgeMapLab_evaluateWayfarerReserveCoverage','bridgeMapLab_reclassifyWayfarerObservation','bridgeMapLab_adaptWayfarerObservation','bridgeMapLab_buildWayfarerReferenceGeometry','bridgeMapLab_buildWayfarerReferenceScene'];
  const missing=required.filter(name=>typeof window[name]!=='function');
  if(missing.length)throw new Error('Wayfarer Reference modules unavailable: '+missing.join(', '));
  const currentPolygon=cmWm5bCurrentCreativePolygon();
  const derived=cmWm5bDerivedObservation(observation,currentPolygon);
  if(!derived.local?.canUseLocal){
    cmWm3cReferenceState={ready:true,display:0,reserve:0,suppressed:0,invalid:0,lastError:'',localCanUse:false,localReason:String(derived.local?.reason||'RECLASSIFICATION_UNAVAILABLE'),coverageReason:String(derived.local?.coverage?.reason||''),currentPolygon};
    return Object.freeze({items:Object.freeze([])});
  }
  const adapted=window.bridgeMapLab_adaptWayfarerObservation(derived.observation,records||[]);
  const geometry=window.bridgeMapLab_buildWayfarerReferenceGeometry(adapted.displayPois);
  const scene=window.bridgeMapLab_buildWayfarerReferenceScene(geometry);
  cmWm3cReferenceState={ready:true,display:adapted.counts.display,reserve:adapted.counts.reserve200,suppressed:adapted.counts.suppressedByEditableGuid,invalid:adapted.counts.invalid,lastError:'',localCanUse:true,localReason:String(derived.local.reason||''),coverageReason:String(derived.local.coverage?.reason||''),currentPolygon};
  return scene;
}
cmCandidateShadowScene=function(){
  const baseScene=cmWm3cBaseScene();
  try{
    if(typeof window.bridgeMapLab_mergeSceneWithWayfarerReferences!=='function')return baseScene;
    return window.bridgeMapLab_mergeSceneWithWayfarerReferences(baseScene,cmWm3cReferenceScene());
  }catch(error){cmWm3cReferenceState={...cmWm3cReferenceState,lastError:String(error?.message||error||'Reference Layer error')};console.warn('[WM-3C Reference] scene skipped',error);return baseScene}
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
