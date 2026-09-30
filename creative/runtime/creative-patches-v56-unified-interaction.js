(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // D9 only transfers marker activation. records/history/edit flows stay owned by Creative Mode.
    src=src.split('runtime/map-engine/map-renderer.js?v=5d8').join('runtime/map-engine/map-renderer.js?v=5d9');

    const style=`<style id="cmD9UnifiedInteractionStyle">
      body.cm-unified-renderer-interactive .cm-engine-legacy-existing,
      body.cm-unified-renderer-interactive .cm-engine-legacy-candidate{pointer-events:none!important}
      body.cm-unified-renderer-interactive .cm-engine-existing-icon,
      body.cm-unified-renderer-interactive .cm-engine-candidate-icon{pointer-events:auto!important}
    </style>`;
    if(!src.includes('id="cmD9UnifiedInteractionStyle"'))src=src.replace('</head>',style+'</head>');

    src=src.replace(
      "function cmUnifiedRendererVisible(){try{return new URLSearchParams(location.search).get('unifiedRenderer')==='visible'}catch(_){return false}}",
      "function cmUnifiedRendererInteractive(){try{return new URLSearchParams(location.search).get('unifiedRenderer')==='interactive'}catch(_){return false}}\nfunction cmUnifiedRendererVisible(){try{const mode=new URLSearchParams(location.search).get('unifiedRenderer');return mode==='visible'||mode==='interactive'}catch(_){return cmUnifiedRendererInteractive()}}"
    );

    src=src.replace(
      "cmCandidateRendererVisible=function(){return cmUnifiedRendererVisible()||cmD8CandidateRendererVisible()};",
      `cmCandidateRendererVisible=function(){return cmUnifiedRendererVisible()||cmD8CandidateRendererVisible()};
function cmUnifiedRendererFindRecord(renderItem){
  const ownerKey=String(renderItem?.ownerKey||'');
  if(renderItem?.origin==='candidate'&&ownerKey.startsWith('candidate:')){
    const id=ownerKey.slice('candidate:'.length);
    return (records||[]).find(r=>r&&!r.deleted&&String(r.id||'')===id&&String(r.layer||'').startsWith('new-'))||null;
  }
  if(renderItem?.origin==='existing'&&ownerKey.startsWith('poi:')){
    const id=ownerKey.slice('poi:'.length);
    return (records||[]).find(r=>r&&!r.deleted&&String(r.guid||r.id||'')===id&&String(r.layer||'').startsWith('existing-'))||null;
  }
  return null;
}
function cmUnifiedRendererActivate(renderItem,event){
  if(!cmUnifiedRendererInteractive())return;
  try{if(event?.originalEvent)L.DomEvent.stopPropagation(event.originalEvent)}catch(_){}
  const record=cmUnifiedRendererFindRecord(renderItem);
  if(!record)return;
  try{if(typeof cmOpenRecord==='function')cmOpenRecord(record);else if(typeof recordPopup==='function')recordPopup(record)}catch(error){console.error('[Unified Interaction] open record failed',error)}
}`
    );

    src=src.replace(
      "cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0});",
      "cmCandidateShadowRenderer=window.bridgeMapLab_createMapRenderer(map,{opacity:visible?1:0,onMarkerActivate:cmUnifiedRendererInteractive()?cmUnifiedRendererActivate:null});"
    );

    if(!src.includes('cmD9UnifiedInteractionRuntime')){
      const coreStart=src.indexOf("(()=>{'use strict';");
      const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
      if(coreEnd>=0){
        const augment=`\n/* cmD9UnifiedInteractionRuntime */
const cmD9SyncLegacyMarkers=cmCandidateRendererSyncLegacyMarkers;
cmCandidateRendererSyncLegacyMarkers=function(){
  const result=cmD9SyncLegacyMarkers();
  try{document.body.classList.toggle('cm-unified-renderer-interactive',cmUnifiedRendererInteractive())}catch(_){}
  return result;
};
const cmD9Publish=cmCandidateShadowPublish;
cmCandidateShadowPublish=function(reason){
  cmD9Publish(reason);
  try{if(window.__cmCandidateShadowState)window.__cmCandidateShadowState={...window.__cmCandidateShadowState,interactive:cmUnifiedRendererInteractive(),interactionOwner:cmUnifiedRendererInteractive()?'map-engine':'legacy'};}catch(error){console.warn('[Unified Interaction] diagnostics publish failed',error)}
};
const cmD9Teardown=cmCandidateShadowTeardown;
cmCandidateShadowTeardown=function(){
  try{document.body.classList.remove('cm-unified-renderer-interactive')}catch(_){}
  return cmD9Teardown();
};
`;
        src=src.slice(0,coreEnd)+augment+src.slice(coreEnd);
      }
    }

    return src;
  };
})();
