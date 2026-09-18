(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Large vertical lever that can protrude outside the thin radius bar.
    const style=`<style id="cmV28LeverStyle">
      .cm-radius-gauge{overflow:visible!important;padding-left:40px!important}
      .cm-radius-gauge-head.cm-radius-gauge-compact{
        position:relative!important;
        grid-template-columns:40px 62px 16px!important;
        gap:4px!important;
      }
      .cm-radius-hint{
        position:absolute!important;
        left:-58px!important;
        top:50%!important;
        width:52px!important;
        height:64px!important;
        transform:translateY(-50%)!important;
        border:0!important;
        border-radius:18px!important;
        background:transparent!important;
        box-shadow:none!important;
        opacity:1!important;
        display:block!important;
        padding:0!important;
        overflow:visible!important;
        touch-action:none!important;
        cursor:ns-resize!important;
        z-index:4!important;
      }
      .cm-radius-hint::before{
        content:'';
        position:absolute;
        left:50%;
        top:50%;
        width:6px;
        height:46px;
        transform:translate(-50%,-50%);
        border-radius:999px;
        background:rgba(93,81,65,.16);
        box-shadow:inset 0 0 0 1px rgba(93,81,65,.08),0 1px 3px rgba(255,255,255,.36);
        pointer-events:none;
      }
      .cm-radius-hint>span{
        position:absolute!important;
        left:50%!important;
        top:50%!important;
        width:30px!important;
        height:30px!important;
        margin:-15px 0 0 -15px!important;
        border-radius:50%!important;
        background:rgba(255,253,247,.96)!important;
        border:2px solid rgba(138,107,49,.25)!important;
        box-shadow:0 3px 8px rgba(0,0,0,.18),inset 0 0 0 5px rgba(216,183,102,.12)!important;
        transform:translateY(var(--cm-lever-y,-12px))!important;
        transition:transform .12s cubic-bezier(.2,.8,.25,1),box-shadow .12s ease,background .12s ease!important;
        pointer-events:none!important;
      }
      .cm-radius-hint.dragging{
        transform:translateY(-50%)!important;
        background:transparent!important;
      }
      .cm-radius-hint.dragging>span{
        transition:none!important;
        background:#fffdf7!important;
        box-shadow:0 4px 12px rgba(0,0,0,.24),0 0 0 4px rgba(216,183,102,.16)!important;
      }
    </style>`;
    if(!src.includes('id="cmV28LeverStyle"'))src=src.replace('</head>',style+'</head>');

    const bindStart=src.indexOf('function cmBindRadiusHandle(){');
    const installStart=bindStart>=0?src.indexOf('function cmInstallUi(){',bindStart):-1;
    if(bindStart>=0&&installStart>=0){
      const replacement=`function cmLeverOffset(radius){
  const r=Math.max(30,Math.min(50,Number(radius)||50));
  return ((50-r)/20)*24-12;
}
function cmSetLeverVisual(radius){
  const handle=document.getElementById('cmRadiusHandle');
  if(handle)handle.style.setProperty('--cm-lever-y',cmLeverOffset(radius)+'px');
}
function cmBindRadiusHandle(){
  const handle=document.getElementById('cmRadiusHandle');
  if(!handle)return;
  cmSetLeverVisual(cmGuideRadius);
  if(handle.dataset.radiusHandleReady==='2')return;
  handle.dataset.radiusHandleReady='2';
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
    cmSetLeverVisual(cmGuideRadius);
    try{handle.setPointerCapture(e.pointerId)}catch{}
  });
  handle.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    swallow(e,900);
    const dy=e.clientY-drag.startY;
    const next=Math.max(30,Math.min(50,drag.startRadius-dy*.24));
    drag.current=next;
    cmApplyGuideRadiusLive(next);
    cmSetLeverVisual(next);
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
    cmSetLeverVisual(snap);
    const range=cmRadiusGauge?.querySelector('#cmRadiusRange');
    if(range)range.step='10';
    try{handle.releasePointerCapture(e.pointerId)}catch{}
  };
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('click',e=>swallow(e,650),true);
}
`;
      src=src.slice(0,bindStart)+replacement+src.slice(installStart);
    }

    // Keep the lever position in sync when radius changes programmatically.
    const setRadiusNeedle="if(cmCenterGuideCircle)cmCenterGuideCircle.setRadius(cmGuideRadius);\n  if(cmPreview?.circle)cmPreview.circle.setRadius(cmGuideRadius);";
    if(src.includes(setRadiusNeedle)){
      src=src.replace(setRadiusNeedle,setRadiusNeedle+"\n  if(typeof cmSetLeverVisual==='function')cmSetLeverVisual(cmGuideRadius);");
    }

    return src;
  };
})();
