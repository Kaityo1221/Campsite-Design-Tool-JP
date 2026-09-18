(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // 1) Replace the large crosshair with a quiet center dot.
    const crossStart=src.indexOf('function cmCrosshairElement(){');
    const crossEnd=crossStart>=0?src.indexOf('function cmShowPersistentCrosshair(){',crossStart):-1;
    if(crossStart>=0&&crossEnd>=0){
      const replacement=`function cmCrosshairElement(){
  const d=document.createElement('div');
  d.id='cmPersistentCrosshair';
  d.innerHTML='<span aria-hidden="true" style="display:block;width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.94);border:1.5px solid rgba(83,70,49,.30);box-shadow:0 1px 3px rgba(0,0,0,.16)"></span>';
  Object.assign(d.style,{position:'fixed',left:'50%',top:'50%',transform:'translate(-50%,-50%)',width:'18px',height:'18px',zIndex:'1440',pointerEvents:'none',display:'none',placeItems:'center'});
  d.style.display='none';
  d.style.alignItems='center';
  d.style.justifyContent='center';
  document.body.appendChild(d);
  return d;
}
`;
      src=src.slice(0,crossStart)+replacement+src.slice(crossEnd);
    }

    // cmShowPersistentCrosshair uses display:block, so center the dot when shown.
    src=src.replace(
      "cmPersistentCrosshair.style.display='block';",
      "cmPersistentCrosshair.style.display='flex';"
    );

    // 2) Remove the arrow glyph. The round control itself is the draggable handle.
    src=src.replace(
      '>↕</button><strong id="cmRadiusValue">',
      '><span aria-hidden="true"></span></button><strong id="cmRadiusValue">'
    );

    // 3) Make the bottom radius UI a thinner, quieter four-part bar.
    const style=`<style id="cmV27PlacementStyle">
      .cm-radius-gauge{
        bottom:calc(118px + env(safe-area-inset-bottom))!important;
        width:auto!important;
        min-width:0!important;
        padding:3px 5px!important;
        border:1px solid rgba(138,107,49,.14)!important;
        border-radius:999px!important;
        background:rgba(255,253,247,.28)!important;
        -webkit-backdrop-filter:blur(8px)!important;
        backdrop-filter:blur(8px)!important;
        box-shadow:0 1px 5px rgba(0,0,0,.07)!important;
      }
      .cm-radius-gauge-head.cm-radius-gauge-compact{
        display:grid!important;
        grid-template-columns:28px 40px 62px 16px!important;
        gap:4px!important;
        align-items:center!important;
      }
      .cm-radius-gauge-head.cm-radius-gauge-compact strong{
        font-size:12px!important;
        line-height:1!important;
        text-align:center!important;
      }
      .cm-radius-hint{
        width:28px!important;
        height:28px!important;
        border:1px solid rgba(93,81,65,.10)!important;
        border-radius:50%!important;
        background:rgba(255,255,255,.30)!important;
        padding:0!important;
        display:grid!important;
        place-items:center!important;
        opacity:.88!important;
        touch-action:none!important;
        cursor:ns-resize!important;
      }
      .cm-radius-hint>span{
        display:block;
        width:8px;
        height:8px;
        border-radius:50%;
        background:rgba(93,81,65,.48);
        box-shadow:0 0 0 2px rgba(255,255,255,.42);
        pointer-events:none;
      }
      .cm-radius-hint.dragging{
        transform:scale(1.08)!important;
        background:rgba(255,255,255,.52)!important;
        opacity:1!important;
      }
      .cm-confirm-place{
        height:28px!important;
        min-height:28px!important;
        margin:0!important;
        padding:0 11px!important;
        border:1px solid rgba(138,107,49,.22)!important;
        border-radius:999px!important;
        background:rgba(255,248,230,.52)!important;
        font-size:12px!important;
        line-height:1!important;
        box-shadow:none!important;
      }
      .cm-add-mode-close{
        width:16px!important;
        height:16px!important;
        border-radius:50%!important;
        background:rgba(238,229,212,.34)!important;
        font-size:11px!important;
        line-height:1!important;
        padding:0!important;
        opacity:.82!important;
      }
    </style>`;
    if(!src.includes('id="cmV27PlacementStyle"'))src=src.replace('</head>',style+'</head>');

    // 4) Harden the intended interaction: map taps never place while add mode is active.
    const mapClickStart=src.indexOf('function cmMapClick(e){');
    if(mapClickStart>=0){
      const mapClickEnd=src.indexOf('}',mapClickStart);
      if(mapClickEnd>mapClickStart){
        const current=src.slice(mapClickStart,mapClickEnd+1);
        if(current.includes('if(cmAddMode)return')){
          // already correct in v24+
        }
      }
    }

    // 5) Keep preview creation disabled. Confirm remains the sole placement action.
    const previewStart=src.indexOf('function cmPreviewAt(');
    const animateStart=previewStart>=0?src.indexOf('function cmAnimateMarker(',previewStart):-1;
    if(previewStart>=0&&animateStart>=0){
      src=src.slice(0,previewStart)+'function cmPreviewAt(){return}\n'+src.slice(animateStart);
    }

    return src;
  };
})();
