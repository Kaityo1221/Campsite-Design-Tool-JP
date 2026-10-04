(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Unified owns the visible candidate marker. Preserve the legacy move affordance
    // by dimming that Unified marker while the current Creative move session is active.
    src=src.split('runtime/map-engine/map-renderer.js?v=5d14').join('runtime/map-engine/map-renderer.js?v=5d15');

    if(src.includes('cmV70UnifiedMoveFeedback'))return src;

    const coreStart=src.indexOf("(()=>{'use strict';");
    const coreEnd=coreStart>=0?src.indexOf('})();\n</script>',coreStart):-1;
    if(coreEnd>=0){
      const augment=`
/* cmV70UnifiedMoveFeedback */
const cmV70CandidateShadowScene=cmCandidateShadowScene;
cmCandidateShadowScene=function(){
  const scene=cmV70CandidateShadowScene();
  const movingId=String(cmMoveSession?.r?.id||'');
  if(!movingId||!Array.isArray(scene?.items))return scene;
  let changed=false;
  const items=scene.items.map(item=>{
    if(item?.origin!=='candidate'||item?.itemType!=='marker'||String(item?.ownerKey||'')!=='candidate:'+movingId)return item;
    changed=true;
    return Object.freeze({...item,style:Object.freeze({...item.style,opacity:.34})});
  });
  return changed?Object.freeze({items:Object.freeze(items)}):scene;
};
const cmV70BeginMove=cmBeginMove;
cmBeginMove=function(r){
  const result=cmV70BeginMove(r);
  if(cmMoveSession?.r===r)cmCandidateShadowRefresh('move-start',true);
  return result;
};
beginMove=cmBeginMove;
const cmV70EndMove=cmEndMove;
cmEndMove=function(){
  const hadSession=!!cmMoveSession;
  const result=cmV70EndMove();
  if(hadSession)cmCandidateShadowRefresh('move-end',true);
  return result;
};
`;
      src=src.slice(0,coreEnd)+augment+src.slice(coreEnd);
    }

    return src;
  };
})();
