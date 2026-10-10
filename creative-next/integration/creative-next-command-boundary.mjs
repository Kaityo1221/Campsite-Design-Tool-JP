/* U3-C: command boundary for an EXISTING Creative UI.
 * Only explicit events routed here may mutate the isolated session.
 * No DOM event interception, browser storage, save, resume or legacy handlers.
 * Installation into production is intentionally not part of this module.
 */
const MUTATIONS=new Set(['poi','area','undo','redo']);
export function createCreativeNextCommandBoundary({session,refresh,confirmAction}={}){
 if(!session||typeof session.state!=='function'||typeof session.command!=='function'||
    typeof session.commandArea!=='function'||typeof session.undo!=='function'||typeof session.redo!=='function')
  throw new TypeError('Explicit isolated editor session required');
 if(typeof refresh!=='function'||typeof confirmAction!=='function')
  throw new TypeError('Refresh and explicit confirmation callbacks required');
 let stopped=false,busy=false;
 const inFlight=new Set();
 function dispatch({type,payload,requestId}={}){
  if(stopped)return {status:'STOPPED',changed:false};
  if(!MUTATIONS.has(type))return {status:'HOLD',changed:false,reason:'UNSUPPORTED_ACTION'};
  if(typeof requestId!=='string'||!requestId.trim())return {status:'HOLD',changed:false,reason:'REQUEST_ID_REQUIRED'};
  if(busy||inFlight.has(requestId))return {status:'HOLD',changed:false,reason:'IN_FLIGHT'};
  const state=session.state();
  if(!state.hasActive||state.recoveredFallback)return {status:'HOLD',changed:false,reason:'READ_ONLY_OR_NO_EDITOR'};
  busy=true;inFlight.add(requestId);
  try{
   // Return an explicit HOLD rather than presenting a fake completed action.
   if(confirmAction({type,payload,requestId})!==true)
    return {status:'CANCELLED',changed:false};
   const result=type==='poi'?session.command(payload,{confirmed:true})
     :type==='area'?session.commandArea(payload,{confirmed:true})
     :type==='undo'?session.undo():session.redo();
   if(result&&typeof result.then==='function')throw new Error('ASYNC_ACTION_NOT_SUPPORTED');
   // Refresh only after the isolated engine reports a committed state.
   const changed=result?.changed===true||result?.ok===true&&type!=='poi'&&type!=='area';
   if(changed)refresh();
   return {status:changed?'APPLIED':'NO_CHANGE',changed,result};
  }catch(error){return {status:'HOLD',changed:false,reason:error?.code||error?.message||'ACTION_FAILED'};}
  finally{inFlight.delete(requestId);busy=false}
 }
 return Object.freeze({dispatch,stop(){stopped=true},status:()=>({stopped,busy})});
}
