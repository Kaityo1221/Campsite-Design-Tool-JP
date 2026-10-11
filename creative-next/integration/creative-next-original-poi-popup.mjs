/* Isolated r27: original Creative Mode popup classes and element arrangement.
 * Real edits run solely through the confirmed Creative Next session.
 * User-supplied titles and memo are always written as text/value, never as HTML.
 * No localStorage/IndexedDB access, no legacy event handlers.
 */
const definitions=Object.freeze([
 ['existing-pokestop','既存 PokéStop'],['existing-gym','既存 Gym'],['existing-power','既存 PowerSpot'],
 ['new-pokestop','新規 PokéStop'],['new-gym','新規 Gym'],['new-power','新規 PowerSpot']
]);
export function createOriginalPoiPopup({document,L,map,session,onChanged,onMessage,onMoveRequest}={}){
 if(!document?.createElement||!L?.popup||!map||!session?.state||!session?.command||typeof onChanged!=='function')throw new TypeError('Mounted isolated POI editor required');
 let disposed=false;
 const notify=msg=>onMessage?.(msg);
 const current=id=>session.state().records.find(p=>p.id===id&&!p.deleted);
 function apply(command,label){
  if(disposed)return false;
  try{
   const result=session.command(command,{confirmed:true});
   if(result?.changed===true){map.closePopup();onChanged();notify(label+'。↩ 戻るで取り消せます（自動保存なし）');return true;}
   notify(result?.error?.message||result?.error?.code||'変更はありませんでした');
  }catch(error){notify('編集を保留しました：'+String(error?.code||error?.message||'UNKNOWN').slice(0,70));}
  return false;
 }
 function show(id){
  if(disposed)return false;
  const record=current(id);if(!record)return false;
  const wrap=document.createElement('div');
  wrap.className='popup-form';
  // Original UI structure and class names. The interpolation-free HTML is constant.
  wrap.innerHTML='<div class="popup-head"><button id="editBtn">✏️ 編集</button><button id="deleteBtn" class="danger">Delete</button></div>'+
   '<div class="popup-title"></div><div class="popup-layer"></div>'+
   '<div class="popup-edit"><input id="editTitle" placeholder="タイトル"><textarea id="editMemo" placeholder="メモ"></textarea><button id="saveEdit">保存</button></div>'+
   '<div class="popup-actions"><select id="moveLayer"></select><button id="applyLayer">このレイヤーへ移動</button></div>';
  const find=id=>wrap.querySelector('#'+id);
  wrap.querySelector('.popup-title').textContent=record.title||'名称なし';
  wrap.querySelector('.popup-layer').textContent=definitions.find(x=>x[0]===record.role+'-'+record.kind)?.[1]||record.kind;
  const select=find('moveLayer');
  for(const [key,label] of definitions.filter(x=>x[0].startsWith(record.role+'-'))){
   const option=document.createElement('option');
   option.value=key;option.textContent=label;option.selected=key===record.role+'-'+record.kind;
   select.append(option);
  }
  if(record.role==='new'){
   const move=document.createElement('button');move.id='movePos';move.textContent='位置を調整';
   wrap.querySelector('.popup-actions').append(move);
   move.addEventListener('click',()=>{
    if(!current(id))return notify('POIが見つかりません');
    map.closePopup();onMoveRequest?.(id);
   });
  }
  find('editBtn').addEventListener('click',()=>{
   const latest=current(id);if(!latest)return notify('POIが見つかりません');
   wrap.querySelector('.popup-edit').classList.add('open');
   find('editTitle').value=latest.title;find('editMemo').value=latest.memo;
  });
  find('saveEdit').addEventListener('click',()=>{
   const latest=current(id);if(!latest)return notify('POIが見つかりません');
   const title=find('editTitle').value.trim(),memo=find('editMemo').value.trim();
   if(!title)return notify('POIの名前が必要です');
   apply({type:'edit',id,patch:{title,memo}},'名称・メモを編集しました');
  });
  find('deleteBtn').addEventListener('click',()=>{
   if(!current(id))return notify('POIが見つかりません');
   if(globalThis.confirm('このスポットを削除しますか？ 編集内容は元のKMZには反映されません。'))
     apply({type:'delete',id},'スポットを削除しました');
  });
  find('applyLayer').addEventListener('click',()=>{
   const latest=current(id);if(!latest)return notify('POIが見つかりません');
   const selected=select.value;
   if(!definitions.some(x=>x[0]===selected)||!selected.startsWith(latest.role+'-'))return notify('既存／新規区分は変更できません');
   const kind=selected.slice(latest.role.length+1);
   if(kind===latest.kind){map.closePopup();return;}
   if(!globalThis.confirm('このスポットの種類を変更しますか？'))return;
   apply({type:'change-kind',id,kind},'レイヤーを変更しました');
  });
  L.DomEvent?.disableClickPropagation?.(wrap);
  L.DomEvent?.disableScrollPropagation?.(wrap);
  L.popup({offset:[0,-8],closeButton:false}).setLatLng([record.lat,record.lng]).setContent(wrap).openOn(map);
  return true;
 }
 return Object.freeze({show,dispose(){disposed=true;map.closePopup();}});
}
