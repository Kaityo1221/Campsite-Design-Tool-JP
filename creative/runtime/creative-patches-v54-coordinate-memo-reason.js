(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    if(!src.includes('cmV54CoordMemoReason')){
      const old=`const cmV46Near=nearestRecord(r.latlng,r.id);if(cmV46Near&&cmV46Near.distance<50){const reason=document.createElement('label');reason.className='cm-v46-reason';reason.innerHTML='<span>理由</span><textarea class="cm-v46-reason-input" placeholder="この候補地を選んだ理由を入力"></textarea>';const reasonInput=reason.querySelector('textarea');reasonInput.value=String(r.memo||'');reasonInput.oninput=()=>{r.memo=reasonInput.value;snapshot();cmPersistCurrent()};card.appendChild(reason)}root.appendChild(card)});if(!cmActiveNew().length`;

      const replacement=`/* cmV54CoordMemoReason */const cmV54Memo=String(r.memo||'').trim();if(cmV54Memo){const memoLine=document.createElement('div');memoLine.className='cm-v54-memo';memoLine.innerHTML='<strong>メモ</strong><span>'+esc(cmV54Memo)+'</span>';card.appendChild(memoLine)}const cmV46Near=nearestRecord(r.latlng,r.id);if(cmV46Near&&cmV46Near.distance<50){const reason=document.createElement('label');reason.className='cm-v46-reason';reason.innerHTML='<span>理由</span><textarea class="cm-v46-reason-input" placeholder="この候補地を選んだ理由を入力"></textarea>';const reasonInput=reason.querySelector('textarea');reasonInput.value=String(r.applicationComment||'');reasonInput.oninput=()=>{r.applicationComment=reasonInput.value.slice(0,300);try{if(typeof jpIssueSignature==='function'){r.applicationCommentSignature=jpIssueSignature(r);r.applicationCommentNeedsReview=false}}catch{}snapshot();cmPersistCurrent();try{if(typeof renderJpGuide==='function')renderJpGuide()}catch{}};card.appendChild(reason)}root.appendChild(card)});if(!cmActiveNew().length`;

      if(src.includes(old))src=src.replace(old,replacement);

      const style=`<style id="cmV54CoordMemoReasonStyle">
        .cm-v54-memo{display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start;padding:9px 0;border-top:1px solid #f0e6d5;font-size:12px;line-height:1.5}
        .cm-v54-memo strong{color:#6f604c;font-weight:900}
        .cm-v54-memo span{color:#382d1d;font-weight:800;word-break:break-word}
      </style>`;
      if(!src.includes('id="cmV54CoordMemoReasonStyle"'))src=src.replace('</head>',style+'</head>');
    }

    const rendererStyle=`<style id="cmCandidateRendererVisibleStyle">
      .cm-engine-candidate-icon{pointer-events:none!important}
      body.cm-candidate-renderer-visible .cm-engine-legacy-candidate .cm-v45-poi,
      body.cm-candidate-renderer-visible .cm-engine-legacy-candidate .poi-image-icon,
      body.cm-candidate-renderer-visible .cm-engine-legacy-candidate .poi-dot{opacity:0!important}
    </style>`;
    if(!src.includes('id="cmCandidateRendererVisibleStyle"'))src=src.replace('</head>',rendererStyle+'</head>');

    // Phase 5-D: Map Engine follows Creative Mode records.
    // Existing POI and Candidate share one Unified Scene. Existing stays shadow-only until its own cutover gate.
    // ?candidateRenderer=visible enables development-only Candidate visual cutover.
    if(!src.includes('cmCandidateShadowSignature')){
      const engineTags=[
        '<script src="./runtime/map-engine/existing-records-adapter.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/existing-records-refresh-store.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/existing-geometry.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/candidate-records-adapter.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/candidate-records-refresh-store.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/candidate-geometry.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/scene-builder.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/candidate-scene-builder.js?v=5d4"></script>',
        '<script src="./runtime/map-engine/map-renderer.js?v=5d4"></script>'
      ].join('');
      const coreNeedle="<script>\n(()=>{'use strict';";
      if(src.includes(coreNeedle)&&!src.includes('existing-records-adapter.js?v=5d4'))src=src.replace(coreNeedle,engineTags+coreNeedle);

      const helperNeedle='function drawAll(){';
      const helper=`let cmExistingShadowStore=null,cmCandidateShadowStore=null,cmCandidateShadowRenderer=null,cmCandidateShadowUnsubscribe=null,cmCandidateShadowLastSignature=null,cmCandidateShadowRenderCount=0,cmCandidateShadowReady=false,cmCandidateShadowPagehideBound=false,cmCandidateShadowPageshowBound=false;
function cmCandidateRendererVisible(){try{return new URLSearchParams(location.search).get('candidateRenderer')==='visible'}catch(_){return false}}
function cmCandidateShadowDisplayState(){
  const radii=[50,40,30].filter(radius=>{try{if(typeof cmCircleLayerEnabled==='function')return !!cmCircleLayerEnabled(radius)}catch(_){}if(radius===50)return true;try{return Array.isArray(circleExtras)&&circleExtras.includes(radius)}catch(_){return false}});
  const candidateTypes={};['new-pokestop','new-gym','new-power'].forEach(type=>{try{candidateTypes[type]=!!(groups?.[type]&&map.hasLayer(groups[type]))}catch(_){candidateTypes[type]=true}});
  const existingTypes={};['existing-pokestop','existing-gym','existing-power'].forEach(type=>{try{existingTypes[type]=!!(groups?.[type]&&map.hasLayer(groups[type]))}catch(_){existingTypes[type]=true}});
  return{radii,types:candidateTypes,candidateTypes,existingTypes};
}
function cmCandidateRendererSyncLegacyMarkers(){
  if(!cmCandidateRendererVisible())return;
  try{document.body.classList.add('cm-candidate-renderer-visible')}catch(_){}
  for(const r of records||[]){if(!r||r.deleted||typeof r.layer!=='string'||!r.layer.startsWith('new-'))continue;try{r.marker?.getElement?.()?.classList?.add('cm-engine-legacy-candidate')}catch(_){}}
}
function cmCandidateRendererRenderLegacyCircles(){
  recordCircleGroup.clearLayers();
  if(!map.hasLayer(recordCircleGroup))recordCircleGroup.addTo(map);
  for(const r of records||[]){
    if(!r||r.deleted||typeof r.layer!=='string'||r.layer.startsWith('new-'))continue;
    try{if(typeof cmIsCircleDummyRecord==='function'&&cmIsCircleDummyRecord(r))continue}catch(_){}
    try{if(!groups?.[r.layer]||!map.hasLayer(groups[r.layer]))continue}catch(_){continue}
    [50,40,30].forEach(radius=>{let visible=radius===50;try{if(typeof cmCircleLayerEnabled==='function')visible=!!cmCircleLayerEnabled(radius);else if(radius!==50)visible=Array.isArray(circleExtras)&&circleExtras.includes(radius)}catch(_){}if(visible)L.circle(r.latlng,circleOpts(radius)).addTo(recordCircleGroup)});
  }
}
function cmCandidateShadowSignature(){
  try{
    const existing=(records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('existing-')).map(r=>[String(r.guid||r.id||''),String(r.layer||''),String(r.gameStatus||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0]));
    const candidates=(records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('new-')).map(r=>[String(r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0]));
    const display=cmCandidateShadowDisplayState();return JSON.stringify({existing,candidates,radii:display.radii,candidateTypes:display.candidateTypes,existingTypes:display.existingTypes,visible:cmCandidateRendererVisible()})
  }catch(_){return'{}'}
}
function cmCandidateShadowScene(){
  const existingPois=cmExistingShadowStore?cmExistingShadowStore.list():[];
  const existingGeometry=window.bridgeMapLab_buildExistingGeometry(existingPois);
  const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];
  const candidateGeometry=window.bridgeMapLab_buildCandidateGeometry(candidates);
  const display=cmCandidateShadowDisplayState();
  const scene=window.bridgeMapLab_buildSceneWithCandidates({pois:existingPois},existingGeometry,candidateGeometry,{circleRadiiVisible:display.radii,candidateTypesVisible:display.candidateTypes,existingTypesVisible:display.existingTypes});
  if(!cmCandidateRendererVisible())return scene;
  return Object.freeze({items:Object.freeze(scene.items.map(item=>item.origin==='existing'?Object.freeze({...item,style:Object.freeze({...item.style,opacity:0,fillOpacity:0})}):item))});
}
function cmCandidateShadowPublish(reason){try{const visible=cmCandidateRendererVisible();window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,display:cmCandidateShadowDisplayState(),counts:cmCandidateShadowStore?.getCounts?.()||null,existingCounts:cmExistingShadowStore?.getCounts?.()||null,diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],existingDiagnostics:cmExistingShadowStore?.getDiagnostics?.()||[],rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0,circles40:0,circles30:0},sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,shadow:!visible,visible,unified:true}}catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}}
function cmCandidateShadowRender(reason){if(!cmCandidateShadowStore||!cmExistingShadowStore||!cmCandidateShadowRenderer)return;try{cmCandidateShadowRenderer.render(cmCandidateShadowScene());cmCandidateRendererSyncLegacyMarkers();cmCandidateShadowRenderCount+=1;cmCandidateShadowPublish(reason||'render')}catch(error){console.error('[Candidate Shadow] render failed',error);cmCandidateShadowPublish('render-error')}}
function cmCandidateShadowTeardown(){try{cmCandidateShadowUnsubscribe?.()}catch(_){}try{cmCandidateShadowRenderer?.destroy?.()}catch(_){}try{document.body.classList.remove('cm-candidate-renderer-visible')}catch(_){}cmCandidateShadowUnsubscribe=null;cmCandidateShadowRenderer=null;cmCandidateShadowStore=null;cmExistingShadowStore=null;cmCandidateShadowReady=false;cmCandidateShadowLastSignature=null;cmCandidateShadowPublish('teardown')}
function cmCandidateShadowEnsure(){
  if(cmCandidateShadowReady&&cmCandidateShadowStore&&cmExistingShadowStore&&cmCandidateShadowRenderer)return true;
  const required=['bridgeMapLab_createExistingRecordsRefreshStore','bridgeMapLab_buildExistingGeometry','bridgeMapLab_createCandidateRecordsRefreshStore','bridgeMapLab_buildCandidateGeometry','bridgeMapLab_buildSceneWithCandidates','bridgeMapLab_createMapRenderer'];const missing=required.filter(name=>typeof window[name]!=='function');
  if(missing.length){console.error('[Candidate Shadow] engine unavailable',missing);return false}
  try{const visible=cmCandidateRendererVisible();if(visible)document.body.classList.add('cm-candidate-renderer-visible');cmExistingShadowStore=window.bridgeMapLab_createExistingRecordsRefreshStore(()=>records);cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});cmCandidateShadowUnsubscribe=cmCandidateShadowStore.subscribe(()=>cmCandidateShadowRender('refresh'));cmCandidateShadowReady=true;cmCandidateShadowLastSignature=cmCandidateShadowSignature();cmCandidateShadowRender('initial');if(!cmCandidateShadowPagehideBound){window.addEventListener('pagehide',cmCandidateShadowTeardown);cmCandidateShadowPagehideBound=true}if(!cmCandidateShadowPageshowBound){window.addEventListener('pageshow',event=>{if(event?.persisted)cmCandidateShadowRefresh('pageshow',true)});cmCandidateShadowPageshowBound=true}window.__cmCandidateShadow=Object.freeze({getState:()=>window.__cmCandidateShadowState?JSON.parse(JSON.stringify(window.__cmCandidateShadowState)):null,refresh:()=>cmCandidateShadowRefresh('manual',true),teardown:cmCandidateShadowTeardown});return true}catch(error){console.error('[Candidate Shadow] init failed',error);cmCandidateShadowTeardown();return false}
}
function cmCandidateShadowRefresh(reason,force=false){if(!cmCandidateShadowEnsure())return false;const signature=cmCandidateShadowSignature();if(!force&&signature===cmCandidateShadowLastSignature){cmCandidateRendererSyncLegacyMarkers();cmCandidateShadowPublish(reason||'unchanged');return false}cmCandidateShadowLastSignature=signature;try{cmExistingShadowStore.refresh();cmCandidateShadowStore.refresh();cmCandidateShadowPublish(reason||'refresh');return true}catch(error){console.error('[Candidate Shadow] refresh failed',error);cmCandidateShadowPublish('refresh-error');return false}}
`;
      if(src.includes(helperNeedle))src=src.replace(helperNeedle,helper+helperNeedle);

      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const wrappers=`\nconst cmCandidateShadowLegacyRenderRecordCircles=renderRecordCircles;renderRecordCircles=function(){let result;if(cmCandidateRendererVisible())cmCandidateRendererRenderLegacyCircles();else result=cmCandidateShadowLegacyRenderRecordCircles();cmCandidateShadowRefresh('circles');return result};
const cmCandidateShadowLegacyDrawAll=drawAll;drawAll=function(){const result=cmCandidateShadowLegacyDrawAll();cmCandidateShadowRefresh('drawAll');return result};
const cmCandidateShadowLegacySnapshot=snapshot;snapshot=function(){const result=cmCandidateShadowLegacySnapshot();cmCandidateShadowRefresh('snapshot');return result};
`;
        src=src.slice(0,coreEnd)+wrappers+src.slice(coreEnd);
      }
    }

    return src;
  };
})();
