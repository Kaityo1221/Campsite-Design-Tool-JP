(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV49RemoveAddTextStyle">
      #cmV45AddFlash,#cmFabAddHint{display:none!important;visibility:hidden!important;opacity:0!important;animation:none!important}
    </style>`;
    if(!src.includes('id="cmV49RemoveAddTextStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV49RemoveAddTextRuntime">
(()=>{
  const removeAddText=()=>{
    document.getElementById('cmV45AddFlash')?.remove();
    document.getElementById('cmFabAddHint')?.remove();
  };
  removeAddText();
  new MutationObserver(removeAddText).observe(document.body,{childList:true,subtree:true});
})();
</script>`;
    if(!src.includes('id="cmV49RemoveAddTextRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
