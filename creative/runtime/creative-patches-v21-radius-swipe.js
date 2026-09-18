(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const uiMarker='function cmInstallUi(){';
    if(!src.includes(uiMarker))return src;

    const helper=`
let cmRadiusGestureUntil=0;
function cmBlockPlacementForRadius(ms=500){
  cmRadiusGestureUntil=Math.max(cmRadiusGestureUntil,Date.now()+ms);
}
function cmApplyGuideRadiusLive(v){
  const radius=Math.max(30,Math.min(50,Number(v)||50));
  cmGuideRadius=radius;
  const g=cmInstallRadiusGauge();
  const range=g.querySelector('#cmRadiusRange');
  const value=g.querySelector('#cmRadiusValue');
  if(range){range.step='1';range.value=String(radius)}
  if(value)value.textContent=Math.round(radius)+'m';
  if(cmCenterGuideCircle)cmCenterGuideCircle.setRadius(radius);
  if(cmPreview?.circle)cmPreview.circle.setRadius(radius);
}
function cmEnableRadiusSwipe(){
  const state=document.getElementById('cmSelectedType');
  if(!state||state.dataset.radiusSwipeReady==='1')return;
  state.dataset.radiusSwipeReady='1';
  state.style.pointerEvents='auto';
  state.style.touchAction='none';
  state.style.cursor='ns-resize';
  state.title='上下にスライドして距離円を変更';
  state.setAttribute('aria-label','上下にスライドして距離円を変更');
  let drag=null,lastStep=null;
  const swallow=e=>{e.preventDefault();e.stopPropagation();cmBlockPlacementForRadius(550)};
  state.addEventListener('pointerdown',e=>{
    if(!cmAddMode)return;
    swallow(e);
    cmBlockPlacementForRadius(1200);
    drag={id:e.pointerId,startY:e.clientY,startRadius:cmGuideRadius,current:cmGuideRadius};
    lastStep=Math.round(cmGuideRadius/10)*10;
    state.style.transform='scale(1.12)';
    try{state.setPointerCapture(e.pointerId)}catch{}
  });
  state.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    swallow(e);
    cmBlockPlacementForRadius(900);
    const dy=e.clientY-drag.startY;
    const next=Math.max(30,Math.min(50,drag.startRadius-dy*.22));
    drag.current=next;
    cmApplyGuideRadiusLive(next);
    const step=Math.round(next/10)*10;
    if(step!==lastStep){lastStep=step;try{navigator.vibrate?.(5)}catch{}}
  });
  const finish=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    swallow(e);
    cmBlockPlacementForRadius(700);
    const snap=Math.max(30,Math.min(50,Math.round(drag.current/10)*10));
    drag=null;
    state.style.transform='';
    cmSetGuideRadius(snap);
    const range=cmRadiusGauge?.querySelector('#cmRadiusRange');
    if(range)range.step='10';
    try{state.releasePointerCapture(e.pointerId)}catch{}
  };
  state.addEventListener('pointerup',finish);
  state.addEventListener('pointercancel',finish);
  state.addEventListener('click',swallow,true);
  state.addEventListener('touchstart',e=>{e.stopPropagation();cmBlockPlacementForRadius(1200)},{passive:true});
  state.addEventListener('touchend',e=>{e.stopPropagation();cmBlockPlacementForRadius(700)},{passive:true});
}
`;

    src=src.replace(uiMarker,helper+uiMarker);

    const mapClickNeedle="function cmMapClick(e){if(cmSheet&&!cmAddMode){cmCloseSheet();return}if(cmAddMenuOpen){cmCloseAddMenu();return}if(cmAddMode)cmPlace(e.latlng)}";
    const mapClickFixed="function cmMapClick(e){if(Date.now()<cmRadiusGestureUntil)return;if(cmSheet&&!cmAddMode){cmCloseSheet();return}if(cmAddMenuOpen){cmCloseAddMenu();return}if(cmAddMode)cmPlace(e.latlng)}";
    if(src.includes(mapClickNeedle))src=src.replace(mapClickNeedle,mapClickFixed);

    const installNeedle='cmInstallFab();cmEnableFabDrag();';
    if(src.includes(installNeedle)){
      src=src.replace(installNeedle,installNeedle+'cmEnableRadiusSwipe();');
    }else{
      src=src.replace('cmInstallFab();','cmInstallFab();cmEnableRadiusSwipe();');
    }

    return src;
  };
})();
