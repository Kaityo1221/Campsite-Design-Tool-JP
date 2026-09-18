(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const addStart=src.indexOf('function cmStartAdd(layer){');
    const openAdd=addStart>=0?src.indexOf('function cmOpenAddMenu()',addStart):-1;
    if(addStart>=0&&openAdd>=0){
      const replacement=`let cmSafeAddDot=null,cmSafeAddCircle=null,cmSafeAddBar=null,cmSafeAddRadius=50,cmSafeAddPageLock=null,cmSafeAddMapLock=null;
function cmSafeAddDotElement(){
  const d=document.createElement('div');
  d.id='cmSafeAddDot';
  d.innerHTML='<span></span>';
  document.body.appendChild(d);
  return d;
}
function cmSafeShowAddDot(){
  if(!cmSafeAddDot||!cmSafeAddDot.isConnected)cmSafeAddDot=cmSafeAddDotElement();
  cmSafeAddDot.style.display='grid';
}
function cmSafeHideAddDot(){if(cmSafeAddDot)cmSafeAddDot.style.display='none'}
function cmSafeEnsureAddCircle(){
  if(!cmAddMode)return;
  const center=map.getCenter();
  if(!cmSafeAddCircle){
    cmSafeAddCircle=L.circle(center,{radius:cmSafeAddRadius,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.025,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  }else{
    cmSafeAddCircle.setLatLng(center);
    cmSafeAddCircle.setRadius(cmSafeAddRadius);
    if(!map.hasLayer(cmSafeAddCircle))cmSafeAddCircle.addTo(map);
  }
}
function cmSafeRemoveAddCircle(){
  if(!cmSafeAddCircle)return;
  try{map.removeLayer(cmSafeAddCircle)}catch{}
  cmSafeAddCircle=null;
}
function cmSafeLeverOffset(radius){const r=Math.max(30,Math.min(50,Number(radius)||50));return ((50-r)/20)*44-22}
function cmSafeSetAddRadius(radius){
  const r=Math.max(30,Math.min(50,Number(radius)||50));
  cmSafeAddRadius=r;
  if(cmSafeAddCircle)cmSafeAddCircle.setRadius(r);
  const value=document.getElementById('cmSafeAddRadiusValue');if(value)value.textContent=Math.round(r)+'m';
  const knob=document.getElementById('cmSafeAddKnob');if(knob)knob.style.transform='translate(-50%,-50%) translateY('+cmSafeLeverOffset(r)+'px)';
}
function cmSafeLockAddSurface(){
  if(cmSafeAddPageLock)return;
  const de=document.documentElement,b=document.body;
  cmSafeAddPageLock={deOverflow:de.style.overflow,deOverscroll:de.style.overscrollBehavior,bOverflow:b.style.overflow,bOverscroll:b.style.overscrollBehavior,bTouchAction:b.style.touchAction};
  de.style.overflow='hidden';de.style.overscrollBehavior='none';b.style.overflow='hidden';b.style.overscrollBehavior='none';b.style.touchAction='none';
  cmSafeAddMapLock={dragging:!!map.dragging?.enabled?.(),touchZoom:!!map.touchZoom?.enabled?.(),doubleClickZoom:!!map.doubleClickZoom?.enabled?.()};
  try{map.dragging?.disable?.()}catch{}try{map.touchZoom?.disable?.()}catch{}try{map.doubleClickZoom?.disable?.()}catch{}
}
function cmSafeUnlockAddSurface(){
  if(cmSafeAddPageLock){const de=document.documentElement,b=document.body;de.style.overflow=cmSafeAddPageLock.deOverflow;de.style.overscrollBehavior=cmSafeAddPageLock.deOverscroll;b.style.overflow=cmSafeAddPageLock.bOverflow;b.style.overscrollBehavior=cmSafeAddPageLock.bOverscroll;b.style.touchAction=cmSafeAddPageLock.bTouchAction;cmSafeAddPageLock=null}
  if(cmSafeAddMapLock){try{if(cmSafeAddMapLock.dragging)map.dragging?.enable?.()}catch{}try{if(cmSafeAddMapLock.touchZoom)map.touchZoom?.enable?.()}catch{}try{if(cmSafeAddMapLock.doubleClickZoom)map.doubleClickZoom?.enable?.()}catch{}cmSafeAddMapLock=null}
}
function cmSafeBindAddLever(){
  const handle=document.getElementById('cmSafeAddLever');if(!handle||handle.dataset.ready==='1')return;handle.dataset.ready='1';
  let drag=null,lastStep=null;
  const block=e=>{if(e?.cancelable)e.preventDefault();e?.stopPropagation?.()};
  const begin=(id,y,e)=>{if(!cmAddMode)return;block(e);cmSafeLockAddSurface();drag={id,startY:y,startRadius:cmSafeAddRadius,current:cmSafeAddRadius};lastStep=Math.round(cmSafeAddRadius/10)*10;handle.classList.add('dragging')};
  const move=(y,e)=>{if(!drag)return;block(e);const dy=y-drag.startY;const next=Math.max(30,Math.min(50,drag.startRadius-dy*.24));drag.current=next;cmSafeSetAddRadius(next);const step=Math.round(next/10)*10;if(step!==lastStep){lastStep=step;try{navigator.vibrate?.(5)}catch{}}};
  const finish=e=>{if(!drag){cmSafeUnlockAddSurface();return}block(e);const snap=Math.max(30,Math.min(50,Math.round(drag.current/10)*10));drag=null;handle.classList.remove('dragging');cmSafeSetAddRadius(snap);cmSafeUnlockAddSurface()};
  const findTouch=(list,id)=>Array.from(list||[]).find(t=>t.identifier===id);
  handle.addEventListener('touchstart',e=>{if(e.touches.length!==1||drag)return;const t=e.touches[0];begin(t.identifier,t.clientY,e)},{passive:false});
  handle.addEventListener('touchmove',e=>{if(!drag)return;const t=findTouch(e.touches,drag.id);if(t)move(t.clientY,e);else block(e)},{passive:false});
  handle.addEventListener('touchend',e=>{if(!drag)return;const t=findTouch(e.changedTouches,drag.id);if(t)finish(e);else block(e)},{passive:false});
  handle.addEventListener('touchcancel',e=>finish(e),{passive:false});
  handle.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||drag)return;begin(e.pointerId,e.clientY,e);try{handle.setPointerCapture(e.pointerId)}catch{}});
  handle.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||!drag||drag.id!==e.pointerId)return;move(e.clientY,e)});
  handle.addEventListener('pointerup',e=>{if(e.pointerType==='touch'||!drag||drag.id!==e.pointerId)return;finish(e);try{handle.releasePointerCapture(e.pointerId)}catch{}});
  handle.addEventListener('pointercancel',e=>{if(e.pointerType!=='touch')finish(e)});
}
function cmSafeInstallAddBar(){
  cmSafeRemoveAddBar();
  const d=document.createElement('div');d.id='cmSafeAddBar';d.className='cm-safe-add-bar';
  d.innerHTML='<button id="cmSafeAddLever" class="cm-safe-add-lever" type="button" aria-label="上下にスライドして距離円を変更"><span class="cm-safe-add-labels"><i>50</i><i>40</i><i>30</i></span><span class="cm-safe-add-track"></span><span id="cmSafeAddKnob" class="cm-safe-add-knob"></span></button><strong id="cmSafeAddRadiusValue">50m</strong><button id="cmSafeAddConfirm" class="cm-safe-add-confirm" type="button">確定</button><button id="cmSafeAddCancel" class="cm-safe-add-cancel" type="button" aria-label="追加を終了">×</button>';
  document.body.appendChild(d);cmSafeAddBar=d;
  d.querySelector('#cmSafeAddConfirm').onclick=e=>{e.preventDefault();e.stopPropagation();if(!cmAddMode)return;cmPlace(map.getCenter());cmSafeEnsureAddCircle()};
  d.querySelector('#cmSafeAddCancel').onclick=e=>{e.preventDefault();e.stopPropagation();cmExitAddMode(false);msg('POI追加を終了しました',1200)};
  cmSafeBindAddLever();cmSafeSetAddRadius(50);
}
function cmSafeRemoveAddBar(){if(cmSafeAddBar?.isConnected)cmSafeAddBar.remove();cmSafeAddBar=null;cmSafeUnlockAddSurface()}
function cmSafeHideLegacyAddUi(){
  const legacy=document.getElementById('cmRadiusGauge');if(legacy)legacy.style.display='none';
  const old=document.getElementById('cmPersistentCrosshair');if(old)old.style.display='none';
}
function cmStartAdd(layer){
  if(cmMoveSession)cmEndMove();
  activeLayer=layer;cmAddMode=true;activeTool='add';cmCloseAddMenu();cmUpdateFab();status.classList.add('fade');renderLayerPanel();
  cmSafeHideLegacyAddUi();cmSafeShowAddDot();cmSafeEnsureAddCircle();cmSafeInstallAddBar();
  msg('POI追加モード',900);
}
function cmExitAddMode(message=true){
  cmAddMode=false;cmCloseAddMenu();cmClearPreview?.();cmSafeHideAddDot();cmSafeRemoveAddCircle();cmSafeRemoveAddBar();cmSafeHideLegacyAddUi();
  if(activeTool==='add')activeTool='';cmUpdateFab();if(message)msg('POI追加を終了しました');
}
`;
      src=src.slice(0,addStart)+replacement+src.slice(openAdd);
    }

    // Move mode must never depend on the legacy add crosshair helpers.
    src=src.replace('cmHidePersistentCrosshair();cmShowMoveCrosshair();cmInstallMoveUi();','cmSafeHideAddDot();cmSafeRemoveAddCircle();cmSafeRemoveAddBar();cmSafeHideLegacyAddUi();cmShowMoveCrosshair();cmInstallMoveUi();');

    // Keep add guide circle locked to the map center while panning.
    const installMarker='function cmInstallUi(){';
    if(src.includes(installMarker)){
      const helper=`function cmSafeInstallPlacementCore(){
  if(document.documentElement.dataset.cmPlacementCore==='34')return;
  document.documentElement.dataset.cmPlacementCore='34';
  map.on('move',()=>{if(cmAddMode&&cmSafeAddCircle)cmSafeAddCircle.setLatLng(map.getCenter())});
}
`;
      src=src.replace(installMarker,helper+installMarker.replace('{','{cmSafeInstallPlacementCore();'));
    }

    const style=`<style id="cmV34PlacementCoreStyle">
      #cmSafeAddDot{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:24px;height:24px;z-index:1455;pointer-events:none;display:none;place-items:center}
      #cmSafeAddDot span{display:block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.96);border:1.5px solid rgba(83,70,49,.34);box-shadow:0 1px 4px rgba(0,0,0,.20)}
      .cm-safe-add-bar{position:fixed;left:50%;bottom:calc(118px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1565;display:grid;grid-template-columns:76px 46px 64px 24px;gap:6px;align-items:center;padding:4px 6px 4px 4px;border:1px solid rgba(138,107,49,.16);border-radius:999px;background:rgba(255,253,247,.36);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);box-shadow:0 2px 8px rgba(0,0,0,.10);color:#382d1d}
      .cm-safe-add-bar strong{font-size:12px;text-align:center}.cm-safe-add-confirm{height:30px;border:1px solid rgba(138,107,49,.24);border-radius:999px;background:rgba(255,248,230,.72);color:#382d1d;font-size:12px;font-weight:950;padding:0 10px;white-space:nowrap}.cm-safe-add-cancel{width:20px;height:20px;border:0;border-radius:50%;background:rgba(238,229,212,.52);color:#5d4630;font-size:13px;font-weight:900;line-height:1;padding:0}
      .cm-safe-add-lever{position:relative;width:76px;height:96px;border:0;background:transparent;padding:0;touch-action:none;-webkit-user-select:none;user-select:none}.cm-safe-add-lever>*{pointer-events:none}.cm-safe-add-labels{position:absolute;left:0;top:12px;width:24px;height:72px;display:grid;grid-template-rows:repeat(3,24px);color:rgba(83,70,49,.68);font-size:10px;font-weight:900;text-align:right}.cm-safe-add-labels i{font-style:normal;line-height:24px}.cm-safe-add-track{position:absolute;left:45px;top:50%;width:5px;height:58px;transform:translate(-50%,-50%);border-radius:999px;background:rgba(93,81,65,.20)}.cm-safe-add-track:before,.cm-safe-add-track:after{content:'';position:absolute;left:50%;width:7px;height:2px;transform:translateX(-50%);background:rgba(93,81,65,.38)}.cm-safe-add-track:before{top:0}.cm-safe-add-track:after{bottom:0}.cm-safe-add-knob{position:absolute;left:45px;top:50%;width:36px;height:36px;border-radius:50%;background:rgba(255,253,247,.98);border:2px solid rgba(138,107,49,.28);box-shadow:0 4px 10px rgba(0,0,0,.20),inset 0 0 0 7px rgba(216,183,102,.13);transform:translate(-50%,-50%) translateY(-22px);transition:transform .13s cubic-bezier(.2,.8,.25,1)}.cm-safe-add-lever.dragging .cm-safe-add-knob{transition:none;box-shadow:0 5px 14px rgba(0,0,0,.28),0 0 0 5px rgba(216,183,102,.18),inset 0 0 0 7px rgba(216,183,102,.16)}
    </style>`;
    if(!src.includes('id="cmV34PlacementCoreStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
