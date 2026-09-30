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

    // Phase 5-D1-D5: Candidate Map Engine follows Creative Mode records in shadow mode.
    // Existing Creative Mode remains the only mutation owner and visual owner.
    if(!src.includes('cmCandidateShadowSignature')){
      const engineTags=[
        '<script src="./runtime/map-engine/candidate-records-adapter.js?v=5d1"></script>',
        '<script src="./runtime/map-engine/candidate-records-refresh-store.js?v=5d1"></script>',
        '<script src="./runtime/map-engine/candidate-geometry.js?v=5d1"></script>',
        '<script src="./runtime/map-engine/scene-builder.js?v=5d1"></script>',
        '<script src="./runtime/map-engine/candidate-scene-builder.js?v=5d1"></script>',
        '<script src="./runtime/map-engine/map-renderer.js?v=5d1"></script>'
      ].join('');
      const coreNeedle="<script>\n(()=>{'use strict';";
      if(src.includes(coreNeedle)&&!src.includes('candidate-records-adapter.js?v=5d1'))src=src.replace(coreNeedle,engineTags+coreNeedle);

      const helperNeedle='function drawAll(){';
      const helper=`let cmCandidateShadowStore=null,cmCandidateShadowRenderer=null,cmCandidateShadowUnsubscribe=null,cmCandidateShadowLastSignature=null,cmCandidateShadowRenderCount=0,cmCandidateShadowReady=false,cmCandidateShadowPagehideBound=false;
function cmCandidateShadowSignature(){
  try{return JSON.stringify((records||[]).filter(r=>r&&typeof r.layer==='string'&&r.layer.startsWith('new-')).map(r=>[String(r.id||''),String(r.layer||''),r.deleted===true,Array.isArray(r.latlng)?Number(r.latlng[0]):null,Array.isArray(r.latlng)?Number(r.latlng[1]):null]).sort((a,b)=>a[0].localeCompare(b[0])))}catch(_){return'[]'}
}
function cmCandidateShadowScene(){const candidates=cmCandidateShadowStore?cmCandidateShadowStore.list():[];const geometry=window.bridgeMapLab_buildCandidateGeometry(candidates);return window.bridgeMapLab_buildSceneWithCandidates({pois:[]},{entries:[]},geometry,{circle50Visible:true})}
function cmCandidateShadowPublish(reason){try{window.__cmCandidateShadowState={ready:cmCandidateShadowReady,reason:reason||'',renderCount:cmCandidateShadowRenderCount,counts:cmCandidateShadowStore?.getCounts?.()||null,diagnostics:cmCandidateShadowStore?.getDiagnostics?.()||[],rendered:cmCandidateShadowRenderer?.getRenderedCounts?.()||{markers:0,circles50:0},sync:cmCandidateShadowRenderer?.getLastSyncStats?.()||null,shadow:true}}catch(error){console.warn('[Candidate Shadow] diagnostics publish failed',error)}}
function cmCandidateShadowRender(reason){if(!cmCandidateShadowStore||!cmCandidateShadowRenderer)return;try{cmCandidateShadowRenderer.render(cmCandidateShadowScene());cmCandidateShadowRenderCount+=1;cmCandidateShadowPublish(reason||'render')}catch(error){console.error('[Candidate Shadow] render failed',error);cmCandidateShadowPublish('render-error')}}
function cmCandidateShadowTeardown(){try{cmCandidateShadowUnsubscribe?.()}catch(_){}try{cmCandidateShadowRenderer?.destroy?.()}catch(_){}cmCandidateShadowUnsubscribe=null;cmCandidateShadowRenderer=null;cmCandidateShadowStore=null;cmCandidateShadowReady=false;cmCandidateShadowLastSignature=null;cmCandidateShadowPublish('teardown')}
function cmCandidateShadowEnsure(){
  if(cmCandidateShadowReady&&cmCandidateShadowStore&&cmCandidateShadowRenderer)return true;
  const required=['bridgeMapLab_createCandidateRecordsRefreshStore','bridgeMapLab_buildCandidateGeometry','bridgeMapLab_buildSceneWithCandidates','bridgeMapLab_createMapRenderer'];const missing=required.filter(name=>typeof window[name]!=='function');
  if(missing.length){console.error('[Candidate Shadow] engine unavailable',missing);return false}
  try{cmCandidateShadowStore=window.bridgeMapLab_createCandidateRecordsRefreshStore(()=>records);cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:0});cmCandidateShadowUnsubscribe=cmCandidateShadowStore.subscribe(()=>cmCandidateShadowRender('refresh'));cmCandidateShadowReady=true;cmCandidateShadowLastSignature=cmCandidateShadowSignature();cmCandidateShadowRender('initial');if(!cmCandidateShadowPagehideBound){window.addEventListener('pagehide',cmCandidateShadowTeardown);cmCandidateShadowPagehideBound=true}window.__cmCandidateShadow=Object.freeze({getState:()=>window.__cmCandidateShadowState?JSON.parse(JSON.stringify(window.__cmCandidateShadowState)):null,refresh:()=>cmCandidateShadowRefresh('manual',true),teardown:cmCandidateShadowTeardown});return true}catch(error){console.error('[Candidate Shadow] init failed',error);cmCandidateShadowTeardown();return false}
}
function cmCandidateShadowRefresh(reason,force=false){if(!cmCandidateShadowEnsure())return false;const signature=cmCandidateShadowSignature();if(!force&&signature===cmCandidateShadowLastSignature){cmCandidateShadowPublish(reason||'unchanged');return false}cmCandidateShadowLastSignature=signature;try{cmCandidateShadowStore.refresh();cmCandidateShadowPublish(reason||'refresh');return true}catch(error){console.error('[Candidate Shadow] refresh failed',error);cmCandidateShadowPublish('refresh-error');return false}}
`;
      if(src.includes(helperNeedle))src=src.replace(helperNeedle,helper+helperNeedle);

      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const wrappers=`\nconst cmCandidateShadowLegacyDrawAll=drawAll;drawAll=function(){const result=cmCandidateShadowLegacyDrawAll();cmCandidateShadowRefresh('drawAll');return result};
const cmCandidateShadowLegacySnapshot=snapshot;snapshot=function(){const result=cmCandidateShadowLegacySnapshot();cmCandidateShadowRefresh('snapshot');return result};
`;
        src=src.slice(0,coreEnd)+wrappers+src.slice(coreEnd);
      }
    }

    return src;
  };
})();
