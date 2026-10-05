(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Phase E selection belongs to the Unified Renderer that owns the visible POI markers.
    src=src.split('runtime/map-engine/map-renderer.js?v=5d8').join('runtime/map-engine/map-renderer.js?v=5d16');

    // Final Phase E selection path: highlight the exact Leaflet marker that fired
    // the activation event. This avoids owner-key lookup and renderer DOM resync.
    src=src.replace(
      "try{if(typeof cmOpenRecord==='function')cmOpenRecord(record);else if(typeof recordPopup==='function')recordPopup(record)}catch(error){console.error('[Unified Interaction] open record failed',error)}",
      "try{if(typeof cmOpenRecord==='function')cmOpenRecord(record);else if(typeof recordPopup==='function')recordPopup(record);document.querySelectorAll('.cm-engine-selected').forEach(el=>el.classList.remove('cm-engine-selected'));event?.target?.getElement?.()?.classList?.add('cm-engine-selected')}catch(error){console.error('[Unified Interaction] open/select record failed',error)}"
    );

    if(!src.includes('cmV77CloseSelectionRuntime')){
      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const augment=`
/* cmV77CloseSelectionRuntime */
if(typeof cmCloseSheet==='function'){
  const cmV77BaseCloseSheet=cmCloseSheet;
  cmCloseSheet=function(){
    const result=cmV77BaseCloseSheet();
    try{document.querySelectorAll('.cm-engine-selected').forEach(el=>el.classList.remove('cm-engine-selected'));cmCandidateShadowRenderer?.clearSelection?.()}catch(error){console.warn('[Phase E Selection] clear failed',error)}
    return result;
  };
}
`;
        src=src.slice(0,coreEnd)+augment+src.slice(coreEnd);
      }
    }

    const layerMarker='function renderLayerPanel(){';
    if(src.includes(layerMarker)&&!src.includes('function cmV77SyncActivityHint(')){
      const helper=`function cmV77SyncActivityHint(){
  const missing=!polygons.some(p=>p&&!p.deleted);
  document.body.classList.toggle('cm-v77-activity-missing',missing);
  const layerButton=document.getElementById('layerButton');
  if(layerButton)layerButton.classList.toggle('cm-v77-layer-hint',missing);
  const activityButton=[...document.querySelectorAll('#layerPanel button')].find(b=>String(b.textContent||'').includes('活動範囲'));
  if(activityButton)activityButton.classList.toggle('cm-v77-activity-hint',missing);
}
`;
      src=src.replace(layerMarker,helper+layerMarker);
      src=src.replace('}renderLayerPanel();','cmV77SyncActivityHint();}renderLayerPanel();');
    }

    if(!src.includes('cm-v77-activity-rule')){
      const rulesSelectorScript=`<script id="cmV77ActivityRuleInstall">
setTimeout(()=>{
  try{
    const list=document.querySelector('#cmV60RulesPanel .cm-v60-card[data-card="2"] .cm-v60-rules');
    if(list&&!list.querySelector('.cm-v77-activity-rule')){
      const item=document.createElement('li');
      item.className='cm-v77-activity-rule';
      item.innerHTML='<b>最初に「レイヤー → 活動範囲」から活動範囲を作成する</b>';
      list.prepend(item);
    }
  }catch(error){console.warn('[Phase E UX] activity rule install failed',error)}
},0);
</script>`;
      src=src.replace('</body>',rulesSelectorScript+'</body>');
    }

    const style=`<style id="cmV77PhaseEUxStyle">
      .cm-engine-existing-icon.cm-engine-selected,
      .cm-engine-candidate-icon.cm-engine-selected{
        box-shadow:0 0 0 5px #f0b429,0 0 0 9px rgba(240,180,41,.30)!important;
        border-radius:999px!important;
        z-index:1;
      }
      @keyframes cmV77GuidePulse{0%,100%{box-shadow:0 0 0 0 rgba(240,180,41,.15)}50%{box-shadow:0 0 0 6px rgba(240,180,41,.38)}}
      body.cm-v77-activity-missing .cm-v77-layer-hint,
      body.cm-v77-activity-missing .cm-v77-activity-hint{animation:cmV77GuidePulse 1.6s ease-in-out infinite!important;border-color:#d79a18!important}
      @media(prefers-reduced-motion:reduce){
        body.cm-v77-activity-missing .cm-v77-layer-hint,
        body.cm-v77-activity-missing .cm-v77-activity-hint{animation:none!important;box-shadow:0 0 0 4px rgba(240,180,41,.30)!important}
      }
    </style>`;
    if(!src.includes('id="cmV77PhaseEUxStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
