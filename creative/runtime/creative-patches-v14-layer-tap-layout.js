(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Reset the validation default once so the new initial position is visible.
    src=src.replace("const CM_FAB_POS='next-lab-creative-fab-position-v1';","const CM_FAB_POS='next-lab-creative-fab-position-v4';");

    // Default + position: lower right area immediately above the bottom bar.
    // Mirror horizontally for left-handed mode. Dragged positions still persist.
    src=src.replace(
      "const saved=cmReadFabPosition();\n  if(saved)cmApplyFabPosition(saved);",
      `const saved=cmReadFabPosition();
  const applyDefault=()=>{
    if(cmReadFabPosition())return;
    requestAnimationFrame(()=>{
      const leftHand=document.body.classList.contains('left-hand');
      const bottomBar=document.querySelector('.bottom-bar');
      const bottomTop=bottomBar?.getBoundingClientRect().top||window.innerHeight-110;
      const centerX=window.innerWidth*(leftHand?0.30:0.70);
      cmApplyFabPosition({x:centerX-28,y:bottomTop-56-12});
    });
  };
  if(saved)cmApplyFabPosition(saved);else applyDefault();
  document.getElementById('leftHand')?.addEventListener('click',()=>setTimeout(applyDefault,0));
  document.getElementById('rightHand')?.addEventListener('click',()=>setTimeout(applyDefault,0));`
    );

    const start=src.indexOf('function renderLayerPanel(){');
    const end=start>=0?src.indexOf('}renderLayerPanel();',start):-1;
    if(start>=0&&end>=0){
      const replacement=`function renderLayerPanel(){
  const root=$('layerRows');
  root.innerHTML='';
  layerDefs.forEach(([k,label])=>{
    const row=document.createElement('div');
    row.className='layer-row';
    const b=document.createElement('button');
    const visible=map.hasLayer(groups[k]);
    b.type='button';
    b.textContent=label;
    b.classList.toggle('active',visible);
    b.setAttribute('aria-pressed',visible?'true':'false');
    b.onclick=()=>{
      const nowVisible=map.hasLayer(groups[k]);
      if(nowVisible)map.removeLayer(groups[k]);else groups[k].addTo(map);
      renderRecordCircles();
      renderLayerPanel();
      msg((nowVisible?'非表示：':'表示：')+label);
    };
    row.append(b);
    root.append(row);
  });
  const row=document.createElement('div');
  row.className='layer-row';
  const b=document.createElement('button');
  const count=polygons.filter(p=>!p.deleted).length;
  b.type='button';
  b.textContent=count?'ポリゴン (1)':'ポリゴン';
  b.disabled=count===0;
  b.classList.toggle('active',count>0&&polygonVisible);
  b.setAttribute('aria-pressed',count>0&&polygonVisible?'true':'false');
  b.onclick=()=>{
    if(!count)return;
    polygonVisible=!polygonVisible;
    polygonVisible?polygonGroup.addTo(map):map.removeLayer(polygonGroup);
    renderLayerPanel();
    msg((polygonVisible?'表示：':'非表示：')+'ポリゴン');
  };
  row.append(b);
  root.append(row);
}renderLayerPanel();`;
      src=src.slice(0,start)+replacement+src.slice(end+'}renderLayerPanel();'.length);
    }

    const uiMarker='function cmInstallUi(){cmAddStyle();';
    if(src.includes(uiMarker)){
      const helper=`
function cmInstallLayerTapStyle(){
  if(document.getElementById('cmLayerTapStyle'))return;
  const s=document.createElement('style');
  s.id='cmLayerTapStyle';
  s.textContent=\`
    #layerPanel{width:max-content!important;max-width:calc(100vw - 20px)!important;padding:10px!important}
    #layerPanel #layerRows{display:grid;grid-template-columns:max-content;gap:5px;width:max-content}
    #layerPanel .layer-row{display:block!important;width:100%!important;margin:0!important}
    #layerPanel .layer-row button{display:block;width:100%!important;min-width:0!important;white-space:nowrap;text-align:left!important;padding:0 16px!important}
    #layerPanel .layer-row button.active{background:#fff8e6!important;color:var(--ink)!important;opacity:1!important}
    #layerPanel .layer-row button:not(.active){background:rgba(255,248,230,.48)!important;color:#6f6453!important;opacity:.62!important}
    #layerPanel .layer-row button:disabled{opacity:.3!important}
  \`;
  document.head.appendChild(s);
}
`;
      src=src.replace(uiMarker,helper+uiMarker.replace('cmAddStyle();','cmAddStyle();cmInstallLayerTapStyle();'));
    }

    return src;
  };
})();
