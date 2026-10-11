import {attachOriginalFileReview} from '../integration/original-file-review.mjs';
import {attachCreativeNextOverlay} from '../integration/creative-next-original-leaflet-overlay.mjs';
// Isolated original-UI controller. No legacy app scripts, journal, or browser storage.
let map=null,overlay=null,base=null,aerial=null,usingAerial=false,tool=null,disposed=false;
let rulerFirst=null,rulerPoints=[];
const id=name=>document.getElementById(name);
const entry=id('entry'),status=id('entryState'),message=id('status');
const listeners=[];
function listen(target,type,callback,options){
 if(!target)return;
 target.addEventListener(type,callback,options);
 listeners.push(()=>target.removeEventListener(type,callback,options));
}
function inform(text){
 if(!message)return;
 message.textContent=String(text).slice(0,150);
 message.classList.remove('fade');
 clearTimeout(inform.timer);
 inform.timer=setTimeout(()=>message.classList.add('fade'),3600);
}
function hidePanels(){
 id('layerPanel')?.classList.remove('open');
 id('circlePanel')?.classList.remove('open');
 id('toolMenu')?.classList.remove('open');
}
function enable(...ids){for(const name of ids){const b=id(name);if(b)b.disabled=false;}}
function refreshMap(){
 if(!map||disposed)return;
 overlay?.refresh();
 fileReview.syncControls();
}
function backToEntry(){
 if(!map)return;
 hidePanels();tool=null;
 entry.classList.remove('hidden');
 const resume=id('resumeButton');
 if(resume){resume.textContent='地図へ戻る';resume.classList.add('show');resume.disabled=false;}
 status.textContent='編集中の地図へ戻れます。別のファイルを選ぶ場合は再読み込みしてください。';
}
function reopenMap(){
 if(!map)return;
 entry.classList.add('hidden');
 requestAnimationFrame(()=>map?.invalidateSize());
}
function layerMenu(){
 const root=id('layerRows');if(!root||!overlay)return;
 root.replaceChildren();
 const names=[
 ['existing-pokestop','既存 PokéStop'],['existing-gym','既存 Gym'],['existing-power','既存 PowerSpot'],
 ['new-pokestop','新規 PokéStop'],['new-gym','新規 Gym'],['new-power','新規 PowerSpot']
 ];
 const rows=fileReview.engine.state().records;
 for(const [key,title] of names){
  const row=document.createElement('div');row.className='layer-row';
  const label=document.createElement('label');label.textContent=title+' ('+rows.filter(r=>(r.role+'-'+r.kind)===key&&!r.deleted).length+')';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;
  listen(checkbox,'change',()=>{overlay?.setLayerVisible(key,checkbox.checked);inform(title+(checkbox.checked?'を表示':'を非表示'));});
  row.append(label,checkbox);root.append(row);
 }
}
function togglePanel(which){
 if(!map)return;
 const panel=id(which),open=!panel.classList.contains('open');
 hidePanels();
 if(open)panel.classList.add('open');
}
function beginAdd(){
 if(!map)return;
 tool=tool==='add'?null:'add';hidePanels();
 inform(tool?'新規POIを追加する場所を地図でタップ。もう一度道具箱から終了できます。':'追加操作を終了しました');
}
function addAt(latlng){
 const raw=globalThis.prompt('追加する種類を選択してください。1=PokéStop / 2=Gym / 3=PowerSpot','1');
 if(raw===null){inform('追加をキャンセルしました');return;}
 const kind=({'1':'pokestop','2':'gym','3':'power'})[raw.trim()];
 if(!kind){inform('追加する種類は1・2・3から選択してください');return;}
 const name=globalThis.prompt('新しいPOIの名前を入力してください','新しいスポット');
 if(name===null){inform('追加をキャンセルしました');return;}
 if(!name.trim()){inform('POIの名前が必要です');return;}
 if(!globalThis.confirm('この地点に新しいPOIを追加しますか？（元KMZは変更しません）'))return;
 try{
  const result=fileReview.engine.command({type:'add',poi:{role:'new',kind,title:name.trim(),memo:'',lat:latlng.lat,lng:latlng.lng,deleted:false,guid:null,poiId:null,metadata:{}}},{confirmed:true});
  if(!result?.changed){inform('追加を保留しました：'+String(result?.error?.message||result?.error?.code||'追加制限'));return;}
  tool=null;refreshMap();inform('新規POIを追加しました。↩ 戻るで取り消せます（保存なし）');
 }catch(e){inform('追加を保留しました：'+String(e.code||e.message||'UNKNOWN'));}
}
function measureAt(latlng){
 if(!rulerFirst){rulerFirst=latlng;inform('物差し：次の地点をタップしてください');return;}
 const meters=map.distance(rulerFirst,latlng);
 rulerFirst=null;
 const value=meters>=1000?(meters/1000).toFixed(2)+'km':meters.toFixed(1)+'m';
 inform('2点間の距離：約'+value+'（地図上の計測）');
}
async function downloadKmz(){
 if(!map)return;
 const save=id('save');save.disabled=true;inform('KMZを書き出しています…');
 try{
  const result=await fileReview.engine.exportKmz();
  if(!(result?.bytes instanceof Uint8Array)||!result.bytes.length)throw Error('EXPORT_EMPTY');
  const url=URL.createObjectURL(new Blob([result.bytes],{type:'application/vnd.google-earth.kmz'}));
  const a=document.createElement('a');a.href=url;a.download='creative-next-edited.kmz';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
  inform('KMZのダウンロードを開始しました。ファイルアプリで確認してください。');
 }catch(e){inform('KMZ書き出しを保留しました：'+String(e.code||e.message||'EXPORT_ERROR'));}
 finally{if(!disposed)save.disabled=false;}
}
function attachMapControls(){
 enable('back','mapToggle','layerButton','circleButton','toolbox','save');
 // The legacy source may retain the old locate button; it requires an explicit tap.
 const locate=id('locate');if(locate&&!locate.hidden){locate.disabled=false;}
 listen(id('back'),'click',backToEntry);
 listen(id('resumeButton'),'click',reopenMap);
 listen(entry.querySelector('.filebar'),'click',e=>{
  if(map&&!entry.classList.contains('hidden')){
   e.preventDefault();e.stopPropagation();
   if(globalThis.confirm('新しいファイルを開くにはプレビューを再読み込みします。保存していない編集は破棄されます。よろしいですか？'))location.reload();
  }
 },true);
 listen(id('mapToggle'),'click',()=>{
  usingAerial=!usingAerial;
  if(usingAerial){map.removeLayer(base);aerial.addTo(map);}
  else{map.removeLayer(aerial);base.addTo(map);}
  inform(usingAerial?'航空写真に切り替えました':'通常地図に切り替えました');
 });
 listen(id('layerButton'),'click',()=>togglePanel('layerPanel'));
 listen(id('circleButton'),'click',()=>togglePanel('circlePanel'));
 listen(id('toolbox'),'click',()=>togglePanel('toolMenu'));
 for(const radius of [30,40]){
  const button=document.querySelector('[data-extra="'+radius+'"]');
  if(!button)continue;
  button.disabled=false;
  let visible=true;
  listen(button,'click',()=>{
   visible=!visible;
   overlay.setCircleVisible(radius,visible);
   button.classList.toggle('active',visible);
   inform(radius+'m距離円を'+(visible?'表示':'非表示')+'にしました');
  });
 }
 const extras={add:beginAdd,polygon:()=>{
  tool=null;hidePanels();inform('活動範囲の編集は次の接続段階です。既存データは変更しません。');
 },ruler:()=>{
  tool=tool==='ruler'?null:'ruler';rulerFirst=null;hidePanels();
  inform(tool?'物差し：地図上の2地点を順番にタップしてください':'物差しを終了しました');
 }};
 for(const key of Object.keys(extras)){
  const button=document.querySelector('[data-tool="'+key+'"]');
  if(!button)continue;
  button.disabled=false;listen(button,'click',extras[key]);
 }
 listen(id('save'),'click',downloadKmz);
 if(locate&&!locate.hidden){
  listen(locate,'click',()=>{
   if(!navigator.geolocation){inform('この端末では現在地を使用できません');return;}
   navigator.geolocation.getCurrentPosition(p=>{map?.setView([p.coords.latitude,p.coords.longitude],16);inform('現在地付近に移動しました');},()=>inform('現在地を取得できませんでした'),{enableHighAccuracy:false,timeout:10000});
  });
 }
 const onMapClick=e=>{if(tool==='add')addAt(e.latlng);else if(tool==='ruler')measureAt(e.latlng);};
 map.on('click',onMapClick);
 listeners.push(()=>map?.off('click',onMapClick));
 listen(document,'dblclick',e=>{
  if(e.target?.closest?.('button,.filebar')){e.preventDefault();e.stopPropagation();}
 },true);
 listen(window,'resize',()=>{if(!entry.classList.contains('hidden'))return;map?.invalidateSize();});
}
function installHanded(){
 const apply=hand=>{
  document.body.classList.toggle('left-hand',hand==='left');
  document.body.classList.toggle('right-hand',hand!=='left');
  id('leftHand')?.classList.toggle('active',hand==='left');
  id('rightHand')?.classList.toggle('active',hand!=='left');
 };
 enable('leftHand','rightHand');
 listen(id('leftHand'),'click',()=>apply('left'));
 listen(id('rightHand'),'click',()=>apply('right'));
}
window.creativeR25Boot='STARTED';
const fileReview=attachOriginalFileReview({
 document,JSZip:globalThis.JSZip,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer,
 onRefresh:()=>{overlay?.refresh();},
 confirmReview:()=>globalThis.confirm('読み込み候補を隔離エンジンに適用し、地図へ表示しますか？ 元のファイルは変更しません。'),
 onResult(result){
  if(!result?.applied)return;
  if(!globalThis.L?.map){status.textContent='地図ライブラリを読み込めませんでした';return;}
  try{
   entry.classList.add('hidden');
   map=globalThis.L.map('map',{zoomControl:false,preferCanvas:true,doubleClickZoom:false}).setView([35.643,139.857],15);
   base=globalThis.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
   aerial=globalThis.L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});
   overlay=attachCreativeNextOverlay({session:fileReview.engine,map,L:globalThis.L});
   const view=overlay.refresh();
   map.invalidateSize();
   if(view?.records?.length)map.fitBounds(globalThis.L.latLngBounds(view.records.map(p=>p.latlng)),{padding:[24,24],maxZoom:17});
   layerMenu();
   attachMapControls();
   setTimeout(()=>{if(map&&!entry.classList.contains('hidden'))map.invalidateSize();},180);
   inform('地図を表示しました。プレビューの自動保存は無効です。');
  }catch(error){
   entry.classList.remove('hidden');
   status.textContent='地図表示を保留しました：'+String(error.code||error.message||'MAP_ERROR').slice(0,70);
   overlay?.destroy();map?.remove();overlay=null;map=null;
  }
 }
});
installHanded();
globalThis.creativeR25=Object.freeze({status:()=>({boot:window.creativeR25Boot,active:fileReview.engine.state().hasActive,count:overlay?.counts()||null}),
 dispose(){disposed=true;clearTimeout(inform.timer);for(const remove of listeners)remove();overlay?.destroy();map?.remove();fileReview.dispose();}});
window.creativeR25Boot='READY';
