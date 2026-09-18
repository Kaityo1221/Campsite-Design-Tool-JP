(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const runtime=`
<script id="cmV37BottomDockRuntime">
(()=>{
  const sync=()=>{
    const active=!!(document.getElementById('cmSafeAddBar')||document.getElementById('cmMoveBar'));
    document.body.classList.toggle('cm-placement-docked',active);
  };
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{childList:true,subtree:true});
  sync();
})();
</script>`;
    if(!src.includes('id="cmV37BottomDockRuntime"'))src=src.replace('</body>',runtime+'</body>');

    const style=`<style id="cmV37BottomDockStyle">
      body.cm-placement-docked .bottom-bar,
      body.cm-placement-docked .save,
      body.cm-placement-docked .cm-fab-wrap,
      body.cm-placement-docked .toolbox,
      body.cm-placement-docked .toolmenu,
      body.cm-placement-docked .map-license{display:none!important}

      body.cm-placement-docked .cm-safe-add-bar,
      body.cm-placement-docked .cm-move-bar{
        bottom:calc(6px + env(safe-area-inset-bottom))!important;
        z-index:1800!important;
        margin:0!important;
      }

      body.cm-placement-docked .cm-safe-add-bar{
        width:min(330px,calc(100vw - 16px))!important;
      }
      body.cm-placement-docked .cm-move-bar{
        width:min(372px,calc(100vw - 12px))!important;
      }
    </style>`;
    if(!src.includes('id="cmV37BottomDockStyle"'))src=src.replace('</head>',style+'</head>');

    return src;
  };
})();
