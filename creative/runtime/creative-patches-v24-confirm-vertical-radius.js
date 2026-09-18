(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Radius control: vertical gesture on selected icon only.
    // Keep a hidden range element for the existing radius logic, but remove the visible horizontal slider.
    const oldHtml="d.innerHTML='<div class=\"cm-radius-gauge-head\"><span>距離円</span><strong id=\"cmRadiusValue\">50m</strong><button id=\"cmAddModeClose\" class=\"cm-add-mode-close\" type=\"button\" aria-label=\"追加を終了\">×</button></div><input id=\"cmRadiusRange\" type=\"range\" min=\"30\" max=\"50\" step=\"10\" value=\"50\" aria-label=\"距離円\"><div class=\"cm-radius-gauge-labels\"><button type=\"button\" data-r=\"30\">30m</button><button type=\"button\" data-r=\"40\">40m</button><button type=\"button\" data-r=\"50\">50m</button></div>';";
    const newHtml="d.innerHTML='<div class=\"cm-radius-gauge-head\"><span class=\"cm-radius-hint\">↕</span><strong id=\"cmRadiusValue\">50m</strong><button id=\"cmAddModeClose\" class=\"cm-add-mode-close\" type=\"button\" aria-label=\"追加を終了\">×</button></div><input id=\"cmRadiusRange\" type=\"range\" min=\"30\" max=\"50\" step=\"10\" value=\"50\" tabindex=\"-1\" aria-hidden=\"true\"><div class=\"cm-radius-gauge-marks\"><span>30</span><span>40</span><span>50m</span></div><button id=\"cmConfirmPlace\" class=\"cm-confirm-place\" type=\"button\">確定</button>';";
    if(src.includes(oldHtml))src=src.replace(oldHtml,newHtml);

    // Confirm places one POI at the current center crosshair. Map taps no longer place POIs.
    const closeHook="d.querySelector('#cmAddModeClose')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();cmExitAddMode(false);msg('POI追加を終了しました',1200)});";
    if(src.includes(closeHook)){
      src=src.replace(closeHook,closeHook+"\n  d.querySelector('#cmConfirmPlace')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!cmAddMode)return;cmPlace(map.getCenter());cmEnsureCenterGuideCircle();});");
    }

    const oldMapClick="function cmMapClick(e){if(Date.now()<cmRadiusGestureUntil)return;if(cmSheet&&!cmAddMode){cmCloseSheet();return}if(cmAddMenuOpen){cmCloseAddMenu();return}if(cmAddMode)cmPlace(e.latlng)}";
    const newMapClick="function cmMapClick(e){if(Date.now()<cmRadiusGestureUntil)return;if(cmSheet&&!cmAddMode){cmCloseSheet();return}if(cmAddMenuOpen){cmCloseAddMenu();return}if(cmAddMode)return}";
    if(src.includes(oldMapClick))src=src.replace(oldMapClick,newMapClick);

    // Make the gauge quiet and translucent. The selected POI icon remains the vertical gesture target.
    const gaugeStyle=".cm-radius-gauge{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1510;width:178px;padding:8px 11px 7px;border:1px solid #8a6b31;border-radius:15px;background:rgba(255,253,247,.97);box-shadow:0 5px 16px rgba(0,0,0,.24);color:#382d1d;display:none}";
    const gaugeStyleNew=".cm-radius-gauge{position:fixed;left:50%;bottom:calc(132px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:1510;width:150px;padding:7px 9px 8px;border:1px solid rgba(138,107,49,.28);border-radius:13px;background:rgba(255,253,247,.58);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 3px 10px rgba(0,0,0,.12);color:#382d1d;display:none}";
    if(src.includes(gaugeStyle))src=src.replace(gaugeStyle,gaugeStyleNew);

    const oldHeadStyle=".cm-radius-gauge-head{display:grid;grid-template-columns:1fr auto 30px;gap:6px;align-items:center;font-size:10px;font-weight:900;line-height:1}.cm-radius-gauge-head strong{font-size:12px}.cm-add-mode-close{width:28px;height:28px;border:0;border-radius:50%;background:#eee5d4;color:#5d4630;font-size:19px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center}";
    const newHeadStyle=".cm-radius-gauge-head{display:grid;grid-template-columns:1fr auto 22px;gap:5px;align-items:center;font-size:10px;font-weight:900;line-height:1}.cm-radius-gauge-head strong{font-size:12px}.cm-radius-hint{font-size:15px;opacity:.58}.cm-add-mode-close{width:20px;height:20px;border:0;border-radius:50%;background:rgba(238,229,212,.66);color:#5d4630;font-size:14px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center}";
    if(src.includes(oldHeadStyle))src=src.replace(oldHeadStyle,newHeadStyle);

    const oldRangeStyle=".cm-radius-gauge input[type=range]{display:block;width:100%;margin:7px 0 2px;accent-color:#c69200}";
    const newRangeStyle=".cm-radius-gauge input[type=range]{display:none!important}";
    if(src.includes(oldRangeStyle))src=src.replace(oldRangeStyle,newRangeStyle);

    const labelsStyle=".cm-radius-gauge-labels{display:grid;grid-template-columns:repeat(3,1fr);align-items:center;font-size:9px;font-weight:900;color:#756650;text-align:center}.cm-radius-gauge-labels button{border:0;background:transparent;color:inherit;padding:2px 0;font:inherit}.cm-radius-gauge-labels button:first-child{text-align:left}.cm-radius-gauge-labels button:last-child{text-align:right}";
    const labelsStyleNew=".cm-radius-gauge-marks{display:grid;grid-template-columns:repeat(3,1fr);margin-top:6px;font-size:9px;font-weight:850;color:rgba(83,70,49,.64);text-align:center}.cm-radius-gauge-marks span:first-child{text-align:left}.cm-radius-gauge-marks span:last-child{text-align:right}.cm-confirm-place{display:block;width:100%;min-height:34px;margin-top:5px;border:1px solid rgba(138,107,49,.42);border-radius:10px;background:rgba(255,248,230,.82);color:#382d1d;font-size:14px;font-weight:950;box-shadow:none}";
    if(src.includes(labelsStyle))src=src.replace(labelsStyle,labelsStyleNew);

    return src;
  };
})();
