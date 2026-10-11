/* Creative Next r30: original v6 plus-FAB and original base-v7 centered
 * cyan draft rings/crosshair. The existing approved CSS is reused as-is.
 * New POIs only. No legacy Creative scripts, storage, or automatic save.
 */
const TYPES=Object.freeze([
 Object.freeze({key:'new-pokestop',kind:'pokestop',label:'PokéStop',icon:'../assets/pokestop.png'}),
 Object.freeze({key:'new-gym',kind:'gym',label:'Gym',icon:'../assets/gym.png'}),
 Object.freeze({key:'new-power',kind:'power',label:'PowerSpot',icon:'../assets/powerspot.png'})
]);
export function createOriginalPlacementR30({document,map,L,session,onChanged,onMessage,onMoved}={}){
 if(!document?.body||!map?.on||!map?.getCenter||!L?.circle||!L?.marker||!L?.divIcon||
    typeof session?.state!=='function'||typeof session?.command!=='function'||typeof onChanged!=='function')
   throw new TypeError('Original placement controller needs isolated editor and Leaflet map');
 let disposed=false,placement=null,selected=null,menuOpen=false;
 const message=value=>onMessage?.(value);
 const record=id=>session.state().records.find(p=>p.id===id&&!p.deleted);
 function makeButton(text,cls){
  const b=document.createElement('button');
  b.type='button';b.className=cls;b.textContent=text;return b;
 }
 function makeFab(){
  const wrap=document.createElement('div');wrap.id='cmFabWrap';wrap.className='cm-fab-wrap';
  const fab=makeButton('＋','cm-add-fab');fab.id='cmAddFab';fab.setAttribute('aria-label','POI追加');
  wrap.append(fab);
  for(const type of TYPES){
   const b=makeButton('','cm-bubble');b.dataset.layer=type.key;b.setAttribute('aria-label',type.label);
   const img=document.createElement('img');img.src=type.icon;img.alt=type.label;b.append(img);
   b.addEventListener('click',event=>{
    event.stopPropagation?.();
    menuOpen=false;
    selected=type;
    if(placement?.mode==='move')cancelPlacement();
    startPlacement('add');
    updateFab();
   });
   wrap.append(b);
  }
  const state=document.createElement('div');state.id='cmSelectedType';state.className='cm-selected-type';
  wrap.append(state);
  fab.addEventListener('click',event=>{
   event.stopPropagation?.();
   if(menuOpen){
    if(placement?.mode==='add')cancelPlacement();
    menuOpen=false;
   }else menuOpen=true;
   updateFab();
  });
  document.body.append(wrap);return {wrap,fab,state};
 }
 const {wrap,fab,state}=makeFab();
 function updateFab(){
  wrap.classList.toggle('open',menuOpen);
  fab.textContent=menuOpen?'×':'＋';
  for(const b of wrap.querySelectorAll('.cm-bubble'))
   b.classList.toggle('selected',placement?.mode==='add'&&b.dataset.layer===selected?.key);
  state.replaceChildren();
  if(placement?.mode==='add'&&selected){
   const img=document.createElement('img');img.src=selected.icon;img.alt=selected.label;
   state.append(img);state.classList.add('on');
  }else state.classList.remove('on');
 }
 // This is a literal copy of the approved base-v7 #addDraft/#beginMove
 // circle and crosshair attributes. Map owns the existing placement pane.
 const icon=()=>L.divIcon({className:'preview-touch',html:'<div class="preview-dot move-aim"></div>',iconSize:[40,40],iconAnchor:[20,20]});
 const circlesAt=ll=>({
  c50:L.circle(ll,{radius:50,color:'#13b8d4',fillColor:'#13b8d4',weight:4,fillOpacity:.12,pane:'placement',interactive:false}),
  c40:L.circle(ll,{radius:40,color:'#5578ff',fillColor:'#5578ff',weight:3,dashArray:'7 5',fillOpacity:.08,pane:'placement',interactive:false})
 });
 function makeActions(mode,commit,cancel){
  const bar=document.createElement('div'),ok=makeButton(mode==='move'?'この位置に確定':'この場所に追加',''),close=makeButton('×','');
  Object.assign(bar.style,{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'calc(132px + env(safe-area-inset-bottom))',zIndex:'1450',display:'flex',gap:'8px',alignItems:'center'});
  Object.assign(ok.style,{minWidth:'170px',height:'52px',padding:'0 18px',border:'2px solid #8a6b31',borderRadius:'15px',background:'#fff8e6',color:'#37270c',fontWeight:'950',fontSize:'16px',boxShadow:'0 5px 16px rgba(0,0,0,.28)'});
  Object.assign(close.style,{width:'46px',height:'46px',border:'2px solid #8a6b31',borderRadius:'14px',background:'rgba(255,253,247,.96)',color:'#5d4630',fontWeight:'950',fontSize:'24px',boxShadow:'0 5px 16px rgba(0,0,0,.22)'});
  ok.addEventListener('click',commit);close.addEventListener('click',cancel);
  bar.append(ok,close);document.body.append(bar);
  return bar;
 }
 function cancelPlacement(){
  if(!placement)return;
  const p=placement;placement=null;
  map.off('move',p.onMove);
  for(const layer of [p.marker,p.c50,p.c40])map.removeLayer(layer);
  p.bar.remove();
  updateFab();
 }
 function startPlacement(mode,poiId=null){
  if(disposed)return false;
  if(mode==='add'&&!selected)return false;
  const poi=mode==='move'?record(poiId):null;
  if(mode==='move'&&(!poi||poi.role!=='new')){message('既存POIは移動できません');return false;}
  cancelPlacement();
  menuOpen=false;
  if(poi)map.setView([poi.lat,poi.lng],map.getZoom(),{animate:false});
  const center=map.getCenter(),parts=circlesAt(center);
  const marker=L.marker(center,{icon:icon(),pane:'placement',interactive:false,zIndexOffset:2400}).addTo(map);
  parts.c50.addTo(map);parts.c40.addTo(map);
  const onMove=()=>{
   const ll=map.getCenter();
   marker.setLatLng(ll);parts.c50.setLatLng(ll);parts.c40.setLatLng(ll);
  };
  map.on('move',onMove);
  function commit(){
   if(disposed||placement?.marker!==marker)return;
   const now=map.getCenter(),ll={lat:now.lat,lng:now.lng};
   if(mode==='move'){
    const live=record(poiId);
    if(!live||live.role!=='new'){message('既存POIは移動できません');cancelPlacement();return;}
    if(live.lat===ll.lat&&live.lng===ll.lng){cancelPlacement();message('移動先は元の位置と同じです');return;}
    try{
     const result=session.command({type:'move',id:poiId,lat:ll.lat,lng:ll.lng},{confirmed:true});
     if(!result?.changed){message('移動を保留しました：'+String(result?.error?.code||'制限'));return;}
     cancelPlacement();onChanged();onMoved?.(poiId);message('POIを移動しました。↩ 戻るで取り消せます（保存なし）');
    }catch(e){message('移動を保留しました：'+String(e?.code||e?.message||'UNKNOWN'));}
    return;
   }
   const type=selected;
   if(!type)return;
   try{
    const result=session.command({type:'add',poi:{
     role:'new',kind:type.kind,title:type.label,memo:'',lat:ll.lat,lng:ll.lng,
     deleted:false,guid:null,poiId:null,metadata:{}
    }},{confirmed:true});
    if(!result?.changed){message('追加を保留しました：'+String(result?.error?.code||'追加制限'));return;}
    cancelPlacement();onChanged();startPlacement('add');
    message('新規POIを追加しました。続けて配置できます（保存なし）');
   }catch(e){message('追加を保留しました：'+String(e?.code||e?.message||'UNKNOWN'));}
  }
  const bar=makeActions(mode,commit,()=>{
   cancelPlacement();
   message(mode==='move'?'位置調整をキャンセルしました':'POI追加を終了しました');
  });
  placement={mode,poiId,marker,...parts,onMove,bar};
  updateFab();
  message(mode==='move'?'十字を合わせて「この位置に確定」を押してください':'十字を合わせて「この場所に追加」を押してください');
  return true;
 }
 function beginMove(id){
  selected=null;menuOpen=false;
  updateFab();
  return startPlacement('move',id);
 }
 return Object.freeze({
  beginMove,
  cancel:()=>{cancelPlacement();selected=null;menuOpen=false;updateFab()},
  isActive:()=>!!placement,
  status:()=>Object.freeze({mode:placement?.mode||null,selectedKind:selected?.kind||null}),
  hide(){wrap.style.display='none';cancelPlacement();selected=null;menuOpen=false;updateFab()},
  show(){wrap.style.display='';updateFab()},
  dispose(){disposed=true;cancelPlacement();wrap.remove()}
 });
}
