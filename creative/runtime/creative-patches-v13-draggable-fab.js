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
function cmEnableFabDrag(){
  const wrap=document.getElementById('cmFabWrap'),fab=document.getElementById('cmAddFab');
  if(!wrap||!fab||fab.dataset.dragReady==='1')return;
  fab.dataset.dragReady='1';
  fab.style.touchAction='none';
  fab.style.userSelect='none';
  fab.style.webkitUserSelect='none';
  const saved=cmReadFabPosition();
  if(saved)cmApplyFabPosition(saved);
  let drag=null,suppressClick=false;
  fab.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
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
    if(drag.moved){
      const r=wrap.getBoundingClientRect();
      cmSaveFabPosition({x:r.left,y:r.top});
      suppressClick=true;
    }
    try{fab.releasePointerCapture(e.pointerId)}catch{}
    drag=null;
  };
  fab.addEventListener('pointerup',finish);
  fab.addEventListener('pointercancel',finish);
  fab.addEventListener('click',e=>{
    if(!suppressClick)return;
    suppressClick=false;
    e.preventDefault();
    e.stopImmediatePropagation();
  },true);
  window.addEventListener('resize',()=>{
    const p=cmReadFabPosition();
    if(!p)return;
    const next=cmClampFabPosition(p.x,p.y);
    cmApplyFabPosition(next);
    cmSaveFabPosition(next);
  });
}
`;

    src=src.replace(marker,helper+marker.replace('cmInstallFab();','cmInstallFab();cmEnableFabDrag();'));
    return src;
  };
})();
