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

    const style=`<style id="cmV76RadiusReferenceStyle">
      .cm-safe-add-lever{overflow:visible!important}
      .cm-safe-reference-label{position:absolute;left:0;top:0;width:76px;text-align:center;color:rgba(83,70,49,.68);font-size:9px;font-weight:900;line-height:1;letter-spacing:.02em}
      .cm-safe-add-labels{top:18px!important}
      .cm-safe-add-track{margin-top:6px}
      .cm-safe-radius-readout{display:grid;place-items:center;gap:2px;min-width:46px;line-height:1}
      .cm-safe-radius-readout strong{font-size:12px;text-align:center}
      .cm-safe-radius-readout small{font-size:8px;font-weight:900;color:rgba(83,70,49,.66);white-space:nowrap}
    </style>`;
    if(!src.includes('id="cmV76RadiusReferenceStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
