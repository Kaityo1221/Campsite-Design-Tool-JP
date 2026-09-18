(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const oldHtml="d.innerHTML='<div class=\"cm-radius-gauge-head\"><button id=\"cmRadiusHandle\" class=\"cm-radius-hint\" type=\"button\" aria-label=\"上下にスライドして距離円を変更\" title=\"上下にスライドして距離円を変更\">↕</button><strong id=\"cmRadiusValue\">50m</strong><button id=\"cmAddModeClose\" class=\"cm-add-mode-close\" type=\"button\" aria-label=\"追加を終了\">×</button></div><input id=\"cmRadiusRange\" type=\"range\" min=\"30\" max=\"50\" step=\"10\" value=\"50\" tabindex=\"-1\" aria-hidden=\"true\"><div class=\"cm-radius-gauge-marks\"><span>30</span><span>40</span><span>50m</span></div><button id=\"cmConfirmPlace\" class=\"cm-confirm-place\" type=\"button\">確定</button>';";
    const newHtml="d.innerHTML='<div class=\"cm-radius-gauge-head cm-radius-gauge-compact\"><button id=\"cmRadiusHandle\" class=\"cm-radius-hint\" type=\"button\" aria-label=\"上下にスライドして距離円を変更\" title=\"上下にスライドして距離円を変更\">↕</button><strong id=\"cmRadiusValue\">50m</strong><button id=\"cmConfirmPlace\" class=\"cm-confirm-place\" type=\"button\">確定</button><button id=\"cmAddModeClose\" class=\"cm-add-mode-close\" type=\"button\" aria-label=\"追加を終了\">×</button></div><input id=\"cmRadiusRange\" type=\"range\" min=\"30\" max=\"50\" step=\"10\" value=\"50\" tabindex=\"-1\" aria-hidden=\"true\">';";
    if(src.includes(oldHtml))src=src.replace(oldHtml,newHtml);

    src=src.replace(
      ".cm-radius-gauge{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1510;width:150px;padding:7px 9px 8px;border:1px solid rgba(138,107,49,.28);border-radius:13px;background:rgba(255,253,247,.58);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 3px 10px rgba(0,0,0,.12);color:#382d1d;display:none}",
      ".cm-radius-gauge{position:fixed;left:50%;bottom:calc(126px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1510;width:auto;min-width:196px;padding:5px 7px;border:1px solid rgba(138,107,49,.18);border-radius:999px;background:rgba(255,253,247,.38);-webkit-backdrop-filter:blur(9px);backdrop-filter:blur(9px);box-shadow:0 2px 8px rgba(0,0,0,.08);color:#382d1d;display:none}"
    );

    src=src.replace(
      ".cm-radius-gauge-head{display:grid;grid-template-columns:1fr auto 22px;gap:5px;align-items:center;font-size:10px;font-weight:900;line-height:1}.cm-radius-gauge-head strong{font-size:12px}.cm-radius-hint{width:30px;height:30px;border:0;border-radius:9px;background:rgba(255,255,255,.34);color:#5d5141;font-size:18px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center;opacity:.72;touch-action:none;cursor:ns-resize;transition:transform .12s ease,background .12s ease}.cm-radius-hint.dragging{transform:scale(1.1);background:rgba(255,255,255,.56);opacity:1}.cm-add-mode-close{width:20px;height:20px;border:0;border-radius:50%;background:rgba(238,229,212,.66);color:#5d4630;font-size:14px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center}",
      ".cm-radius-gauge-head.cm-radius-gauge-compact{display:grid;grid-template-columns:32px 44px 72px 20px;gap:6px;align-items:center}.cm-radius-gauge-head.cm-radius-gauge-compact strong{font-size:13px;text-align:center}.cm-radius-hint{width:32px;height:32px;border:0;border-radius:50%;background:rgba(255,255,255,.32);color:#5d5141;font-size:18px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center;opacity:.78;touch-action:none;cursor:ns-resize;transition:transform .12s ease,background .12s ease}.cm-radius-hint.dragging{transform:scale(1.1);background:rgba(255,255,255,.58);opacity:1}.cm-add-mode-close{width:18px;height:18px;border:0;border-radius:50%;background:rgba(238,229,212,.46);color:#5d4630;font-size:12px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center}"
    );

    src=src.replace(
      ".cm-radius-gauge-marks{display:grid;grid-template-columns:repeat(3,1fr);margin-top:6px;font-size:9px;font-weight:850;color:rgba(83,70,49,.64);text-align:center}.cm-radius-gauge-marks span:first-child{text-align:left}.cm-radius-gauge-marks span:last-child{text-align:right}.cm-confirm-place{display:block;width:100%;min-height:34px;margin-top:5px;border:1px solid rgba(138,107,49,.42);border-radius:10px;background:rgba(255,248,230,.82);color:#382d1d;font-size:14px;font-weight:950;box-shadow:none}",
      ".cm-radius-gauge-marks{display:none!important}.cm-confirm-place{height:32px;min-height:32px;margin:0;border:1px solid rgba(138,107,49,.28);border-radius:999px;background:rgba(255,248,230,.62);color:#382d1d;font-size:13px;font-weight:950;box-shadow:none;padding:0 14px}"
    );

    return src;
  };
})();
