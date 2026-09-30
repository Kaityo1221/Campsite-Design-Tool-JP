(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    if(src.includes('cmD11UnifiedDefaultMode'))return src;

    src=src.replace(
      "function cmUnifiedRendererInteractive(){try{return new URLSearchParams(location.search).get('unifiedRenderer')==='interactive'}catch(_){return false}}\nfunction cmUnifiedRendererVisible(){try{const mode=new URLSearchParams(location.search).get('unifiedRenderer');return mode==='visible'||mode==='interactive'}catch(_){return cmUnifiedRendererInteractive()}}",
      `/* cmD11UnifiedDefaultMode */
function cmUnifiedRendererMode(){
  try{
    const mode=new URLSearchParams(location.search).get('unifiedRenderer');
    if(mode===null||mode==='')return'interactive';
    if(mode==='interactive'||mode==='visible'||mode==='legacy')return mode;
    return'legacy';
  }catch(_){return'interactive'}
}
function cmUnifiedRendererInteractive(){return cmUnifiedRendererMode()==='interactive'}
function cmUnifiedRendererVisible(){const mode=cmUnifiedRendererMode();return mode==='visible'||mode==='interactive'}`
    );

    return src;
  };
})();
