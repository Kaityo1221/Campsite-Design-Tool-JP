(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const moveStart=src.indexOf('function cmBeginMove(r){');
    const moveEnd=moveStart>=0?src.indexOf('function cmClearPreview',moveStart):-1;
    if(moveStart>=0&&moveEnd>=0){
      const replacement=`let cmMoveCrosshair=null,cmMoveUi=null,cmMovePageLock=null,cmMoveMapLock=null;
function cmMoveCrosshairElement(){
  const d=document.createElement('div');
  d.id='cmMoveCrosshair';
  d.setAttribute('aria-hidden','true');
  d.innerHTML='<span class="cm-move-cross-h"></span><span class="cm-move-cross-v"></span><span class="cm-move-cross-c"></span>';
  document.body.appendChild(d);
  return d;
}
function cmShowMoveCrosshair(){
  if(!cmMoveCrosshair||!cmMoveCrosshair.isConnected)cmMoveCrosshair=cmMoveCrosshairElement();
  cmMoveCrosshair.style.display='block';
}
function cmHideMoveCrosshair(){if(cmMoveCrosshair)cmMoveCrosshair.style.display='none'}
function cmMoveLeverOffset(radius){const r=Math.max(30,Math.min(50,Number(radius)||50));return ((50-r)/20)*44-22}
function cmMoveSetRadius(radius){
  if(!cmMoveSession)return;
  const r=Math.max(30,Math.min(50,Number(radius)||50));
  cmMoveSession.radius=r;
  cmMoveSession.circle?.setRadius(r);
  const value=document.getElementById('cmMoveRadiusValue');if(value)value.textContent=Math.round(r)+'m';
  const knob=document.getElementById('cmMoveLeverKnob');if(knob)knob.style.transform='translate(-50%,-50%) translateY('+cmMoveLeverOffset(r)+'px)';
}
function cmMoveLockSurface(){
  if(cmMovePageLock)return;
  const de=document.documentElement,b=document.body;
  cmMovePageLock={deOverflow:de.style.overflow,deOverscroll:de.style.overscrollBehavior,bOverflow:b.style.overflow,bOverscroll:b.style.overscrollBehavior,bTouchAction:b.style.touchAction};
  de.style.overflow='hidden';de.style.overscrollBehavior='none';b.style.overflow='hidden';b.style.overscrollBehavior='none';b.style.touchAction='none';
  cmMoveMapLock={dragging:!!map.dragging?.enabled?.(),touchZoom:!!map.touchZoom?.enabled?.(),doubleClickZoom:!!map.doubleClickZoom?.enabled?.()};
  try{map.dragging?.disable?.()}catch{}try{map.touchZoom?.disable?.()}catch{}try{map.doubleClickZoom?.disable?.()}catch{}
}
function cmMoveUnlockSurface(){
  if(cmMovePageLock){const de=document.documentElement,b=document.body;de.style.overflow=cmMovePageLock.deOverflow;de.style.overscrollBehavior=cmMovePageLock.deOverscroll;b.style.overflow=cmMovePageLock.bOverflow;b.style.overscrollBehavior=cmMovePageLock.bOverscroll;b.style.touchAction=cmMovePageLock.bTouchAction;cmMovePageLock=null}
  if(cmMoveMapLock){try{if(cmMoveMapLock.dragging)map.dragging?.enable?.()}catch{}try{if(cmMoveMapLock.touchZoom)map.touchZoom?.enable?.()}catch{}try{if(cmMoveMapLock.doubleClickZoom)map.doubleClickZoom?.enable?.()}catch{}cmMoveMapLock=null}
}
function cmBindMoveLever(){
  const handle=document.getElementById('cmMoveLever');if(!handle||handle.dataset.ready==='1')return;handle.dataset.ready='1';
  let drag=null,lastStep=null;
  const block=e=>{if(e?.cancelable)e.preventDefault();e?.stopPropagation?.()};
  const begin=(id,y,e)=>{if(!cmMoveSession)return;block(e);cmMoveLockSurface();drag={id,startY:y,startRadius:cmMoveSession.radius||50,current:cmMoveSession.radius||50};lastStep=Math.round(drag.current/10)*10;handle.classList.add('dragging')};
  const move=(y,e)=>{if(!drag)return;block(e);const dy=y-drag.startY;const next=Math.max(30,Math.min(50,drag.startRadius-dy*.24));drag.current=next;cmMoveSetRadius(next);const step=Math.round(next/10)*10;if(step!==lastStep){lastStep=step;try{navigator.vibrate?.(5)}catch{}}};
  const finish=e=>{if(!drag){cmMoveUnlockSurface();return}block(e);const snap=Math.max(30,Math.min(50,Math.round(drag.current/10)*10));drag=null;handle.classList.remove('dragging');cmMoveSetRadius(snap);cmMoveUnlockSurface()};
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
function cmInstallMoveUi(){
  cmRemoveMoveUi();
  const d=document.createElement('div');d.id='cmMoveBar';d.className='cm-move-bar';
  d.innerHTML='<button id="cmMoveLever" class="cm-move-lever" type="button" aria-label="上下にスライドして距離円を変更"><span class="cm-move-labels"><i>50</i><i>40</i><i>30</i></span><span class="cm-move-track"></span><span id="cmMoveLeverKnob" class="cm-move-knob"></span></button><strong id="cmMoveRadiusValue">50m</strong><button id="cmMoveConfirm" class="cm-move-confirm" type="button">移動確定</button><button id="cmMoveCancel" class="cm-move-cancel" type="button" aria-label="移動をキャンセル">×</button>';
  document.body.appendChild(d);cmMoveUi=d;
  d.querySelector('#cmMoveConfirm').onclick=e=>{e.preventDefault();e.stopPropagation();cmConfirmMove()};
  d.querySelector('#cmMoveCancel').onclick=e=>{e.preventDefault();e.stopPropagation();cmCancelMove()};
  cmBindMoveLever();cmMoveSetRadius(50);
}
function cmRemoveMoveUi(){if(cmMoveUi?.isConnected)cmMoveUi.remove();cmMoveUi=null;cmMoveUnlockSurface()}
function cmBeginMove(r){
  if(!r||r.deleted||!cmIsNew(r))return;
  cmCloseSheet();
  if(cmAddMode)cmExitAddMode(false);
  if(cmMoveSession)cmEndMove();
  const old=[Number(r.latlng[0]),Number(r.latlng[1])];
  if(r.marker?.setOpacity)r.marker.setOpacity(.34);
  const center=map.getCenter();
  const circle=L.circle(center,{radius:50,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.025,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  const onMapMove=()=>{if(cmMoveSession?.r===r)circle.setLatLng(map.getCenter())};
  cmMoveSession={r,old,circle,onMapMove,radius:50};
  activeTool='move';map.on('move',onMapMove);cmHidePersistentCrosshair();cmShowMoveCrosshair();cmInstallMoveUi();
  msg('地図を動かして十字を移動先に合わせてください',1800);
}
beginMove=cmBeginMove;
function cmConfirmMove(){
  if(!cmMoveSession)return;
  const {r,old}=cmMoveSession,center=map.getCenter(),to=[center.lat,center.lng];
  cmEndMove();r.latlng=to;pushHistory({type:'move',id:r.id,from:old,to});drawAll();snapshot();cmPersistCurrent();msg('POIを移動しました',1400);
}
function cmEndMove(){
  if(!cmMoveSession)return;
  const {r,circle,onMapMove}=cmMoveSession;
  try{map.off('move',onMapMove)}catch{}try{if(circle)map.removeLayer(circle)}catch{}if(r?.marker?.setOpacity)r.marker.setOpacity(1);
  cmMoveSession=null;if(activeTool==='move')activeTool='';cmHideMoveCrosshair();cmRemoveMoveUi();
}
function cmCancelMove(){if(!cmMoveSession)return;cmEndMove();msg('位置調整をキャンセルしました',1200)}
`;
      src=src.slice(0,moveStart)+replacement+src.slice(moveEnd);
    }

    src=src.replace('function cmOpenRecord(r){cmCloseSheet();','function cmOpenRecord(r){if(cmMoveSession)return;cmCloseSheet();');
    src=src.replace('function cmMapClick(e){','function cmMapClick(e){if(cmMoveSession)return;');

    const style=`<style id="cmV32MoveStyle">
      #cmMoveCrosshair{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:54px;height:54px;z-index:1445;pointer-events:none;display:none}
      #cmMoveCrosshair .cm-move-cross-h,#cmMoveCrosshair .cm-move-cross-v{position:absolute;left:50%;top:50%;background:rgba(255,255,255,.97);box-shadow:0 0 0 1px rgba(56,45,29,.60),0 1px 4px rgba(0,0,0,.34);border-radius:2px}
      #cmMoveCrosshair .cm-move-cross-h{width:46px;height:3px;transform:translate(-50%,-50%)}
      #cmMoveCrosshair .cm-move-cross-v{width:3px;height:46px;transform:translate(-50%,-50%)}
      #cmMoveCrosshair .cm-move-cross-c{position:absolute;left:50%;top:50%;width:8px;height:8px;transform:translate(-50%,-50%);border-radius:50%;background:#d8b766;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)}
      .cm-move-bar{position:fixed;left:50%;bottom:calc(118px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1560;display:grid;grid-template-columns:76px 46px 82px 24px;gap:6px;align-items:center;padding:4px 6px 4px 4px;border:1px solid rgba(138,107,49,.16);border-radius:999px;background:rgba(255,253,247,.36);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);box-shadow:0 2px 8px rgba(0,0,0,.10);color:#382d1d}
      .cm-move-bar strong{font-size:12px;text-align:center}.cm-move-confirm{height:30px;border:1px solid rgba(138,107,49,.24);border-radius:999px;background:rgba(255,248,230,.72);color:#382d1d;font-size:12px;font-weight:950;padding:0 10px;white-space:nowrap}.cm-move-cancel{width:20px;height:20px;border:0;border-radius:50%;background:rgba(238,229,212,.52);color:#5d4630;font-size:13px;font-weight:900;line-height:1;padding:0}
      .cm-move-lever{position:relative;width:76px;height:96px;border:0;background:transparent;padding:0;touch-action:none;-webkit-user-select:none;user-select:none}.cm-move-lever>*{pointer-events:none}.cm-move-labels{position:absolute;left:0;top:12px;width:24px;height:72px;display:grid;grid-template-rows:repeat(3,24px);color:rgba(83,70,49,.68);font-size:10px;font-weight:900;text-align:right}.cm-move-labels i{font-style:normal;line-height:24px}.cm-move-track{position:absolute;left:45px;top:50%;width:5px;height:58px;transform:translate(-50%,-50%);border-radius:999px;background:rgba(93,81,65,.20)}.cm-move-track:before,.cm-move-track:after{content:'';position:absolute;left:50%;width:7px;height:2px;transform:translateX(-50%);background:rgba(93,81,65,.38)}.cm-move-track:before{top:0}.cm-move-track:after{bottom:0}.cm-move-knob{position:absolute;left:45px;top:50%;width:36px;height:36px;border-radius:50%;background:rgba(255,253,247,.98);border:2px solid rgba(138,107,49,.28);box-shadow:0 4px 10px rgba(0,0,0,.20),inset 0 0 0 7px rgba(216,183,102,.13);transform:translate(-50%,-50%) translateY(-22px);transition:transform .13s cubic-bezier(.2,.8,.25,1)}.cm-move-lever.dragging .cm-move-knob{transition:none;box-shadow:0 5px 14px rgba(0,0,0,.28),0 0 0 5px rgba(216,183,102,.18),inset 0 0 0 7px rgba(216,183,102,.16)}
    </style>`;
    if(!src.includes('id="cmV32MoveStyle"'))src=src.replace('</head>',style+'</head>');
    return src;
  };
})();
