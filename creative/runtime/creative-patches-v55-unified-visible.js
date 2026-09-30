(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // D8 changes renderer behavior. Bump only Map Engine asset URLs so Safari/GitHub Pages
    // cannot reuse the D7 renderer while keeping the D8 cutover fully query-gated.
    src=src.split('runtime/map-engine/existing-records-adapter.js?v=5d4').join('runtime/map-engine/existing-records-adapter.js?v=5d8');
    src=src.split('runtime/map-engine/existing-records-refresh-store.js?v=5d4').join('runtime/map-engine/existing-records-refresh-store.js?v=5d8');
    src=src.split('runtime/map-engine/existing-geometry.js?v=5d4').join('runtime/map-engine/existing-geometry.js?v=5d8');
    src=src.split('runtime/map-engine/candidate-records-adapter.js?v=5d4').join('runtime/map-engine/candidate-records-adapter.js?v=5d8');
    src=src.split('runtime/map-engine/candidate-records-refresh-store.js?v=5d4').join('runtime/map-engine/candidate-records-refresh-store.js?v=5d8');
    src=src.split('runtime/map-engine/candidate-geometry.js?v=5d4').join('runtime/map-engine/candidate-geometry.js?v=5d8');
    src=src.split('runtime/map-engine/scene-builder.js?v=5d4').join('runtime/map-engine/scene-builder.js?v=5d8');
    src=src.split('runtime/map-engine/candidate-scene-builder.js?v=5d4').join('runtime/map-engine/candidate-scene-builder.js?v=5d8');
    src=src.split('runtime/map-engine/map-renderer.js?v=5d4').join('runtime/map-engine/map-renderer.js?v=5d8');

    const style=`<style id="cmD8UnifiedVisibleStyle">
      .cm-engine-existing-icon{pointer-events:none!important}
      body.cm-unified-renderer-visible .cm-engine-legacy-existing{opacity:0!important}
    </style>`;
    if(!src.includes('id="cmD8UnifiedVisibleStyle"'))src=src.replace('</head>',style+'</head>');

    if(!src.includes('cmD8UnifiedRendererVisible')){
      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const augment=`\n/* cmD8UnifiedRendererVisible */
const cmD8CandidateRendererVisible=cmCandidateRendererVisible;
function cmUnifiedRendererVisible(){try{return new URLSearchParams(location.search).get('unifiedRenderer')==='visible'}catch(_){return false}}
cmCandidateRendererVisible=function(){return cmUnifiedRendererVisible()||cmD8CandidateRendererVisible()};
const cmD8CandidateShadowScene=cmCandidateShadowScene;
cmCandidateShadowScene=function(){
  if(!cmUnifiedRendererVisible())return cmD8CandidateShadowScene();
  const existingPois=cmExistingShadowStore?cmExistingShadowStore.list():[];
  const existingGeometry=window.bridgeMapLab_buildExistingGeometry(existingPois);
  const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];
  const candidateGeometry=window.bridgeMapLab_buildCandidateGeometry(candidates);
  const display=cmCandidateShadowDisplayState();
  return window.bridgeMapLab_buildSceneWithCandidates(
    {pois:existingPois},
    existingGeometry,
    candidateGeometry,
    {circleRadiiVisible:display.radii,candidateTypesVisible:display.candidateTypes,existingTypesVisible:display.existingTypes}
  );
};
const cmD8CandidateRendererSyncLegacyMarkers=cmCandidateRendererSyncLegacyMarkers;
cmCandidateRendererSyncLegacyMarkers=function(){
  cmD8CandidateRendererSyncLegacyMarkers();
  if(!cmUnifiedRendererVisible())return;
  try{document.body.classList.add('cm-unified-renderer-visible')}catch(_){}
  for(const r of records||[]){
    if(!r||r.deleted||typeof r.layer!=='string'||!r.layer.startsWith('existing-'))continue;
    try{r.marker?.getElement?.()?.classList?.add('cm-engine-legacy-existing')}catch(_){}
  }
};
const cmD8CandidateRendererRenderLegacyCircles=cmCandidateRendererRenderLegacyCircles;
cmCandidateRendererRenderLegacyCircles=function(){
  if(!cmUnifiedRendererVisible())return cmD8CandidateRendererRenderLegacyCircles();
  recordCircleGroup.clearLayers();
  if(!map.hasLayer(recordCircleGroup))recordCircleGroup.addTo(map);
};
const cmD8CandidateShadowPublish=cmCandidateShadowPublish;
cmCandidateShadowPublish=function(reason){
  cmD8CandidateShadowPublish(reason);
  try{
    if(window.__cmCandidateShadowState){
      const unifiedVisible=cmUnifiedRendererVisible();
      window.__cmCandidateShadowState={...window.__cmCandidateShadowState,unifiedVisible,mode:unifiedVisible?'unified-visible':(window.__cmCandidateShadowState.visible?'candidate-visible':'shadow')};
    }
  }catch(error){console.warn('[Unified Visible] diagnostics publish failed',error)}
};
const cmD8CandidateShadowTeardown=cmCandidateShadowTeardown;
cmCandidateShadowTeardown=function(){
  try{document.body.classList.remove('cm-unified-renderer-visible')}catch(_){}
  return cmD8CandidateShadowTeardown();
};
`;
        src=src.slice(0,coreEnd)+augment+src.slice(coreEnd);
      }
    }

    return src;
  };
})();
