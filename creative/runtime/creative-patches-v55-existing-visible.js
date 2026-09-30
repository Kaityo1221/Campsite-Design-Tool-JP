(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    if(src.includes('cmExistingRendererVisible'))return src;

    const ownershipStyle=`<style id="cmD8ExistingRendererVisibleStyle">
      .cm-engine-existing-icon{pointer-events:none!important}
      body.cm-existing-renderer-visible .cm-engine-legacy-existing .cm-v45-poi,
      body.cm-existing-renderer-visible .cm-engine-legacy-existing .poi-image-icon,
      body.cm-existing-renderer-visible .cm-engine-legacy-existing .poi-dot{opacity:0!important}
    </style>`;
    if(!src.includes('id="cmD8ExistingRendererVisibleStyle"'))src=src.replace('</head>',ownershipStyle+'</head>');

    src=src.replace(
      "function cmCandidateRendererVisible(){try{return new URLSearchParams(location.search).get('candidateRenderer')==='visible'}catch(_){return false}}",
      "function cmCandidateRendererVisible(){try{return new URLSearchParams(location.search).get('candidateRenderer')==='visible'}catch(_){return false}}\nfunction cmExistingRendererVisible(){try{return new URLSearchParams(location.search).get('existingRenderer')==='visible'}catch(_){return false}}\nfunction cmAnyMapRendererVisible(){return cmCandidateRendererVisible()||cmExistingRendererVisible()}"
    );

    src=src.replace(
`function cmCandidateRendererSyncLegacyMarkers(){
  if(!cmCandidateRendererVisible())return;
  try{document.body.classList.add('cm-candidate-renderer-visible')}catch(_){}
  for(const r of records||[]){if(!r||r.deleted||typeof r.layer!=='string'||!r.layer.startsWith('new-'))continue;try{r.marker?.getElement?.()?.classList?.add('cm-engine-legacy-candidate')}catch(_){}}
}`,
`function cmCandidateRendererSyncLegacyMarkers(){
  const candidateVisible=cmCandidateRendererVisible(),existingVisible=cmExistingRendererVisible();
  try{document.body.classList.toggle('cm-candidate-renderer-visible',candidateVisible);document.body.classList.toggle('cm-existing-renderer-visible',existingVisible)}catch(_){}
  for(const r of records||[]){
    if(!r||r.deleted||typeof r.layer!=='string')continue;
    const el=r.marker?.getElement?.();if(!el)continue;
    try{if(r.layer.startsWith('new-'))el.classList.add('cm-engine-legacy-candidate');else if(r.layer.startsWith('existing-'))el.classList.add('cm-engine-legacy-existing')}catch(_){}
  }
}`
    );

    src=src.replace(
      "if(!r||r.deleted||typeof r.layer!=='string'||r.layer.startsWith('new-'))continue;",
      "if(!r||r.deleted||typeof r.layer!=='string')continue;const cmD8Layer=String(r.layer);if((cmD8Layer.startsWith('new-')&&cmCandidateRendererVisible())||(cmD8Layer.startsWith('existing-')&&cmExistingRendererVisible()))continue;"
    );

    src=src.replace(
`  if(!cmCandidateRendererVisible())return scene;
  return Object.freeze({items:Object.freeze(scene.items.map(item=>item.origin==='existing'?Object.freeze({...item,style:Object.freeze({...item.style,opacity:0,fillOpacity:0})}):item))});`,
`  const candidateVisible=cmCandidateRendererVisible(),existingVisible=cmExistingRendererVisible();
  if(!candidateVisible&&!existingVisible)return scene;
  return Object.freeze({items:Object.freeze(scene.items.map(item=>{
    const visible=item.origin==='candidate'?candidateVisible:item.origin==='existing'?existingVisible:false;
    return visible?item:Object.freeze({...item,style:Object.freeze({...item.style,opacity:0,fillOpacity:0})});
  }))});`
    );

    src=src.replace(
      "const display=cmCandidateShadowDisplayState();return JSON.stringify({existing,candidates,radii:display.radii,candidateTypes:display.candidateTypes,existingTypes:display.existingTypes,visible:cmCandidateRendererVisible()})",
      "const display=cmCandidateShadowDisplayState();return JSON.stringify({existing,candidates,radii:display.radii,candidateTypes:display.candidateTypes,existingTypes:display.existingTypes,candidateVisible:cmCandidateRendererVisible(),existingVisible:cmExistingRendererVisible()})"
    );

    src=src.replace(
"function cmCandidateShadowPublish(reason){try{const visible=cmCandidateRendererVisible();window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,display:cmCandidateShadowDisplayState(),counts:cmCandidateShadowStore?.getCounts?.()||null,existingCounts:cmExistingShadowStore?.getCounts?.()||null,diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],existingDiagnostics:cmExistingShadowStore?.getDiagnostics?.()||[],rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0,circles40:0,circles30:0},sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,shadow:!visible,visible,unified:true}}catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}}",
"function cmCandidateShadowPublish(reason){try{const candidateVisible=cmCandidateRendererVisible(),existingVisible=cmExistingRendererVisible(),visible=candidateVisible||existingVisible;window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,display:cmCandidateShadowDisplayState(),counts:cmCandidateShadowStore?.getCounts?.()||null,existingCounts:cmExistingShadowStore?.getCounts?.()||null,diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],existingDiagnostics:cmExistingShadowStore?.getDiagnostics?.()||[],rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0,circles40:0,circles30:0},sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,shadow:!visible,visible,candidateVisible,existingVisible,unified:true}}catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}}"
    );

    src=src.replace(
      "try{document.body.classList.remove('cm-candidate-renderer-visible')}catch(_){}",
      "try{document.body.classList.remove('cm-candidate-renderer-visible');document.body.classList.remove('cm-existing-renderer-visible')}catch(_){}"
    );

    src=src.replace(
      "try{const visible=cmCandidateRendererVisible();if(visible)document.body.classList.add('cm-candidate-renderer-visible');cmExistingShadowStore=window.bridgeMapLab_createExistingRecordsRefreshStore(()=>records);cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});",
      "try{const candidateVisible=cmCandidateRendererVisible(),existingVisible=cmExistingRendererVisible(),visible=candidateVisible||existingVisible;if(candidateVisible)document.body.classList.add('cm-candidate-renderer-visible');if(existingVisible)document.body.classList.add('cm-existing-renderer-visible');cmExistingShadowStore=window.bridgeMapLab_createExistingRecordsRefreshStore(()=>records);cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});"
    );

    src=src.replace(
      "if(cmCandidateRendererVisible())cmCandidateRendererRenderLegacyCircles();else result=cmCandidateShadowLegacyRenderRecordCircles();",
      "if(cmAnyMapRendererVisible())cmCandidateRendererRenderLegacyCircles();else result=cmCandidateShadowLegacyRenderRecordCircles();"
    );

    return src;
  };
})();
