(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const openMarker=src.includes('function cmOpenRecord(r){if(cmMoveSession)return;')?'function cmOpenRecord(r){if(cmMoveSession)return;':'function cmOpenRecord(r){';
    if(src.includes(openMarker)&&!src.includes('function cmV77HighlightRecord(')){
      const helper=`let cmV77SelectionRing=null;
function cmV77ClearRecordHighlight(){
  try{if(cmV77SelectionRing){map.removeLayer(cmV77SelectionRing);cmV77SelectionRing=null}}catch(_){}
}
function cmV77HighlightRecord(r){
  cmV77ClearRecordHighlight();
  if(!r||r.deleted||!Array.isArray(r.latlng))return;
  try{
    cmV77SelectionRing=L.circleMarker(r.latlng,{radius:28,color:'#f0b429',weight:6,opacity:.98,fill:false,interactive:false,pane:'markerPane'}).addTo(map);
  }catch(_){}
}
`;
      src=src.replace(openMarker,helper+openMarker+'cmV77HighlightRecord(r);');
    }
    src=src.replace('function cmCloseSheet(){','function cmCloseSheet(){cmV77ClearRecordHighlight();');

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

    const rulesRuntime=`<script id="cmV77RulesGuideRuntime">
(()=>{
  const install=()=>{
    const list=document.querySelector('#cmV60RulesPanel .cm-v60-card[data-card="2"] .cm-v60-rules');
    if(!list||list.querySelector('.cm-v77-activity-rule'))return;
    const li=document.createElement('li');
    li.className='cm-v77-activity-rule';
    li.innerHTML='<b>最初に「レイヤー → 活動範囲」から活動範囲を作成する</b>';
    list.prepend(li);
  };
  install();
  document.getElementById('cmV59HelpButton')?.addEventListener('click',install);
})();
</script>`;
    if(!src.includes('id="cmV77RulesGuideRuntime"'))src=src.replace('</body>',rulesRuntime+'</body>');

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
