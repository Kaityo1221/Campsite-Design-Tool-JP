/* Creative Next r28: source-identical v6/v71 bottom sheet structure and class names.
 * Existing POIs: browse only. New POIs: edit via isolated engine with one history
 * entry per completed name/memo draft. Never call old Creative scripts or storage.
 * All dynamic text uses textContent/value, never user-provided innerHTML.
 */
const types=Object.freeze([
 {kind:'pokestop',label:'PokéStop',icon:'../assets/pokestop.png'},
 {kind:'gym',label:'Gym',icon:'../assets/gym.png'},
 {kind:'power',label:'PowerSpot',icon:'../assets/powerspot.png'}
]);
const typeName=kind=>types.find(x=>x.kind===kind)?.label||kind;
export function createOriginalNewPoiSheet({document,map,session,onChanged,onMessage,onMoveRequest,confirm=globalThis.confirm}={}){
 if(!document?.createElement||!document?.body||!session?.state||!session?.command||typeof onChanged!=='function')
  throw new TypeError('Creative Next isolated sheet dependencies are required');
 let sheet=null,edit=null,disposed=false;
 const tell=s=>onMessage?.(String(s).slice(0,120));
 const lookup=id=>session.state().records.find(p=>p.id===id&&!p.deleted);
 const command=(action,message)=>{
  const current=lookup(action.id);
  if(!current||current.role!=='new'){tell('既存POIは閲覧のみです');return false;}
  try{
   const result=session.command(action,{confirmed:true});
   if(result?.changed===true){onChanged();if(message)tell(message);return true;}
   if(result?.ok===true&&!result.changed)return true;
   tell(result?.error?.message||result?.error?.code||'変更を保留しました');
  }catch(error){tell('編集を保留しました：'+String(error?.code||error?.message||'UNKNOWN'));}
  return false;
 };
 function commitDraft(){
  if(!edit)return true;
  const {id,name,memo}=edit,now=lookup(id);
  if(!now||now.role!=='new')return false;
  const title=name.value.trim().slice(0,30)||now.title;
  const note=memo.value.slice(0,50);
  if(title===now.title&&note===now.memo)return true;
  // Explicitly coalesce the two fields into one undoable editor command.
  const applied=command({type:'edit',id,patch:{title,memo:note}},'名前・メモを更新しました');
  if(applied){name.value=title;memo.value=note;}
  return applied;
 }
 function close({save=true}={}){
  if(!sheet)return true;
  if(save&&!commitDraft())return false;
  sheet.remove();sheet=null;edit=null;
  return true;
 }
 function swipeHandle(node){
  const handle=node.querySelector('.cm-sheet-handle');if(!handle)return;
  let initial=null;
  handle.addEventListener('touchstart',e=>{if(e.touches.length===1)initial=e.touches[0].clientY},{passive:true});
  handle.addEventListener('touchend',e=>{
   if(initial===null||e.changedTouches.length!==1){initial=null;return;}
   const amount=e.changedTouches[0].clientY-initial;initial=null;
   if(amount>65)close();
  },{passive:true});
  handle.addEventListener('touchcancel',()=>{initial=null},{passive:true});
 }
 function button(label,classes=''){
  const el=document.createElement('button');el.type='button';el.textContent=label;
  if(classes)el.className=classes;
  return el;
 }
 function makeShell(){
  const el=document.createElement('div');el.className='cm-sheet';
  const handle=document.createElement('div');handle.className='cm-sheet-handle';
  const head=document.createElement('div');head.className='cm-sheet-head';
  const strong=document.createElement('strong'),closeBtn=button('×','cm-sheet-close');
  head.append(strong,closeBtn);el.append(handle,head);
  closeBtn.addEventListener('click',()=>close());
  return {el,strong};
 }
 function field(parent,labelText,tag,id,value,maxLength){
  const outer=document.createElement('div');outer.className='cm-field';
  const label=document.createElement('label');label.textContent=labelText;
  const control=document.createElement(tag);control.id=id;control.maxLength=maxLength;
  control.value=String(value||'').slice(0,maxLength);
  label.setAttribute('for',id);
  outer.append(label,control);parent.append(outer);
  return control;
 }
 function show(id){
  if(disposed)return false;
  if(!close())return false;
  const record=lookup(id);if(!record)return false;
  const {el,strong}=makeShell();
  strong.textContent=record.role==='new'?typeName(record.kind):(record.title||'名称なし');
  if(record.role!=='new'){
   // Existing records are never writable, even if old r27 popup allowed editing.
   const layer=document.createElement('div');layer.className='popup-layer';
   layer.textContent=typeName(record.kind);
   const info=document.createElement('div');info.className='cm-existing-readonly';
   info.textContent='既存POI（閲覧のみ）';
   el.append(layer,info);
  }else{
   const name=field(el,'名前（30文字まで）','input','cmName',record.title,30);
   const memo=field(el,'メモ（50文字まで）','textarea','cmMemo',record.memo,50);
   edit={id,name,memo};
   const actions=document.createElement('div');actions.className='cm-actions';
   const move=button('移動'),changeType=button('種類変更'),remove=button('削除','danger');
   actions.append(move,changeType,remove);el.append(actions);
   const picker=document.createElement('div');picker.className='cm-type-picker';picker.id='cmTypePicker';
   for(const t of types){
    const b=button('');b.title=t.label;b.dataset.layer='new-'+t.kind;
    const img=document.createElement('img');img.src=t.icon;img.alt=t.label;
    b.append(img);b.addEventListener('click',()=>{
     const now=lookup(id);if(!now||now.role!=='new')return tell('既存POIは変更できません');
     if(!commitDraft())return;
     if(t.kind===now.kind){picker.classList.remove('open');return;}
     if(confirm('このPOIの種類を変更しますか？')!==true)return;
     if(command({type:'change-kind',id,kind:t.kind},'種類を変更しました')){close({save:false});show(id);}
    });picker.append(b);
   }
   el.append(picker);
   changeType.addEventListener('click',()=>picker.classList.toggle('open'));
   move.addEventListener('click',()=>{
    if(!commitDraft())return;
    const now=lookup(id);if(!now||now.role!=='new')return tell('既存POIは移動できません');
    if(close({save:false}))onMoveRequest?.(id);
   });
   remove.addEventListener('click',()=>{
    if(confirm('このPOIを削除しますか？')!==true)return;
    if(command({type:'delete',id},'POIを削除しました'))close({save:false});
   });
  }
  document.body.append(el);sheet=el;swipeHandle(el);return true;
 }
 return Object.freeze({show,close,dispose(){disposed=true;close({save:false});}});
}
