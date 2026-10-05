(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const installMarker='function cmSafeInstallAddBar(){';
    if(src.includes(installMarker)&&!src.includes('function cmPhaseCSelectedPoiHtml(')){
      const helpers=`function cmPhaseCSelectedPoiMeta(layer){
  return ({
    'new-pokestop':{label:'PokéStop',icon:'./assets/pokestop.png'},
    'new-gym':{label:'Gym',icon:'./assets/gym.png'},
    'new-power':{label:'PowerSpot',icon:'./assets/powerspot.png'}
  })[layer]||{label:'POI',icon:''};
}
function cmPhaseCSelectedPoiHtml(layer){
  const meta=cmPhaseCSelectedPoiMeta(layer);
  return '<span class="cm-phase-c-selected-poi" aria-label="選択中 '+meta.label+'">'+(meta.icon?'<img src="'+meta.icon+'" alt="">':'')+'<b>'+meta.label+'</b></span>';
}
`;
      src=src.replace(installMarker,helpers+installMarker);
      src=src.replace(
        "const d=document.createElement('div');d.id='cmSafeAddBar';d.className='cm-safe-add-bar';",
        "const d=document.createElement('div');d.id='cmSafeAddBar';d.className='cm-safe-add-bar';d.innerHTML=cmPhaseCSelectedPoiHtml(activeLayer);"
      );
      src=src.replace(
        "d.innerHTML='<button id=\"cmSafeAddLever\"",
        "d.innerHTML+='<button id=\"cmSafeAddLever\""
      );
    }

    const openMarker='function cmOpenAddMenu(){';
    if(src.includes(openMarker)&&!src.includes('function cmPhaseCSyncAddMenuCapacity(')){
      src=src.replace(openMarker,'function cmOpenAddMenuBase(){');
      const wrapper=`function cmPhaseCSyncAddMenuCapacity(){
  const bubbles=document.querySelectorAll('.cm-bubble[data-layer]');
  bubbles.forEach(b=>{
    const layer=String(b.dataset.layer||'');
    const limit=typeof jpTypeLimit==='function'?jpTypeLimit(layer):0;
    const count=typeof jpTypeCount==='function'?jpTypeCount(layer):0;
    const disabled=!!limit&&count>=limit;
    b.dataset.cmCapacityDisabled=disabled?'1':'0';
    b.classList.toggle('cm-phase-c-capacity-disabled',disabled);
    b.setAttribute('aria-disabled',disabled?'true':'false');
    if('disabled' in b)b.disabled=disabled;
    const label=typeof JP_TYPE_LABELS!=='undefined'?(JP_TYPE_LABELS[layer]||'ゲームスポット'):'ゲームスポット';
    if(disabled)b.title=label+'は最大'+limit+'個です';else b.removeAttribute('title');
  });
}
function cmOpenAddMenu(){
  if(typeof jpAdditionalRecords==='function'&&typeof JP_MAX_ADDITIONAL!=='undefined'&&jpAdditionalRecords().length>=JP_MAX_ADDITIONAL){
    cmCloseAddMenu();
    msg('追加ゲームスポットは最大25個です',1800);
    if(typeof renderJpGuide==='function')renderJpGuide();
    return;
  }
  const result=cmOpenAddMenuBase();
  cmPhaseCSyncAddMenuCapacity();
  requestAnimationFrame(cmPhaseCSyncAddMenuCapacity);
  return result;
}
`;
      src=src.replace('function cmOpenAddMenuBase(){',wrapper+'function cmOpenAddMenuBase(){');
    }

    const bubbleGuard="if(bubble){\n      const key='add:'+bubble.dataset.layer,now=Date.now();";
    if(src.includes(bubbleGuard)){
      src=src.replace(bubbleGuard,"if(bubble){\n      if(bubble.dataset.cmCapacityDisabled==='1'||bubble.getAttribute('aria-disabled')==='true'){e.preventDefault?.();e.stopPropagation?.();e.stopImmediatePropagation?.();if(typeof jpTypeLimitMessage==='function')msg(jpTypeLimitMessage(bubble.dataset.layer),1800);return true}\n      const key='add:'+bubble.dataset.layer,now=Date.now();");
    }

    const style=`<style id="cmV75PoiAddPhaseCStyle">
      .cm-safe-add-bar{grid-template-columns:70px 64px 40px 64px 42px!important;column-gap:4px!important}
      .cm-phase-c-selected-poi{min-width:0;height:40px;display:grid;grid-template-columns:28px minmax(0,1fr);gap:3px;align-items:center;padding:0 3px;border-radius:12px;background:rgba(255,253,247,.62);box-sizing:border-box}
      .cm-phase-c-selected-poi img{width:27px;height:27px;object-fit:contain;display:block}
      .cm-phase-c-selected-poi b{min-width:0;font-size:9px;line-height:1.05;font-weight:950;color:#382d1d;overflow-wrap:anywhere;text-align:left}
      .cm-fab-wrap.open .cm-bubble.cm-phase-c-capacity-disabled{opacity:.28!important;filter:grayscale(.72)!important;cursor:not-allowed!important;box-shadow:none!important}
      .cm-fab-wrap.open .cm-bubble.cm-phase-c-capacity-disabled img{filter:grayscale(.72)!important}
    </style>`;
    if(!src.includes('id="cmV75PoiAddPhaseCStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
