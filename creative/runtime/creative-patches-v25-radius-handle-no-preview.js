(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Make the visible ↕ control the only radius swipe target.
    src=src.replace(
      '<span class="cm-radius-hint">↕</span>',
      '<button id="cmRadiusHandle" class="cm-radius-hint" type="button" aria-label="上下にスライドして距離円を変更" title="上下にスライドして距離円を変更">↕</button>'
    );

    // Disable the old gesture target on the tiny selected-type icon.
    const swipeStart=src.indexOf('function cmEnableRadiusSwipe(){');
    const uiStart=swipeStart>=0?src.indexOf('function cmInstallUi(){',swipeStart):-1;
    if(swipeStart>=0&&uiStart>=0){
      src=src.slice(0,swipeStart)+`function cmEnableRadiusSwipe(){
  const state=document.getElementById('cmSelectedType');
  if(state){state.style.pointerEvents='none';state.style.touchAction='auto';state.style.cursor='default'}
}
`+src.slice(uiStart);
    }

    const uiMarker='function cmInstallUi(){';
    if(src.includes(uiMarker)){
      const helper=`
function cmBindRadiusHandle(){
  const handle=document.getElementById('cmRadiusHandle');
  if(!handle||handle.dataset.radiusHandleReady==='1')return;
  handle.dataset.radiusHandleReady='1';
  handle.style.touchAction='none';
  handle.style.userSelect='none';
  handle.style.webkitUserSelect='none';
  let drag=null,lastStep=null;
  const swallow=(e,ms=700)=>{
    e.preventDefault();
    e.stopPropagation();
    cmBlockPlacementForRadius(ms);
  };
  handle.addEventListener('pointerdown',e=>{
    if(!cmAddMode)return;
    swallow(e,1200);
    drag={id:e.pointerId,startY:e.clientY,startRadius:cmGuideRadius,current:cmGuideRadius};
    lastStep=Math.round(cmGuideRadius/10)*10;
    handle.classList.add('dragging');
    try{handle.setPointerCapture(e.pointerId)}catch{}
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    swallow(e,900);
    const dy=e.clientY-drag.startY;
    const next=Math.max(30,Math.min(50,drag.startRadius-dy*.24));
    drag.current=next;
    cmApplyGuideRadiusLive(next);
    const step=Math.round(next/10)*10;
    if(step!==lastStep){
      lastStep=step;
      try{navigator.vibrate?.(5)}catch{}
    }
  });
  const finish=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    swallow(e,800);
    const snap=Math.max(30,Math.min(50,Math.round(drag.current/10)*10));
    drag=null;
    handle.classList.remove('dragging');
    cmSetGuideRadius(snap);
    const range=cmRadiusGauge?.querySelector('#cmRadiusRange');
    if(range)range.step='10';
    try{handle.releasePointerCapture(e.pointerId)}catch{}
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('click',e=>swallow(e,650),true);
}
`;
      src=src.replace(uiMarker,helper+uiMarker);
    }

    // Bind the ↕ handle whenever the add-mode radius panel is shown.
    const showGauge="function cmShowRadiusGauge(){\n  const g=cmInstallRadiusGauge();g.style.display='block';cmSetGuideRadius(cmGuideRadius);cmEnsureCenterGuideCircle();\n}";
    const showGaugeFixed="function cmShowRadiusGauge(){\n  const g=cmInstallRadiusGauge();g.style.display='block';cmSetGuideRadius(cmGuideRadius);cmEnsureCenterGuideCircle();cmBindRadiusHandle();\n}";
    if(src.includes(showGauge))src=src.replace(showGauge,showGaugeFixed);

    // In add mode, touching the map must never create a second preview icon/circle.
    // The only guide circle is the persistent center circle; placement happens only via 確定.
    const previewStart=src.indexOf('function cmPreviewAt(latlng){');
    const animateStart=previewStart>=0?src.indexOf('function cmAnimateMarker(',previewStart):-1;
    if(previewStart>=0&&animateStart>=0){
      src=src.slice(0,previewStart)+`function cmPreviewAt(){return}\n`+src.slice(animateStart);
    }

    // Style ↕ as a small draggable handle rather than decorative text.
    src=src.replace(
      '.cm-radius-hint{font-size:15px;opacity:.58}',
      '.cm-radius-hint{width:30px;height:30px;border:0;border-radius:9px;background:rgba(255,255,255,.34);color:#5d5141;font-size:18px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center;opacity:.72;touch-action:none;cursor:ns-resize;transition:transform .12s ease,background .12s ease}.cm-radius-hint.dragging{transform:scale(1.1);background:rgba(255,255,255,.56);opacity:1}'
    );

    return src;
  };
})();
