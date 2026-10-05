(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

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
