(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    const style=`<style id="cmV62RemoveLocateStyle">
      #cmV45LocateFab{display:none!important}
    </style>`;
    if(!src.includes('id="cmV62RemoveLocateStyle"'))src=src.replace('</head>',style+'</head>');

    const runtime=`<script id="cmV62RemoveLocateRuntime">
(()=>{
  const fab=document.getElementById('cmV45LocateFab');
  if(fab)fab.remove();
})();
</script>`;
    if(!src.includes('id="cmV62RemoveLocateRuntime"'))src=src.replace('</body>',runtime+'</body>');

    return src;
  };
})();
