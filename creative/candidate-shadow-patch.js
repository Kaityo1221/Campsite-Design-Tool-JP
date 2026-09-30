(() => {
  'use strict';

  window.applyCreativeCandidateShadowPatch = function (html) {
    if (typeof html !== 'string') return html;

    const engineTags = [
      '<script src="./runtime/map-engine/candidate-records-adapter.js?v=5d1"></script>',
      '<script src="./runtime/map-engine/candidate-records-refresh-store.js?v=5d1"></script>',
      '<script src="./runtime/map-engine/candidate-geometry.js?v=5d1"></script>',
      '<script src="./runtime/map-engine/scene-builder.js?v=5d1"></script>',
      '<script src="./runtime/map-engine/candidate-scene-builder.js?v=5d1"></script>',
      '<script src="./runtime/map-engine/map-renderer.js?v=5d1"></script>'
    ].join('');

    const coreNeedle = "<script>\n(()=>{'use strict';";
    if (!html.includes(coreNeedle)) {
      throw new Error('Candidate Shadow: Creative core script target not found');
    }
    if (!html.includes('candidate-records-adapter.js?v=5d1')) {
      html = html.replace(coreNeedle, engineTags + coreNeedle);
    }

    const helperNeedle = 'function drawAll(){';
    if (!html.includes(helperNeedle)) {
      throw new Error('Candidate Shadow: drawAll hook target not found');
    }

    const helpers = `let cmCandidateShadowStore=null,cmCandidateShadowRenderer=null,cmCandidateShadowUnsubscribe=null,cmCandidateShadowLastSignature=null,cmCandidateShadowRenderCount=0,cmCandidateShadowReady=false,cmCandidateShadowPagehideBound=false;
function cmCandidateShadowSignature(){
  try{
    return JSON.stringify((records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('new-')).map(r=>[String(r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0])));
  }catch(_){return '[]'}
}
function cmCandidateShadowScene(){
  const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];
  const geometry=window.bridgeMapLab_buildCandidateGeometry(candidates);
  return window.bridgeMapLab_buildSceneWithCandidates({pois:[]},{entries:[]},geometry,{circle50Visible:true});
}
function cmCandidateShadowPublish(reason){
  try{
    const counts=cmCandidateShadowStore?.getCounts?.()||null;
    const diagnostics=cmCandidateShadowStore?.getDiagnostics?.()||[];
    const rendered=cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0};
    const sync=cmCandidateShadowRenderer?.getLastSyncStats?.()||null;
    window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,counts,diagnostics,rendered,sync,shadow:true};
  }catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}
}
function cmCandidateShadowRender(reason){
  if(!cmCandidateShadowStore||!cmCandidateShadowRenderer)return;
  try{
    cmCandidateShadowRenderer.render(cmCandidateShadowScene());
    cmCandidateShadowRenderCount+=1;
    cmCandidateShadowPublish(reason||'render');
  }catch(error){
    console.error('[Candidate Shadow] render failed',error);
    cmCandidateShadowPublish('render-error');
  }
}
function cmCandidateShadowTeardown(){
  try{cmCandidateShadowUnsubscribe?.()}catch(_){}
  try{cmCandidateShadowRenderer?.destroy?.()}catch(_){}
  cmCandidateShadowUnsubscribe=null;cmCandidateShadowRenderer=null;cmCandidateShadowStore=null;cmCandidateShadowReady=false;cmCandidateShadowLastSignature=null;
  cmCandidateShadowPublish('teardown');
}
function cmCandidateShadowEnsure(){
  if(cmCandidateShadowReady&&cmCandidateShadowStore&&cmCandidateShadowRenderer)return true;
  const required=['bridgeMapLab_createCandidateRecordsRefreshStore','bridgeMapLab_buildCandidateGeometry','bridgeMapLab_buildSceneWithCandidates','bridgeMapLab_createMapRenderer'];
  const missing=required.filter(name=>typeof window[name]!=='function');
  if(missing.length){console.error('[Candidate Shadow] engine unavailable',missing);return false}
  try{
    cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);
    cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:0});
    cmCandidateShadowUnsubscribe=cmCandidateShadowStore.subscribe(()=>cmCandidateShadowRender('refresh'));
    cmCandidateShadowReady=true;
    cmCandidateShadowLastSignature=cmCandidateShadowSignature();
    cmCandidateShadowRender('initial');
    if(!cmCandidateShadowPagehideBound){window.addEventListener('pagehide',cmCandidateShadowTeardown);cmCandidateShadowPagehideBound=true}
    window.__cmCandidateShadow=Object.freeze({
      getState:()=>window.__cmCandidateShadowState?JSON.parse(JSON.stringify(window.__cmCandidateShadowState)):null,
      refresh:()=>cmCandidateShadowRefresh('manual',true),
      teardown:cmCandidateShadowTeardown
    });
    return true;
  }catch(error){console.error('[Candidate Shadow] init failed',error);cmCandidateShadowTeardown();return false}
}
function cmCandidateShadowRefresh(reason,force=false){
  if(!cmCandidateShadowEnsure())return false;
  const signature=cmCandidateShadowSignature();
  if(!force&&signature===cmCandidateShadowLastSignature){cmCandidateShadowPublish(reason||'unchanged');return false}
  cmCandidateShadowLastSignature=signature;
  try{cmCandidateShadowStore.refresh();cmCandidateShadowPublish(reason||'refresh');return true}catch(error){console.error('[Candidate Shadow] refresh failed',error);cmCandidateShadowPublish('refresh-error');return false}
}
`;

    html = html.replace(helperNeedle, helpers + helperNeedle);

    const jpDrawTail = 'renderRecordCircles();renderJpGuide()}';
    const legacyDrawTail = 'renderRecordCircles()}';
    if (html.includes(jpDrawTail)) {
      html = html.replace(jpDrawTail, "renderRecordCircles();renderJpGuide();cmCandidateShadowRefresh('drawAll')}");
    } else if (html.includes(legacyDrawTail)) {
      html = html.replace(legacyDrawTail, "renderRecordCircles();cmCandidateShadowRefresh('drawAll')}");
    } else {
      throw new Error('Candidate Shadow: drawAll tail target not found');
    }

    const snapshotNeedle = 'function snapshot(){';
    if (!html.includes(snapshotNeedle)) {
      throw new Error('Candidate Shadow: snapshot hook target not found');
    }
    html = html.replace(snapshotNeedle, "function snapshot(){cmCandidateShadowRefresh('snapshot');");

    return html;
  };
})();
