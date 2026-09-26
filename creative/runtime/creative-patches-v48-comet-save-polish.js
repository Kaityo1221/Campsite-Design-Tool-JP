(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Keep the toolbox lower now that the add FAB can be moved freely.
    const style=`<style id="cmV48CometSavePolishStyle">
      .toolbox{bottom:calc(82px + env(safe-area-inset-bottom))!important}
      .toolmenu{bottom:calc(142px + env(safe-area-inset-bottom))!important}

      /* Restore the save menu to its original side position, but center the labels. */
      #cmStandaloneSaveMenu{
        left:10px!important;right:auto!important;transform:none!important;
        width:min(260px,calc(100vw - 20px))!important;padding:8px!important;gap:7px!important
      }
      .left-hand #cmStandaloneSaveMenu{left:auto!important;right:10px!important;transform:none!important}
      #cmStandaloneSaveMenu button{text-align:center!important;padding:0 14px!important}

      /* Coordinate list: move the save button out of the memo, but not too low. */
      #cmStandaloneSaveButton{transition:transform .2s ease!important}
      body:has(.cm-coords) #cmStandaloneSaveButton{transform:translateY(48px)!important}
      .cm-coords>div:last-child{padding-bottom:72px!important}

      /* Blue-white comet. The head is deliberately bright so it never reads as a black dot. */
      .cm-v48-comet{position:fixed;left:0;top:0;width:1px;height:1px;z-index:7800;pointer-events:none;will-change:transform,opacity;filter:drop-shadow(0 0 5px rgba(80,190,255,.95))}
      .cm-v48-comet-head{position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:radial-gradient(circle at 38% 35%,#fff 0 22%,#dff8ff 23% 42%,#74d8ff 43% 67%,#178cff 68% 100%);box-shadow:0 0 5px #fff,0 0 10px #79ddff,0 0 16px rgba(24,135,255,.85)}
      .cm-v48-comet-tail{position:absolute;left:-46px;top:-2px;width:46px;height:4px;border-radius:999px;background:linear-gradient(90deg,rgba(41,135,255,0) 0%,rgba(58,180,255,.16) 20%,rgba(87,207,255,.64) 64%,rgba(224,250,255,.96) 100%);filter:blur(.15px);box-shadow:0 0 5px rgba(70,194,255,.55)}
      .cm-v48-comet-tail2{position:absolute;left:-31px;top:2px;width:31px;height:2px;border-radius:999px;background:linear-gradient(90deg,rgba(34,119,255,0),rgba(72,195,255,.55),rgba(255,255,255,.86));opacity:.8}
      .cm-v48-comet-spark{position:absolute;left:-18px;top:-5px;width:3px;height:3px;border-radius:50%;background:#dff9ff;box-shadow:-9px 7px 0 rgba(76,190,255,.65),-18px 2px 0 rgba(76,190,255,.32)}
      #cmCount.cm-v48-count-pop{animation:cmV48CountPop .34s ease}
      @keyframes cmV48CountPop{0%{transform:scale(1);text-shadow:none}42%{transform:scale(1.28);text-shadow:0 0 9px #fff,0 0 15px #6ed7ff}100%{transform:scale(1);text-shadow:none}}
      @media(prefers-reduced-motion:reduce){.cm-v48-comet{display:none!important}#cmCount.cm-v48-count-pop{animation:none!important}}
    </style>`;
    if(!src.includes('id="cmV48CometSavePolishStyle"'))src=src.replace('</head>',style+'</head>');

    // Replace the v46 flight call with a brighter comet implementation.
    const placeMarker='function cmPlace(latlng){';
    if(src.includes(placeMarker)&&!src.includes('function cmV48FlyCometToCount(')){
      const helper=`function cmV48FlyCometToCount(r){
  try{
    if(!r||!Array.isArray(r.latlng))return;
    if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const target=document.getElementById('cmCount');if(!target)return;
    const container=map.getContainer(),mr=container.getBoundingClientRect();
    const p=map.latLngToContainerPoint(L.latLng(r.latlng[0],r.latlng[1])),tr=target.getBoundingClientRect();
    const sx=mr.left+p.x,sy=mr.top+p.y,ex=tr.left+tr.width/2,ey=tr.top+tr.height/2;
    const dx=ex-sx,dy=ey-sy,angle=Math.atan2(dy,dx)*180/Math.PI;
    const comet=document.createElement('div');comet.className='cm-v48-comet';
    comet.innerHTML='<i class="cm-v48-comet-tail"></i><i class="cm-v48-comet-tail2"></i><i class="cm-v48-comet-spark"></i><i class="cm-v48-comet-head"></i>';
    document.body.appendChild(comet);
    const tf=(x,y,s)=>'translate3d('+x+'px,'+y+'px,0) rotate('+angle+'deg) scale('+s+')';
    const anim=comet.animate([
      {transform:tf(sx,sy,.78),opacity:.18,offset:0},
      {transform:tf(sx+dx*.12,sy+dy*.12,1),opacity:1,offset:.16},
      {transform:tf(sx+dx*.84,sy+dy*.84,.96),opacity:1,offset:.84},
      {transform:tf(ex,ey,.58),opacity:0,offset:1}
    ],{duration:540,easing:'cubic-bezier(.18,.72,.22,1)',fill:'forwards'});
    anim.onfinish=()=>{
      comet.remove();
      target.classList.remove('cm-v48-count-pop');void target.offsetWidth;target.classList.add('cm-v48-count-pop');
      setTimeout(()=>target.classList.remove('cm-v48-count-pop'),380);
    };
  }catch(e){console.warn('[Creative v48] comet animation',e)}
}
`;
      src=src.replace(placeMarker,helper+placeMarker);
      src=src.replace('cmV46FlyStarToCount(r);cmShowUndo(r);cmClearPreview()','cmV48FlyCometToCount(r);cmShowUndo(r);cmClearPreview()');
    }

    // Closing the add menu should not replay the transient 「追加」 label.
    const runtime=`<script id="cmV48CometSavePolishRuntime">
(()=>{
  let wasOpen=false;
  const remember=e=>{
    const t=e.target&&e.target.closest?e.target.closest('#cmAddFab'):null;if(!t)return;
    try{wasOpen=typeof cmAddMenuOpen!=='undefined'&&!!cmAddMenuOpen}catch(_){wasOpen=false}
  };
  const hideIfClosing=e=>{
    const t=e.target&&e.target.closest?e.target.closest('#cmAddFab'):null;if(!t||!wasOpen)return;
    setTimeout(()=>{const hint=document.getElementById('cmV45AddFlash');if(hint)hint.classList.remove('show')},0);
  };
  document.addEventListener('pointerdown',remember,true);
  document.addEventListener('touchstart',remember,{capture:true,passive:true});
  document.addEventListener('click',hideIfClosing,true);
})();
</script>`;
    if(!src.includes('id="cmV48CometSavePolishRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
