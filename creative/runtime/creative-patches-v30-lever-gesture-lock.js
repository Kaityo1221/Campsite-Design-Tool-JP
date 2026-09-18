(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // CREATIVE MODE v30: while the radius lever is being dragged,
    // keep Safari/page scrolling and Leaflet map gestures completely still.
    const bindStart=src.indexOf('function cmBindRadiusHandle(){');
    const installStart=bindStart>=0?src.indexOf('function cmInstallUi(){',bindStart):-1;
    if(bindStart>=0&&installStart>=0){
      const replacement=`function cmBindRadiusHandle(){
  const handle=document.getElementById('cmRadiusHandle');
  if(!handle)return;
  cmSetLeverVisual(cmGuideRadius);
  if(handle.dataset.radiusHandleReady==='30')return;
  handle.dataset.radiusHandleReady='30';
  handle.style.touchAction='none';
  handle.style.userSelect='none';
  handle.style.webkitUserSelect='none';

  let drag=null;
  let lastStep=null;
  let pageLock=null;
  let mapLock=null;

  const block=(e,ms=900)=>{
    if(e&&e.cancelable)e.preventDefault();
    if(e)e.stopPropagation();
    cmBlockPlacementForRadius(ms);
  };

  const lockSurface=()=>{
    if(pageLock)return;
    const de=document.documentElement,b=document.body;
    pageLock={
      deOverflow:de.style.overflow,
      deOverscroll:de.style.overscrollBehavior,
      bOverflow:b.style.overflow,
      bOverscroll:b.style.overscrollBehavior,
      bTouchAction:b.style.touchAction
    };
    de.style.overflow='hidden';
    de.style.overscrollBehavior='none';
    b.style.overflow='hidden';
    b.style.overscrollBehavior='none';
    b.style.touchAction='none';

    mapLock={
      dragging:!!map.dragging?.enabled?.(),
      touchZoom:!!map.touchZoom?.enabled?.(),
      doubleClickZoom:!!map.doubleClickZoom?.enabled?.()
    };
    try{map.dragging?.disable?.()}catch{}
    try{map.touchZoom?.disable?.()}catch{}
    try{map.doubleClickZoom?.disable?.()}catch{}
  };

  const unlockSurface=()=>{
    if(pageLock){
      const de=document.documentElement,b=document.body;
      de.style.overflow=pageLock.deOverflow;
      de.style.overscrollBehavior=pageLock.deOverscroll;
      b.style.overflow=pageLock.bOverflow;
      b.style.overscrollBehavior=pageLock.bOverscroll;
      b.style.touchAction=pageLock.bTouchAction;
      pageLock=null;
    }
    if(mapLock){
      try{if(mapLock.dragging)map.dragging?.enable?.()}catch{}
      try{if(mapLock.touchZoom)map.touchZoom?.enable?.()}catch{}
      try{if(mapLock.doubleClickZoom)map.doubleClickZoom?.enable?.()}catch{}
      mapLock=null;
    }
  };

  const begin=(id,y,e)=>{
    if(!cmAddMode)return false;
    block(e,1400);
    lockSurface();
    drag={id,startY:y,startRadius:cmGuideRadius,current:cmGuideRadius};
    lastStep=Math.round(cmGuideRadius/10)*10;
    handle.classList.add('dragging');
    cmSetLeverVisual(cmGuideRadius);
    return true;
  };

  const move=(y,e)=>{
    if(!drag)return;
    block(e,1100);
    const dy=y-drag.startY;
    const next=Math.max(30,Math.min(50,drag.startRadius-dy*.24));
    drag.current=next;
    cmApplyGuideRadiusLive(next);
    cmSetLeverVisual(next);
    const step=Math.round(next/10)*10;
    if(step!==lastStep){
      lastStep=step;
      try{navigator.vibrate?.(5)}catch{}
    }
  };

  const finish=e=>{
    if(!drag){unlockSurface();return}
    block(e,900);
    const snap=Math.max(30,Math.min(50,Math.round(drag.current/10)*10));
    drag=null;
    handle.classList.remove('dragging');
    cmSetGuideRadius(snap);
    cmSetLeverVisual(snap);
    const range=cmRadiusGauge?.querySelector('#cmRadiusRange');
    if(range)range.step='10';
    unlockSurface();
  };

  // iPhone/iPad: use non-passive touch listeners so Safari cannot move the page.
  const findTouch=(list,id)=>Array.from(list||[]).find(t=>t.identifier===id);
  handle.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||drag)return;
    const t=e.touches[0];
    begin(t.identifier,t.clientY,e);
  },{passive:false});
  handle.addEventListener('touchmove',e=>{
    if(!drag)return;
    const t=findTouch(e.touches,drag.id);
    if(t)move(t.clientY,e);else block(e);
  },{passive:false});
  handle.addEventListener('touchend',e=>{
    if(!drag)return;
    const t=findTouch(e.changedTouches,drag.id);
    if(t)finish(e);else block(e);
  },{passive:false});
  handle.addEventListener('touchcancel',e=>finish(e),{passive:false});

  // Mouse/pen fallback. Touch is handled above to avoid duplicate Safari pointer gestures.
  handle.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch'||drag)return;
    if(!begin(e.pointerId,e.clientY,e))return;
    try{handle.setPointerCapture(e.pointerId)}catch{}
  });
  handle.addEventListener('pointermove',e=>{
    if(e.pointerType==='touch'||!drag||drag.id!==e.pointerId)return;
    move(e.clientY,e);
  });
  handle.addEventListener('pointerup',e=>{
    if(e.pointerType==='touch'||!drag||drag.id!==e.pointerId)return;
    finish(e);
    try{handle.releasePointerCapture(e.pointerId)}catch{}
  });
  handle.addEventListener('pointercancel',e=>{
    if(e.pointerType==='touch')return;
    finish(e);
  });
  handle.addEventListener('click',e=>block(e,700),true);
}
`;
      src=src.slice(0,bindStart)+replacement+src.slice(installStart);
    }

    const style=`<style id="cmV30GestureLockStyle">
      html,body{overscroll-behavior:none}
      #cmRadiusHandle{-webkit-touch-callout:none!important;-webkit-user-select:none!important;user-select:none!important;touch-action:none!important}
      #cmRadiusHandle *{pointer-events:none!important}
      .cm-bubble{display:flex!important;align-items:center!important;justify-content:center!important;padding:0!important;line-height:0!important}
      .cm-bubble img{display:block!important;margin:0!important;flex:none!important}
    </style>`;
    if(!src.includes('id="cmV30GestureLockStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
