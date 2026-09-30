(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    if(src.includes('cmD11DevDefaultRenderer'))return src;

    src=src.replace(
      "function cmUnifiedRendererInteractive(){try{return new URLSearchParams(location.search).get('unifiedRenderer')==='interactive'}catch(_){return false}}",
      `/* cmD11DevDefaultRenderer */
function cmD11LegacyRendererRequested(){try{return new URLSearchParams(location.search).get('rendererMode')==='legacy'}catch(_){return false}}
function cmUnifiedRendererInteractive(){
  try{
    const params=new URLSearchParams(location.search);
    if(params.get('rendererMode')==='legacy')return false;
    const unified=params.get('unifiedRenderer');
    if(unified!==null)return unified==='interactive';
    if(params.get('candidateRenderer')!==null)return false;
    return true;
  }catch(_){return true}
}`
    );

    src=src.replace(
      "function cmUnifiedRendererVisible(){try{const mode=new URLSearchParams(location.search).get('unifiedRenderer');return mode==='visible'||mode==='interactive'}catch(_){return cmUnifiedRendererInteractive()}}",
      `function cmUnifiedRendererVisible(){
  try{
    const params=new URLSearchParams(location.search);
    if(params.get('rendererMode')==='legacy')return false;
    const mode=params.get('unifiedRenderer');
    if(mode!==null)return mode==='visible'||mode==='interactive';
    if(params.get('candidateRenderer')!==null)return false;
    return true;
  }catch(_){return true}
}`
    );

    src=src.replace(
      "cmCandidateRendererVisible=function(){return cmUnifiedRendererVisible()||cmD8CandidateRendererVisible()};",
      "cmCandidateRendererVisible=function(){if(cmD11LegacyRendererRequested())return false;return cmUnifiedRendererVisible()||cmD8CandidateRendererVisible()};"
    );

    if(!src.includes('cmD11DevDefaultDiagnostics')){
      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const augment=`\n/* cmD11DevDefaultDiagnostics */
const cmD11Publish=cmCandidateShadowPublish;
cmCandidateShadowPublish=function(reason){
  cmD11Publish(reason);
  try{
    if(window.__cmCandidateShadowState){
      const params=new URLSearchParams(location.search);
      const explicit=!!(params.get('unifiedRenderer')||params.get('candidateRenderer')||params.get('rendererMode'));
      window.__cmCandidateShadowState={...window.__cmCandidateShadowState,devDefaultUnified:!explicit,legacyOverride:cmD11LegacyRendererRequested()};
    }
  }catch(error){console.warn('[D11 Dev Default] diagnostics publish failed',error)}
};
function cmD11LegacyCandidateTarget(){
  if(!cmD11LegacyRendererRequested())return null;
  try{
    const record=(records||[]).find(r=>r&&!r.deleted&&String(r.layer||'').startsWith('new-'));
    const marker=record?.marker;
    const element=marker?.getElement?.();
    if(!record||!marker||!element)return null;
    const rect=element.getBoundingClientRect();
    const style=getComputedStyle(element);
    return Object.freeze({
      id:String(record.id||''),
      layer:String(record.layer||''),
      inMap:!!map?.hasLayer?.(marker),
      x:rect.left+rect.width/2,
      y:rect.top+rect.height/2,
      width:rect.width,
      height:rect.height,
      pointerEvents:String(style.pointerEvents||''),
      opacity:Number(style.opacity)
    });
  }catch(error){console.warn('[D11 Dev Default] legacy marker probe failed',error);return null}
}
window.__cmD11LegacyProbe=Object.freeze({getCandidateTarget:cmD11LegacyCandidateTarget});
`;
        src=src.slice(0,coreEnd)+augment+src.slice(coreEnd);
      }
    }

    return src;
  };
})();
