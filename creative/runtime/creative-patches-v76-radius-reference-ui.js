(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Phase D is presentation-only. The placement standard remains 50m;
    // the 50/40/30m lever changes only the reference circle radius.
    const oldBar="d.innerHTML='<button id=\"cmSafeAddLever\" class=\"cm-safe-add-lever\" type=\"button\" aria-label=\"上下にスライドして距離円を変更\"><span class=\"cm-safe-add-labels\"><i>50</i><i>40</i><i>30</i></span><span class=\"cm-safe-add-track\"></span><span id=\"cmSafeAddKnob\" class=\"cm-safe-add-knob\"></span></button><strong id=\"cmSafeAddRadiusValue\">50m</strong><button id=\"cmSafeAddConfirm\" class=\"cm-safe-add-confirm\" type=\"button\">確定</button><button id=\"cmSafeAddCancel\" class=\"cm-safe-add-cancel\" type=\"button\" aria-label=\"追加を終了\">×</button>';";
    const newBar="d.innerHTML='<button id=\"cmSafeAddLever\" class=\"cm-safe-add-lever\" type=\"button\" aria-label=\"上下にスライドして参考円を変更\"><span class=\"cm-safe-reference-label\">参考円</span><span class=\"cm-safe-add-labels\"><i>50</i><i>40</i><i>30</i></span><span class=\"cm-safe-add-track\"></span><span id=\"cmSafeAddKnob\" class=\"cm-safe-add-knob\"></span></button><span class=\"cm-safe-radius-readout\"><strong id=\"cmSafeAddRadiusValue\">50m</strong><small>基準 50m</small></span><button id=\"cmSafeAddConfirm\" class=\"cm-safe-add-confirm\" type=\"button\">確定</button><button id=\"cmSafeAddCancel\" class=\"cm-safe-add-cancel\" type=\"button\" aria-label=\"追加を終了\">×</button>';";
    if(src.includes(oldBar))src=src.replace(oldBar,newBar);
    const phaseCBar=oldBar.replace("d.innerHTML='","d.innerHTML+='");
    const phaseCNewBar=newBar.replace("d.innerHTML='","d.innerHTML+='");
    if(src.includes(phaseCBar))src=src.replace(phaseCBar,phaseCNewBar);

    const style=`<style id="cmV76RadiusReferenceStyle">
      .cm-safe-add-bar{padding-top:20px!important}
      .cm-safe-add-bar::before{content:'参考円　50 / 40 / 30　　基準 50m';position:absolute;left:12px;right:12px;top:6px;text-align:center;color:rgba(83,70,49,.72);font-size:9px;font-weight:950;line-height:1;white-space:nowrap;pointer-events:none}
      .cm-safe-add-lever{overflow:visible!important}
      .cm-safe-reference-label{display:none!important}
      .cm-safe-add-labels{top:12px!important}
      .cm-safe-add-track{margin-top:0}
      .cm-safe-radius-readout{display:grid;place-items:center;min-width:40px;line-height:1}
      .cm-safe-radius-readout strong{font-size:12px;text-align:center}
      .cm-safe-radius-readout small{display:none!important}
    </style>`;
    if(!src.includes('id="cmV76RadiusReferenceStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
