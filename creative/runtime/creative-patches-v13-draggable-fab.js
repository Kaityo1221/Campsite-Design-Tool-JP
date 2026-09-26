(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const marker='function cmInstallUi(){cmAddStyle();cmInstallFab();';
    if(!src.includes(marker))return src;

    const helper=`
const CM_FAB_POS='next-lab-creative-fab-position-v1';
function cmClampFabPosition(x,y){
  const w=56,h=56,edge=8;
  const mapRect=document.getElementById('map')?.getBoundingClientRect();
  const bottomBar=document.querySelector('.bottom-bar')?.getBoundingClientRect();
  const minX=edge;
  const maxX=Math.max(minX,window.innerWidth-w-edge);
  const minY=Math.max(edge,mapRect?.top??edge);
  const usableBottom=Math.min(window.innerHeight,bottomBar?.top??window.innerHeight);
  const maxY=Math.max(minY,usableBottom-h-edge);
  const nx=Number(x),ny=Number(y);
  return{
    x:Math.max(minX,Math.min(Number.isFinite(nx)?nx:minX,maxX)),
    y:Math.max(minY,Math.min(Number.isFinite(ny)?ny:minY,maxY))
  };
}
function cmApplyFabPosition(pos){
  const wrap=document.getElementById('cmFabWrap');
  if(!wrap||!pos)return;
  const p=cmClampFabPosition(pos.x,pos.y);
  wrap.style.left=p.x+'px';
  wrap.style.top=p.y+'px';
  wrap.style.right='auto';
  wrap.style.bottom='auto';
}
function cmReadFabPosition(){
  try{const p=JSON.parse(localStorage.getItem(CM_FAB_POS)||'null');return p&&Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y))?p:null}catch{return null}
}
function cmSaveFabPosition(pos){
  try{localStorage.setItem(CM_FAB_POS,JSON.stringify(cmClampFabPosition(pos.x,pos.y)))}catch{}
}
function cmForceHideAddUi(){
  ['cmSafeAddDot','cmPersistentCrosshair','cmMoveCrosshair','cmRadiusGauge'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.style.setProperty('display','none','important');
  });
  try{if(typeof cmRemoveCenterGuideCircle==='function')cmRemoveCenterGuideCircle()}catch{}
}
function cmInstallAddLifecycleFix(){
  if(document.documentElement.dataset.cmAddLifecycleFix==='1')return;
  if(typeof cmStartAdd!=='function'||typeof cmExitAddMode!=='function')return;
  document.documentElement.dataset.cmAddLifecycleFix='1';
  const baseStart=cmStartAdd;
  const baseExit=cmExitAddMode;
  cmStartAdd=function(layer){
    const existing=document.getElementById('cmSafeAddDot');
    if(existing)existing.style.removeProperty('display');
    const result=baseStart.apply(this,arguments);
    const dot=document.getElementById('cmSafeAddDot');
    if(dot)dot.style.setProperty('display','grid','important');
    return result;
  };
  cmExitAddMode=function(message=true){
    const result=baseExit.apply(this,arguments);
    cmForceHideAddUi();
    return result;
  };
}
function cmEnsureFabHintStyle(){
  if(document.getElementById('cmFabHintFixStyle'))return;
  const style=document.createElement('style');
  style.id='cmFabHintFixStyle';
  style.textContent='#cmV45AddFlash{display:none!important}#cmFabAddHint{position:absolute!important;z-index:1700!important;left:50%!important;right:auto!important;min-width:52px!important;padding:4px 9px!important;border-radius:999px!important;background:rgba(255,255,255,.97)!important;color:#49515b!important;box-shadow:0 3px 10px rgba(0,0,0,.14)!important;font-size:11px!important;font-weight:900!important;line-height:1.35!important;text-align:center!important;white-space:nowrap!important;pointer-events:none!important;opacity:0!important;visibility:hidden!important;transform:translateX(-50%)!important;transition:opacity .14s ease!important}.cm-fab-wrap{overflow:visible!important}';
  document.head.appendChild(style);
}
function cmMountAddHintToFab(){
  cmEnsureFabHintStyle();
  const wrap=document.getElementById('cmFabWrap'),fab=document.getElementById('cmAddFab');
  if(!wrap||!fab)return null;
  let hint=document.getElementById('cmFabAddHint');
  if(!hint){
    hint=document.createElement('div');
    hint.id='cmFabAddHint';
    hint.textContent='追加';
    wrap.appendChild(hint);
  }else if(hint.parentElement!==wrap){
    wrap.appendChild(hint);
  }
  const r=fab.getBoundingClientRect();
  const bottomBar=document.querySelector('.bottom-bar')?.getBoundingClientRect();
  const usableBottom=bottomBar?.top??window.innerHeight;
  const placeBelow=r.bottom+34<=usableBottom;
  if(placeBelow){
    hint.style.setProperty('top','62px','important');
    hint.style.setProperty('bottom','auto','important');
  }else{
    hint.style.setProperty('top','auto','important');
    hint.style.setProperty('bottom','62px','important');
  }
  return hint;
}
let cmFabHintTimer=0;
function cmShowAddHintAtFab(){
  const hint=cmMountAddHintToFab();
  if(!hint)return;
  hint.style.setProperty('visibility','visible','important');
  hint.style.setProperty('opacity','1','important');
  clearTimeout(cmFabHintTimer);
  cmFabHintTimer=setTimeout(()=>{
    hint.style.setProperty('opacity','0','important');
    hint.style.setProperty('visibility','hidden','important');
  },1150);
}
function cmHideAddHint(){
  const hint=document.getElementById('cmFabAddHint');
  if(hint){
    hint.style.setProperty('opacity','0','important');
    hint.style.setProperty('visibility','hidden','important');
  }
  clearTimeout(cmFabHintTimer);
}
function cmEnableFabDrag(){
  const wrap=document.getElementById('cmFabWrap'),fab=document.getElementById('cmAddFab');
  if(!wrap||!fab||fab.dataset.dragReady==='1')return;
  fab.dataset.dragReady='1';
  fab.style.touchAction='none';
  fab.style.userSelect='none';
  fab.style.webkitUserSelect='none';
  const saved=cmReadFabPosition();
  if(saved)cmApplyFabPosition(saved);
  cmMountAddHintToFab();
  let drag=null,suppressClick=false;
  fab.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(suppressClick)suppressClick=false;
    const r=wrap.getBoundingClientRect();
    drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x:r.left,y:r.top,moved:false};
    try{fab.setPointerCapture(e.pointerId)}catch{}
  });
  fab.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;
    if(!drag.moved&&Math.hypot(dx,dy)<7)return;
    drag.moved=true;
    e.preventDefault();
    cmApplyFabPosition({x:drag.x+dx,y:drag.y+dy});
  });
  const finish=e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const moved=drag.moved;
    if(moved){
      const r=wrap.getBoundingClientRect();
      cmSaveFabPosition({x:r.left,y:r.top});
      cmMountAddHintToFab();
      suppressClick=true;
      if(e.cancelable)e.preventDefault();
    }else{
      let handled=false;
      try{
        const wasOpen=!!cmAddMenuOpen;
        if(wasOpen){cmCloseAddMenu();cmHideAddHint()}
        else{cmOpenAddMenu();cmShowAddHintAtFab()}
        if(typeof cmUpdateFab==='function')cmUpdateFab();
        handled=true;
      }catch(err){console.warn('[Creative FAB] direct tap fallback',err)}
      if(handled){
        suppressClick=true;
        if(e.cancelable)e.preventDefault();
      }
    }
    try{fab.releasePointerCapture(e.pointerId)}catch{}
    drag=null;
  };
  fab.addEventListener('pointerup',finish);
  fab.addEventListener('pointercancel',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    try{fab.releasePointerCapture(e.pointerId)}catch{}
    drag=null;
  });
  fab.addEventListener('click',e=>{
    if(!suppressClick)return;
    suppressClick=false;
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);
  window.addEventListener('resize',()=>{
    const p=cmReadFabPosition();
    if(p){
      const next=cmClampFabPosition(p.x,p.y);
      cmApplyFabPosition(next);
      cmSaveFabPosition(next);
    }
    cmMountAddHintToFab();
  });
}
`;

    src=src.replace(marker,helper+marker.replace('cmInstallFab();','cmInstallFab();cmEnableFabDrag();cmInstallAddLifecycleFix();'));
    return src;
  };
})();
