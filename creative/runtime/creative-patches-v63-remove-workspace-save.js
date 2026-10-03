(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV63RemoveWorkspaceSaveStyle">
      #cmStandaloneWorkspaceSave{display:none!important}
    </style>`;
    if(!src.includes('id="cmV63RemoveWorkspaceSaveStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV63RemoveWorkspaceSaveRuntime">
(()=>{
  const removeManualSave=()=>{
    const manual=document.getElementById('cmStandaloneWorkspaceSave');
    if(manual)manual.remove();
  };
  removeManualSave();
  new MutationObserver(removeManualSave).observe(document.body,{childList:true,subtree:true});
})();
</script>`;
    if(!src.includes('id="cmV63RemoveWorkspaceSaveRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
