(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const oldHtml="d.innerHTML='<div class=\"cm-radius-gauge-head\"><span>距離円</span><strong id=\"cmRadiusValue\">50m</strong></div><input id=\"cmRadiusRange\" type=\"range\" min=\"30\" max=\"50\" step=\"10\" value=\"50\" aria-label=\"距離円\"><div class=\"cm-radius-gauge-labels\"><button type=\"button\" data-r=\"30\">30m</button><button type=\"button\" data-r=\"40\">40m</button><button type=\"button\" data-r=\"50\">50m</button></div>';";
    const newHtml="d.innerHTML='<div class=\"cm-radius-gauge-head\"><span>距離円</span><strong id=\"cmRadiusValue\">50m</strong><button id=\"cmAddModeClose\" class=\"cm-add-mode-close\" type=\"button\" aria-label=\"追加を終了\">×</button></div><input id=\"cmRadiusRange\" type=\"range\" min=\"30\" max=\"50\" step=\"10\" value=\"50\" aria-label=\"距離円\"><div class=\"cm-radius-gauge-labels\"><button type=\"button\" data-r=\"30\">30m</button><button type=\"button\" data-r=\"40\">40m</button><button type=\"button\" data-r=\"50\">50m</button></div>';";
    if(src.includes(oldHtml))src=src.replace(oldHtml,newHtml);

    const hook="d.querySelectorAll('[data-r]').forEach(b=>b.onclick=()=>cmSetGuideRadius(Number(b.dataset.r)));";
    if(src.includes(hook)){
      src=src.replace(hook,hook+"\n  d.querySelector('#cmAddModeClose')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();cmExitAddMode(false);msg('POI追加を終了しました',1200)});");
    }

    const styleNeedle=".cm-radius-gauge-head{display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:900;line-height:1}.cm-radius-gauge-head strong{font-size:12px}";
    const styleReplacement=".cm-radius-gauge-head{display:grid;grid-template-columns:1fr auto 30px;gap:6px;align-items:center;font-size:10px;font-weight:900;line-height:1}.cm-radius-gauge-head strong{font-size:12px}.cm-add-mode-close{width:28px;height:28px;border:0;border-radius:50%;background:#eee5d4;color:#5d4630;font-size:19px;font-weight:900;line-height:1;padding:0;display:grid;place-items:center}";
    if(src.includes(styleNeedle))src=src.replace(styleNeedle,styleReplacement);

    return src;
  };
})();
