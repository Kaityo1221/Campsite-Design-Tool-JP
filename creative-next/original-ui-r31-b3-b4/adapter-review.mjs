import {createCreativeNextCommandBoundary} from '../integration/creative-next-command-boundary.mjs';
import {createCreativeNextReadFollower} from '../integration/creative-ui-read-follower.mjs';
const ownedSessions=new WeakSet(),ownedUI=new WeakSet();
const AREA=new Set(['area-create','area-redraw','area-delete','area-replace']);
const POI=new Set(['add','edit','move','change-kind','delete']),kinds=new Set(['pokestop','gym','power']);
const hold=reason=>({status:'HOLD',changed:false,reason});
export function connectB2({session,ui,document=null,confirmEdit=()=>false}={}){
 if(!session?.state||!ui?.onCommand)throw Error('EXPLICIT_SESSION_AND_B1_UI_REQUIRED');
 if(ownedSessions.has(session)||ownedUI.has(ui))throw Error('B1_ALREADY_CONNECTED');
 const appearance=ui.status?.();if(appearance?.mapCount!==1||appearance.stopped||appearance.dataConnected===true)throw Error('B1_SINGLE_UI_MAP_REQUIRED');
 const initial=session.state();if(initial.hasPending!==false||initial.revision!==null||initial.sourceIsolated!==true||!initial.hasActive||initial.recoveredFallback||initial.history?.undo!==0||initial.history?.redo!==0)throw Error('B1_VERIFIED_BASELINE_REQUIRED');
 ownedSessions.add(session);ownedUI.add(ui);
 let engine=session,stopped=false,fault=false,sequence=0,refreshes=0,view=null,expected=JSON.stringify(initial);
 const usedAreaIds=new Set(initial.areas.map(a=>a.id));
 const seen=new Set(),pending=new Map(),listeners=[];
 const follower=createCreativeNextReadFollower(session,{render(projection){
  const details=new Map(engine.state().records.map(p=>[p.id,p]));
  view={pois:projection.records.map(p=>({id:p.id,role:p.role,kind:p.kind,title:p.title,memo:details.get(p.id)?.memo||'',lat:p.latlng[0],lng:p.latlng[1],deleted:false})),circles:projection.circles.map(c=>({ownerId:c.ownerId,lat:c.latlng[0],lng:c.latlng[1],radius:c.radius})),areas:projection.areas,history:projection.history};
  ui.setViewReader(()=>view);refreshes++;
 }});
 const boundary=createCreativeNextCommandBoundary({session,refresh:()=>follower.refresh(),confirmAction:()=>true});
 function dispatch(action,{confirmed=false}={}){
  if(stopped)return hold('B1_STOPPED');if(fault)return hold('B1_RENDER_FAULT');
  if(!action||(!POI.has(action.type)&&!AREA.has(action.type)&&!['undo','redo'].includes(action.type)))return hold('B1_SCOPE');
  if(!confirmed)return hold('EXPLICIT_CONFIRM_REQUIRED');
  if(JSON.stringify(engine.state())!==expected){fault=true;return hold('SESSION_CONFLICT');}
  if(typeof action.requestId!=='string'||!action.requestId.trim())return hold('REQUEST_ID_REQUIRED');
  if(seen.has(action.requestId))return hold('ALREADY_HANDLED');
  let payload;
  if(AREA.has(action.type)){
   if(action.type==='area-create'){
    if(action.id||action.metadata||action.ownerId)return hold('AREA_SOURCE_ID_HOLD');
    let id;do{id='area-r31-b2-'+(++sequence);}while(usedAreaIds.has(id));usedAreaIds.add(id);
    payload={type:'area-create',id,points:action.points};
   }else{
    if(typeof action.id!=='string'||!engine.state().areas.some(a=>a.id===action.id))return hold('AREA_NOT_FOUND');
    if(action.type==='area-replace'){
     if(action.metadata||action.ownerId)return hold('AREA_SOURCE_ID_HOLD');
     payload={type:'area-replace',id:action.id,points:action.points};
    }else payload={type:'area-remove',id:action.id};
   }
  }
  if(POI.has(action.type)){
   const kind=String(action.kind||'').replace(/^new-/,'');
   if(action.type==='add'){
    if(action.id||action.poi||action.metadata||(action.role&&action.role!=='new'))return hold('SOURCE_ADD_HOLD');
    if(!kinds.has(kind))return hold('UNKNOWN_KIND');
    payload={type:'add',poi:{role:'new',kind,title:({pokestop:'PokéStop',gym:'Gym',power:'PowerSpot'})[kind]+' '+(engine.state().records.filter(p=>p.role==='new'&&p.kind===kind&&!p.deleted).length+1),memo:'',lat:action.position?.lat,lng:action.position?.lng}};
   }else{
    const target=engine.state().records.find(p=>p.id===action.id);
    if(!target||target.role!=='new'||target.deleted)return hold('EXISTING_OR_UNKNOWN_POI_READ_ONLY');
    if(action.type==='edit'){
     const patch=action.patch;if(!patch||!Object.keys(patch).length||Object.keys(patch).some(k=>!['title','memo'].includes(k)))return hold('B1_UNSUPPORTED_FIELD');
     if(Object.entries(patch).some(([k,v])=>typeof v!=='string'||v.length>(k==='title'?30:50)))return hold('INVALID_TEXT');
     payload={type:'edit',id:target.id,patch:{...patch}};
    }else if(action.type==='move')payload={type:'move',id:target.id,lat:action.position?.lat,lng:action.position?.lng};
    else if(action.type==='change-kind'){if(!kinds.has(kind))return hold('UNKNOWN_KIND');payload={type:'change-kind',id:target.id,kind};}
    else payload={type:'delete',id:target.id};
   }
  }
  seen.add(action.requestId);
  const result=boundary.dispatch({type:POI.has(action.type)?'poi':AREA.has(action.type)?'area':action.type,payload,requestId:action.requestId});
  expected=JSON.stringify(engine.state());if(result.status==='APPLIED_RENDER_HOLD')fault=true;
  if(result.result?.error)return {...hold(result.result.error.code),result:result.result};
  return result;
 }
 function handle(action){
  if(action.type==='coordinate-add')return action.source==='new'?dispatch({...action,type:'add'},{confirmed:true}):hold('B1_NEW_ONLY');
  if(action.type==='edit'){
   const target=engine?.state().records.find(p=>p.id===action.id);if(!target||target.role!=='new')return hold('EXISTING_OR_UNKNOWN_POI_READ_ONLY');
   if(Object.keys(action.patch||{}).some(k=>!['title','memo'].includes(k)))return hold('B1_UNSUPPORTED_FIELD');
   pending.set(action.id,{...pending.get(action.id),...action.patch});return hold('EDIT_CONFIRM_REQUIRED');
  }
  return dispatch(action,{confirmed:true});
 }
 let cancelEdit=false,cancelledSheet=null;
 const addListener=(type,fn)=>{document?.addEventListener(type,fn,true);listeners.push(()=>document?.removeEventListener(type,fn,true));};
 addListener('pointerdown',event=>{cancelEdit=!!event.target?.closest?.('.cm-sheet-close,.cm-sheet-handle,#back');if(cancelEdit){cancelledSheet=document.querySelector('.cm-sheet');pending.clear();}else cancelledSheet=null;});
 addListener('change',event=>{
  if(stopped||!['cmName','cmMemo'].includes(event.target?.id))return;
  const id=ui.status().ui.selected,current=engine.state().records.find(p=>p.id===id);if(!current||current.role!=='new')return;
  const sheet=event.target.closest('.cm-sheet'),patch={};for(const [node,key]of [['#cmName','title'],['#cmMemo','memo']]){const value=sheet?.querySelector(node)?.value;if(value!==undefined&&value!==current[key])patch[key]=value;}if(!Object.keys(patch).length)return;
  if(cancelEdit&&sheet===cancelledSheet){pending.delete(id);cancelEdit=false;cancelledSheet=null;return;}cancelEdit=false;cancelledSheet=null;
  const approved=confirmEdit({id,patch:{...patch}})===true;
  if(approved){const result=dispatch({type:'edit',id,patch,requestId:'r31-b1-edit-'+(++sequence)},{confirmed:true});if(result.changed)pending.delete(id);const status=document?.getElementById('status');if(status){status.textContent=result.status==='APPLIED'?'操作を反映しました':result.changed?'HOLD：変更済みですが描画を確認できません':'HOLD：変更は反映されていません';status.classList.remove('fade');}}
  else{pending.delete(id);const p=engine.state().records.find(p=>p.id===id);if(p)event.target.value=p[event.target.id==='cmName'?'title':'memo'];}
 });
 addListener('keydown',event=>{if(event.key==='Enter'&&event.target?.id==='cmName'){event.preventDefault();event.target.blur();}});
 try{ui.onCommand(handle);follower.refresh();}catch(error){ui.onCommand(null);boundary.stop();follower.unsubscribe();for(const remove of listeners)remove();listeners.length=0;pending.clear();engine=null;ownedSessions.delete(session);ownedUI.delete(ui);ui.dispose();throw error;}
 return Object.freeze({dispatch,status:()=>({stopped,fault,refreshes,pendingEdits:pending.size,sessionCount:stopped?0:1,listeners:listeners.length,history:engine?.state().history}),dispose(){if(stopped)return;stopped=true;ui.onCommand(null);boundary.stop();follower.unsubscribe();for(const remove of listeners)remove();listeners.length=0;pending.clear();cancelledSheet=null;seen.clear();usedAreaIds.clear();view=null;engine=null;ui.dispose();}});
}
