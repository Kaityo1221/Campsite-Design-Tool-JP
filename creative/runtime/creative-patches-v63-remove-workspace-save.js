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
  if(typeof cmOpenStandaloneSave!=='function'||cmOpenStandaloneSave.cmV63Wrapped)return;
  const original=cmOpenStandaloneSave;
  const wrapped=function(){
    const result=original.apply(this,arguments);
    const manual=document.getElementById('cmStandaloneWorkspaceSave');
    if(manual)manual.remove();
    return result;
  };
  wrapped.cmV63Wrapped=true;
  cmOpenStandaloneSave=wrapped;
})();
</script>`;
    if(!src.includes('id="cmV63RemoveWorkspaceSaveRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
