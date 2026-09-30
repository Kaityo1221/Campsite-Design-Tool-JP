(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    if(!src.includes('existing-records-adapter.js?v=5d7')){
      const existingTags=[
        '<script src="./runtime/map-engine/existing-records-adapter.js?v=5d7"></script>',
        '<script src="./runtime/map-engine/existing-records-refresh-store.js?v=5d7"></script>',
        '<script src="./runtime/map-engine/existing-geometry.js?v=5d7"></script>'
      ].join('');
      const coreNeedle="<script>\n(()=>{'use strict';";
      if(src.includes(coreNeedle))src=src.replace(coreNeedle,existingTags+coreNeedle);
    }

    if(!src.includes('cmD7ExistingShadowStore')){
      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const augment=`\n/* cmD7ExistingShadowStore */
let cmExistingShadowStore=null;
const cmD7CandidateDisplayState=cmCandidateShadowDisplayState;
cmCandidateShadowDisplayState=function(){
  const base=cmD7CandidateDisplayState();
  const candidateTypes=base?.candidateTypes||base?.types||{};
  const existingTypes={};
  ['existing-pokestop','existing-gym','existing-power'].forEach(type=>{try{existingTypes[type]=!!(groups?.[type]&&map.hasLayer(groups[type]))}catch(_){existingTypes[type]=true}});
  return{radii:Array.isArray(base?.radii)?base.radii:[],types:candidateTypes,candidateTypes,existingTypes};
};
cmCandidateShadowSignature=function(){
  try{
    const candidates=(records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('new-')).map(r=>[String(r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0]));
    const existing=(records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('existing-')).map(r=>[String(r.guid||r.id||''),String(r.layer||''),String(r.gameStatus||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0]));
    const display=cmCandidateShadowDisplayState();
    return JSON.stringify({candidates,existing,radii:display.radii,candidateTypes:display.candidateTypes,existingTypes:display.existingTypes,visible:cmCandidateRendererVisible()});
  }catch(_){return'{}'}
};
cmCandidateShadowScene=function(){
  const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];
  const candidateGeometry=window.bridgeMapLab_buildCandidateGeometry(candidates);
  const display=cmCandidateShadowDisplayState();
  let existingPois=[];
  let existingGeometry={entries:[]};
  if(!cmCandidateRendererVisible()&&cmExistingShadowStore){
    existingPois=cmExistingShadowStore.list();
    existingGeometry=window.bridgeMapLab_buildExistingGeometry(existingPois);
  }
  return window.bridgeMapLab_buildSceneWithCandidates(
    {pois:existingPois},
    existingGeometry,
    candidateGeometry,
    {circleRadiiVisible:display.radii,candidateTypesVisible:display.candidateTypes,existingTypesVisible:display.existingTypes}
  );
};
cmCandidateShadowPublish=function(reason){
  try{
    const visible=cmCandidateRendererVisible();
    window.__cmCandidateShadowState={
      ready:cmCandidateShadowReady,
      reason:reason||'',
      renderCount:cmCandidateShadowRenderCount,
      display:cmCandidateShadowDisplayState(),
      counts:cmCandidateShadowStore?.getCounts?.()||null,
      diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],
      existingCounts:cmExistingShadowStore?.getCounts?.()||null,
      existingDiagnostics:cmExistingShadowStore?.getDiagnostics?.()||[],
      rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0,circles40:0,circles30:0},
      sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,
      shadow:!visible,
      visible,
      existingShadow:!visible
    };
  }catch(error){console.warn('[Unified Shadow] diagnostics publish failed',error)}
};
cmCandidateShadowTeardown=function(){
  try{cmCandidateShadowUnsubscribe?.()}catch(_){}
  try{cmCandidateShadowRenderer?.destroy?.()}catch(_){}
  try{document.body.classList.remove('cm-candidate-renderer-visible')}catch(_){}
  cmCandidateShadowUnsubscribe=null;
  cmCandidateShadowRenderer=null;
  cmCandidateShadowStore=null;
  cmExistingShadowStore=null;
  cmCandidateShadowReady=false;
  cmCandidateShadowLastSignature=null;
  cmCandidateShadowPublish('teardown');
};
cmCandidateShadowEnsure=function(){
  if(cmCandidateShadowReady&&cmCandidateShadowStore&&cmExistingShadowStore&&cmCandidateShadowRenderer)return true;
  const required=['bridgeMapLab_createCandidateRecordsRefreshStore','bridgeMapLab_buildCandidateGeometry','bridgeMapLab_buildSceneWithCandidates','bridgeMapLab_createMapRenderer','bridgeMapLab_createExistingRecordsRefreshStore','bridgeMapLab_buildExistingGeometry'];
  const missing=required.filter(name=>typeof window[name]!=='function');
  if(missing.length){console.error('[Unified Shadow] engine unavailable',missing);return false}
  try{
    const visible=cmCandidateRendererVisible();
    if(visible)document.body.classList.add('cm-candidate-renderer-visible');
    cmExistingShadowStore=window.bridgeMapLab_createExistingRecordsRefreshStore(()=>records);
    cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);
    cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});
    cmCandidateShadowUnsubscribe=cmCandidateShadowStore.subscribe(()=>cmCandidateShadowRender('refresh'));
    cmCandidateShadowReady=true;
    cmCandidateShadowLastSignature=cmCandidateShadowSignature();
    cmCandidateShadowRender('initial');
    if(!cmCandidateShadowPagehideBound){window.addEventListener('pagehide',cmCandidateShadowTeardown);cmCandidateShadowPagehideBound=true}
    window.__cmCandidateShadow=Object.freeze({getState:()=>window.__cmCandidateShadowState?JSON.parse(JSON.stringify(window.__cmCandidateShadowState)):null,refresh:()=>cmCandidateShadowRefresh('manual',true),teardown:cmCandidateShadowTeardown});
    return true;
  }catch(error){console.error('[Unified Shadow] init failed',error);cmCandidateShadowTeardown();return false}
};
cmCandidateShadowRefresh=function(reason,force=false){
  if(!cmCandidateShadowEnsure())return false;
  const signature=cmCandidateShadowSignature();
  if(!force&&signature===cmCandidateShadowLastSignature){cmCandidateRendererSyncLegacyMarkers();cmCandidateShadowPublish(reason||'unchanged');return false}
  cmCandidateShadowLastSignature=signature;
  try{
    cmExistingShadowStore.refresh();
    cmCandidateShadowStore.refresh();
    cmCandidateShadowPublish(reason||'refresh');
    return true;
  }catch(error){console.error('[Unified Shadow] refresh failed',error);cmCandidateShadowPublish('refresh-error');return false}
};
`;
        src=src.slice(0,coreEnd)+augment+src.slice(coreEnd);
      }
    }

    return src;
  };
})();
