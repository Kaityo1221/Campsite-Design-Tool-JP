(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Force a deterministic add-mode entry point. Do not rely on the older one-line replacement chain.
    const addStart=src.indexOf('function cmStartAdd(layer){');
    const addEnd=addStart>=0?src.indexOf('function cmExitAddMode',addStart):-1;
    if(addStart>=0&&addEnd>=0){
      const replacement=`function cmStartAdd(layer){
  if(cmMoveSession)cmEndMove();
  activeLayer=layer;
  cmAddMode=true;
  activeTool='add';
  cmCloseAddMenu();
  cmUpdateFab();
  status.classList.add('fade');
  renderLayerPanel();
  cmShowPersistentCrosshair();
  cmShowRadiusGauge();
  cmEnsureCenterGuideCircle();
  msg('POI追加モード',900);
}
`;
      src=src.slice(0,addStart)+replacement+src.slice(addEnd);
    }

    // iPhone Safari safety net: handle the visible action buttons at capture phase.
    // This bypasses stale target onclick handlers that can survive the patch chain.
    const uiMarker='function cmInstallUi(){';
    if(src.includes(uiMarker)){
      const helper=`let cmActionLastKey='',cmActionLastAt=0;
function cmInstallActionWiring(){
  if(document.documentElement.dataset.cmActionWiring==='33')return;
  document.documentElement.dataset.cmActionWiring='33';

  const run=(e,kind)=>{
    const target=e.target;
    if(!target?.closest)return false;

    const bubble=target.closest('.cm-bubble[data-layer]');
    if(bubble){
      const key='add:'+bubble.dataset.layer,now=Date.now();
      if(key===cmActionLastKey&&now-cmActionLastAt<450){
        e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.();
        return true;
      }
      cmActionLastKey=key;cmActionLastAt=now;
      e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.();
      cmStartAdd(bubble.dataset.layer);
      return true;
    }

    const moveButton=target.closest('#cmMove');
    if(moveButton){
      const r=cmSheet?._record;
      if(!r)return false;
      const key='move:'+String(r.id||''),now=Date.now();
      if(key===cmActionLastKey&&now-cmActionLastAt<450){
        e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.();
        return true;
      }
      cmActionLastKey=key;cmActionLastAt=now;
      e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.();
      cmBeginMove(r);
      return true;
    }
    return false;
  };

  document.addEventListener('pointerup',e=>{
    if(e.pointerType&&e.pointerType!=='touch'&&e.pointerType!=='pen')return;
    run(e,'pointerup');
  },true);
  document.addEventListener('click',e=>run(e,'click'),true);
}
`;
      src=src.replace(uiMarker,helper+uiMarker.replace('{','{cmInstallActionWiring();'));
    }

    return src;
  };
})();
