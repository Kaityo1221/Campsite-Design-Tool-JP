(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    if(src.includes('cmExistingShadowStore'))return src;

    const candidateTag='<script src="./runtime/map-engine/candidate-records-adapter.js?v=5d3"></script>';
    const existingTags=[
      '<script src="./runtime/map-engine/existing-records-adapter.js?v=5d7"></script>',
      '<script src="./runtime/map-engine/existing-records-refresh-store.js?v=5d7"></script>',
      '<script src="./runtime/map-engine/existing-geometry.js?v=5d7"></script>'
    ].join('');
    if(src.includes(candidateTag)&&!src.includes('existing-records-adapter.js?v=5d7')){
      src=src.replace(candidateTag,existingTags+candidateTag);
    }

    const signatureNeedle='function cmCandidateShadowSignature(){';
    if(src.includes(signatureNeedle)){
      const helper=`let cmExistingShadowStore=null;
function cmExistingShadowDisplayState(){
  const types={};
  ['existing-pokestop','existing-gym','existing-power'].forEach(type=>{try{types[type]=!!(groups?.[type]&&map.hasLayer(groups[type]))}catch(_){types[type]=true}});
  return types;
}
`;
      src=src.replace(signatureNeedle,helper+signatureNeedle);
    }

    const oldSignature="function cmCandidateShadowSignature(){\n  try{const candidates=(records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('new-')).map(r=>[String(r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0]));const display=cmCandidateShadowDisplayState();return JSON.stringify({candidates,radii:display.radii,types:display.types,visible:cmCandidateRendererVisible()})}catch(_){return'{}'}\n}";
    const newSignature="function cmCandidateShadowSignature(){\n  try{const candidates=(records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('new-')).map(r=>[String(r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0]));const existing=(records||[]).filter(r=>r&&['existing-pokestop','existing-gym','existing-power'].includes(String(r.layer||''))).map(r=>[String(r.guid||r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null,String(r.gameStatus||'')]).sort((a,b)=>a[0].localeCompare(b[0]));const display=cmCandidateShadowDisplayState();return JSON.stringify({candidates,existing,radii:display.radii,types:display.types,existingTypes:cmExistingShadowDisplayState(),visible:cmCandidateRendererVisible()})}catch(_){return'{}'}\n}";
    if(src.includes(oldSignature))src=src.replace(oldSignature,newSignature);

    const oldScene="function cmCandidateShadowScene(){const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];const geometry=window.bridgeMapLab_buildCandidateGeometry(candidates);const display=cmCandidateShadowDisplayState();return window.bridgeMapLab_buildSceneWithCandidates({pois:[]},{entries:[]},geometry,{circleRadiiVisible:display.radii,candidateTypesVisible:display.types})}";
    const newScene="function cmCandidateShadowScene(){const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];const candidateGeometry=window.bridgeMapLab_buildCandidateGeometry(candidates);const display=cmCandidateShadowDisplayState();const includeExisting=!cmCandidateRendererVisible();const existingPois=includeExisting&&cmExistingShadowStore?cmExistingShadowStore.list():[];const existingGeometry=window.bridgeMapLab_buildExistingGeometry(existingPois);return window.bridgeMapLab_buildSceneWithCandidates({pois:existingPois},existingGeometry,candidateGeometry,{circleRadiiVisible:display.radii,candidateTypesVisible:display.types,existingTypesVisible:cmExistingShadowDisplayState()})}";
    if(src.includes(oldScene))src=src.replace(oldScene,newScene);

    const oldPublish="function cmCandidateShadowPublish(reason){try{const visible=cmCandidateRendererVisible();window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,display:cmCandidateShadowDisplayState(),counts:cmCandidateShadowStore?.getCounts?.()||null,diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0,circles40:0,circles30:0},sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,shadow:!visible,visible}}catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}}";
    const newPublish="function cmCandidateShadowPublish(reason){try{const visible=cmCandidateRendererVisible();window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,display:cmCandidateShadowDisplayState(),existingDisplay:cmExistingShadowDisplayState(),counts:cmCandidateShadowStore?.getCounts?.()||null,diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],existingCounts:cmExistingShadowStore?.getCounts?.()||null,existingDiagnostics:cmExistingShadowStore?.getDiagnostics?.()||[],rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0,circles40:0,circles30:0},sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,shadow:!visible,visible}}catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}}";
    if(src.includes(oldPublish))src=src.replace(oldPublish,newPublish);

    src=src.replace(
      "cmCandidateShadowStore=null;cmCandidateShadowRenderer=null;",
      "cmCandidateShadowStore=null;cmExistingShadowStore=null;cmCandidateShadowRenderer=null;"
    );

    const oldRequired="const required=['bridgeMapLab_createCandidateRecordsRefreshStore','bridgeMapLab_buildCandidateGeometry','bridgeMapLab_buildSceneWithCandidates','bridgeMapLab_createMapRenderer'];";
    const newRequired="const required=['bridgeMapLab_createCandidateRecordsRefreshStore','bridgeMapLab_buildCandidateGeometry','bridgeMapLab_createExistingRecordsRefreshStore','bridgeMapLab_buildExistingGeometry','bridgeMapLab_buildSceneWithCandidates','bridgeMapLab_createMapRenderer'];";
    if(src.includes(oldRequired))src=src.replace(oldRequired,newRequired);

    const oldInit="cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});";
    const newInit="cmExistingShadowStore=window.bridgeMapLab_createExistingRecordsRefreshStore(()=>records);cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});";
    if(src.includes(oldInit))src=src.replace(oldInit,newInit);

    const oldRefresh="cmCandidateShadowLastSignature=signature;try{cmCandidateShadowStore.refresh();cmCandidateShadowPublish(reason||'refresh');return true}catch(error)";
    const newRefresh="cmCandidateShadowLastSignature=signature;try{cmExistingShadowStore?.refresh?.();cmCandidateShadowStore.refresh();cmCandidateShadowPublish(reason||'refresh');return true}catch(error)";
    if(src.includes(oldRefresh))src=src.replace(oldRefresh,newRefresh);

    return src;
  };
})();
