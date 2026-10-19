(() => {
  'use strict';
  const COMMAND_EVENT='campsite-bridge-android-n4:polygon-command';
  const STATE_EVENT='campsite-bridge-android-n4:polygon-state';
  const BRIDGE_EVENT='campsite-bridge-android-n4:panel-state';
  let state={active:false,completed:false,paused:false,draftAvailable:false,pointCount:0,mode:'mobile'};
  let sessionRangeConfirmed=false;
  function publish(reason){
    window.dispatchEvent(new CustomEvent(BRIDGE_EVENT,{detail:JSON.stringify({
      reason,polygonState:state,sessionRangeConfirmed,
      ready:sessionRangeConfirmed&&state.completed===true&&state.active!==true
    })}));
  }
  window.addEventListener(STATE_EVENT,event=>{
    let next;
    try{next=JSON.parse(String(event.detail||'{}'));}catch(_){return;}
    if(!next||typeof next!=='object')return;
    const wasDrawing=state.active===true;
    state={...state,...next};
    if(state.active===true)sessionRangeConfirmed=false;
    else if(wasDrawing&&state.completed===true)sessionRangeConfirmed=true;
    publish('polygon-state');
  });
  window.addEventListener('campsite-bridge-android-n4:panel-command',event=>{
    let detail;
    try{detail=JSON.parse(String(event.detail||'{}'));}catch(_){return;}
    const action=String(detail?.action||'');
    if(!action)return;
    if(['start-new','resume-draft','edit-completed'].includes(action))sessionRangeConfirmed=false;
    window.dispatchEvent(new CustomEvent(COMMAND_EVENT,{detail:JSON.stringify({action,source:'android-bridge-panel',sentAt:new Date().toISOString()})}));
  });
  window.dispatchEvent(new CustomEvent(COMMAND_EVENT,{detail:JSON.stringify({action:'query-state',source:'android-bridge-panel-init',sentAt:new Date().toISOString()})}));
  window.CampsiteBridgeAndroidN4PanelAdapter=Object.freeze({commandEvent:COMMAND_EVENT,stateEvent:STATE_EVENT,bridgeEvent:BRIDGE_EVENT});
})();
