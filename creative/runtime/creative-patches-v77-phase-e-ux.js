(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Phase E selection belongs to the Unified Renderer that owns the visible POI markers.
    src=src.split('runtime/map-engine/map-renderer.js?v=5d15').join('runtime/map-engine/map-renderer.js?v=5d16');

    if(!src.includes('cmV77UnifiedSelectionRuntime')){
      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const augment=`
/* cmV77UnifiedSelectionRuntime */
function cmV77RecordOwnerKey(r){
  if(!r||r.deleted)return'';
  const layer=String(r.layer||'');
  if(layer.startsWith('new-'))return 'candidate:'+String(r.id||'');
  if(layer.startsWith('existing-'))return 'poi:'+String(r.guid||r.id||'');
  return'';
}
function cmV77SelectRecord(r){
  const ownerKey=cmV77RecordOwnerKey(r);
  try{cmCandidateShadowRenderer?.setSelectedOwnerKey?.(ownerKey)}catch(error){console.warn('[Phase E Selection] select failed',error)}
}
function cmV77ClearRecordSelection(){
  try{cmCandidateShadowRenderer?.clearSelection?.()}catch(error){console.warn('[Phase E Selection] clear failed',error)}
}
if(typeof cmOpenRecord==='function'){
  const cmV77BaseOpenRecord=cmOpenRecord;
  cmOpenRecord=function(r){
    const result=cmV77BaseOpenRecord(r);
    cmV77SelectRecord(r);
    return result;
  };
}
if(typeof cmCloseSheet==='function'){
  const cmV77BaseCloseSheet=cmCloseSheet;
  cmCloseSheet=function(){
    const result=cmV77BaseCloseSheet();
    cmV77ClearRecordSelection();
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
