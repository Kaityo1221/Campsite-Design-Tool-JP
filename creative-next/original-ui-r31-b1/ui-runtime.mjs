// Generated B1 hooks over frozen Part A presentation. No engine copy.
// PART A presentation controller. No editor/store/history/KMZ/storage imports.
// Source-derived templates/styles live in source-templates.mjs; connection code lives here.
import * as source from '../original-ui-r31/source-templates.mjs';
const EMPTY=Object.freeze({pois:[],circles:[],areas:[],history:{undo:0,redo:0}});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export function mountCreativeUi({document:doc=globalThis.document,L=globalThis.L,readView=()=>EMPTY,onRequest=()=>{}}={}){
 if(doc.documentElement.dataset.r31UiOwner||doc.getElementById('map')?._leaflet_id)throw Error('UI_ALREADY_MOUNTED');
 doc.documentElement.dataset.r31UiOwner='view-only';
 const win=doc.defaultView,id=n=>doc.getElementById(n),listeners=new Set(),timers=new Set(),rafs=new Set(),owned=new Set(),animations=new Set();
 let stopped=false,map=null,tiles=null,circleRenderer=null,coordinatePanel=null,previewCircle=null,selectedCircle=null,sheet=null,bar=null,dot=null,saveMenu=null,list=null,rulesRaf=0;
 let commandSink=null;
 let reader=readView,observer=onRequest,sequence=0,viewLayers=[],recordCircles=[],coords=null,chooser=null,areaMenu=null,areaAction=null,areaCrosshair=null,areaCancel=null,areaDelete=null,rulerExit=null,surfaceLock=null;
 let draftPoints=[],draftRedo=[],draftLayers=[],rulerLayers=[],deleteLayers=[],areaClosing=false;
 const ui={hand:'right',menu:false,mode:null,layer:'new-pokestop',radius:50,selected:null,dragged:false,tool:'',aerial:false,areaVisible:false,visibleLayers:Object.fromEntries(source.layerDefs.map(([k])=>[k,true])),circleRadii:[]};
 const listen=(target,type,fn,options)=>{if(!target)return;target.addEventListener(type,fn,options);listeners.add({target,remove:()=>target.removeEventListener(type,fn,options)});};
 const mapListen=(type,fn)=>{map.on(type,fn);listeners.add({target:map,remove:()=>map?.off(type,fn)});};
 const later=(fn,ms)=>{const t=win.setTimeout(()=>{timers.delete(t);if(!stopped)fn();},ms);timers.add(t);return t;};
 const raf=fn=>{const r=win.requestAnimationFrame(()=>{rafs.delete(r);if(!stopped)fn();});rafs.add(r);return r;};
 const own=node=>{owned.add(node);return node;};
 const create=(tag,attrs={},html=null)=>{const n=own(doc.createElement(tag));for(const [k,v]of Object.entries(attrs))n[k]=v;if(html!==null)n.innerHTML=html;return n;};
 function descriptor(name,html=null){const d=source.descriptors[name];const n=create(d.tag,d.properties,html);for(const [k,v]of Object.entries(d.attributes))n.setAttribute(k,v);return n;}
 function present(owner,name,html=null){const d=source.presentationNodes[owner][name],n=create(d.tag,d.properties,html);Object.assign(n.style,d.styles);return n;}
 function destroy(node){if(!node)return;for(const item of listeners)if(item.target===node||(item.target instanceof win.Node&&node.contains(item.target))){item.remove();listeners.delete(item);}for(const n of owned)if(n===node||node.contains(n))owned.delete(n);node.remove();}
 function frame(){
  // Copy input as a view projection. Never retain engine objects or mutate supplied data.
  const supplied=reader()||EMPTY;
  return JSON.parse(JSON.stringify({pois:supplied.pois||[],circles:supplied.circles||[],areas:supplied.areas||[],history:supplied.history||{undo:0,redo:0}}));
 }
 let holdTimer=null;
 function message(text,ms=1300){const n=id('status');if(!n)return;if(holdTimer!==null){win.clearTimeout(holdTimer);timers.delete(holdTimer);holdTimer=null;}n.textContent=text;n.classList.remove('fade');return ms?later(()=>n.classList.add('fade'),ms):null;}
 function hold(action){
  if(stopped)return{status:'STOPPED',changed:false};
  if(commandSink){
   const request=Object.freeze({...action,requestId:'r31-b1-ui-'+(++sequence)}),result=commandSink(request);
   observer(request,result);
   if(result?.changed&&result.status==='APPLIED'){if(action.type==='add'||action.type==='move'||action.type==='coordinate-add'){doc.documentElement.classList.remove('cm-v52-panel-open');cancelPlacement();}if(action.type==='delete'||action.type==='undo'||action.type==='redo')closeSheet();if(action.type==='change-kind')openSheet(action.id);message('操作を反映しました');}
   else message(result?.reason==='EDIT_CONFIRM_REQUIRED'?'変更は未確定です':result?.changed?'HOLD：変更済みですが描画を確認できません':'HOLD：操作は反映されていません');
   return result;
  }
  const result=Object.freeze({status:'HOLD',changed:false,reason:'PART_A_DATA_DISCONNECTED'});
  observer(Object.freeze({...action,requestId:'r31-ui-'+(++sequence)}),result);
  holdTimer=message('HOLD：データ処理は未接続です');
  return result;
 }
 function closePanels(){for(const n of ['layerPanel','circlePanel','toolMenu'])id(n)?.classList.remove('open');}
 function closeSheet(){destroy(sheet);sheet=null;ui.selected=null;if(selectedCircle&&map)map.removeLayer(selectedCircle);selectedCircle=null;}
 function closeChooser(){destroy(chooser);chooser=null;doc.body.classList.remove('cm-save-chooser-open');}
 function closeSave(){destroy(saveMenu);saveMenu=null;}
 function closeList(){destroy(list);list=null;}
 function closeCoords(){destroy(coords);coords=null;}
 function syncFab(){
  const wrap=id('cmFabWrap'),fab=id('cmAddFab'),selected=id('cmSelectedType');if(!wrap)return;
  wrap.classList.toggle('open',ui.menu);fab.textContent=ui.menu?'×':'＋';
  wrap.querySelectorAll('.cm-bubble').forEach(n=>n.classList.toggle('selected',n.dataset.layer===ui.layer&&ui.mode==='add'));
  const active=frame().pois.filter(p=>p.role==='new'&&!p.deleted);wrap.querySelectorAll('.cm-bubble').forEach(n=>{const kind=n.dataset.layer.slice(4),limit={pokestop:12,gym:8,power:5}[kind],disabled=active.filter(p=>p.kind===kind).length>=limit;n.disabled=disabled;n.classList.toggle('disabled',disabled);n.setAttribute('aria-disabled',String(disabled));if(disabled)n.title=source.types[n.dataset.layer].label+'は最大'+limit+'個です';else n.removeAttribute('title');});
  if(ui.mode==='add'){selected.innerHTML='<img src="'+source.types[ui.layer].icon+'">';selected.classList.add('on');}else selected.classList.remove('on');
 }
 function positionFab(){
  const wrap=id('cmFabWrap'),bottom=doc.querySelector('.bottom-bar');if(!wrap)return;
  const maxY=Math.max(8,(bottom?.getBoundingClientRect().top||win.innerHeight)-56-8);
  const x=Math.max(8,Math.min(win.innerWidth-64,win.innerWidth*(ui.hand==='left'?.30:.70)-28));
  const y=Math.max(8,Math.min(maxY,(bottom?.getBoundingClientRect().top||win.innerHeight-110)-68));
  // Match the final source cmApplyFabPosition; these priorities are inherited source behavior.
  for(const [property,value]of Object.entries({left:x+'px',top:y+'px',right:'auto',bottom:'auto'}))wrap.style.setProperty(property,value,'important');
 }
 function applyHand(hand){
  if(stopped)return;
  ui.hand=hand;doc.body.classList.toggle('left-hand',hand==='left');doc.body.classList.toggle('right-hand',hand!=='left');
  id('leftHand')?.classList.toggle('active',hand==='left');id('rightHand')?.classList.toggle('active',hand!=='left');
  if(!ui.dragged)raf(positionFab);
 }
 function initMap(){
  if(map||!L?.map)return;
  map=L.map('map',{zoomControl:false,doubleClickZoom:false}).setView([35.6812,139.7671],16);
  for(const [name,css]of [['distance','distance-pane'],['polygon','polygon-pane'],['placement','placement-pane'],['ruler','ruler-pane']])map.createPane(name).classList.add(css);
  map.attributionControl.setPosition('bottomleft');map.attributionControl.setPrefix(false);circleRenderer=L.canvas({padding:.5,pane:'distance'});
  tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap contributors'}).addTo(map);
  mapListen('move',()=>{updatePreview();if(ui.tool==='polygon')updateAreaPreview();});
  mapListen('click',e=>{if(ui.tool==='ruler'){rulerPoint(e.latlng);return;}if(ui.mode==='move')return;if(sheet&&!ui.mode)closeSheet();if(ui.menu){ui.menu=false;syncFab();}closeSave();});
  const unsafe=t=>!!t?.closest?.('.leaflet-marker-icon,.leaflet-interactive,button,input,textarea,select,a,.panel,.toolmenu,.bottom-bar,.save,.toolbox,.leaflet-popup');
  mapListen('dblclick',e=>{if(!unsafe(e.originalEvent?.target))map.setView(e.latlng,Math.min(map.getZoom()+1,map.getMaxZoom()),{animate:true});});
  const surface=map.getContainer();let touch=null,lastTap=null;
  listen(surface,'touchstart',e=>{touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,moved:false}:null;},{passive:true});
  listen(surface,'touchmove',e=>{if(!touch)return;if(e.touches.length!==1||Math.hypot(e.touches[0].clientX-touch.x,e.touches[0].clientY-touch.y)>10)touch.moved=true;},{passive:true});
  listen(surface,'touchend',e=>{if(!touch||touch.moved||e.changedTouches.length!==1)return;const t=e.changedTouches[0],now=Date.now();if(unsafe(doc.elementFromPoint(t.clientX,t.clientY))){lastTap=null;return;}if(lastTap&&now-lastTap.at<=340&&Math.hypot(t.clientX-lastTap.x,t.clientY-lastTap.y)<=28){lastTap=null;const r=surface.getBoundingClientRect();map.setView(map.containerPointToLatLng(L.point(t.clientX-r.left,t.clientY-r.top)),Math.min(map.getZoom()+1,map.getMaxZoom()),{animate:true});}else lastTap={at:now,x:t.clientX,y:t.clientY};},{passive:true});
  listen(surface,'touchcancel',()=>{touch=null;lastTap=null;},{passive:true});
 }
 function removePreview(){
  if(previewCircle&&map)map.removeLayer(previewCircle);previewCircle=null;
  unlockSurface();destroy(bar);destroy(dot);bar=null;dot=null;destroy(id('cmSafeNearestWarning'));destroy(coordinatePanel);coordinatePanel=null;
  doc.body.classList.remove('cm-placement-docked');doc.documentElement.classList.remove('cm-v52-panel-open');
 }
 function cancelPlacement(notify=false){const mode=ui.mode;removePreview();ui.mode=null;ui.menu=false;syncFab();if(notify&&mode)message(mode==='move'?'位置調整をキャンセルしました':'POI追加を終了しました',1200);}
 function updatePreview(){
  if(!map||!ui.mode)return;
  previewCircle?.setLatLng(map.getCenter());previewCircle?.setRadius(ui.radius);
  const knob=id(ui.mode==='move'?'cmMoveLeverKnob':'cmSafeAddKnob');
  if(knob)knob.style.transform='translate(-50%,-50%) translateY('+source.leverOffset(ui.radius)+'px)';
  const value=id(ui.mode==='move'?'cmMoveRadiusValue':'cmSafeAddRadiusValue');if(value)value.textContent=Math.round(ui.radius)+'m';
  updateNearest();
 }

 function updateNearest(){
  if(!map||!ui.mode)return;
  const c=map.getCenter(),items=frame().pois.filter(p=>!p.deleted&&p.id!==ui.selected);
  let distance=null;
  for(const p of items){const d=map.distance(c,[p.lat,p.lng]);if(distance===null||d<distance)distance=d;}
  const target=ui.mode==='move'?id('cmMoveNearest'):(id('cmSafeNearestWarning')||(()=>{const n=descriptor('cmSafeEnsureNearestWarning');doc.body.append(n);return n;})());
  if(!target)return;
  if(distance===null){target.textContent=ui.mode==='move'?'最短POI --':'';if(ui.mode==='add')target.style.display='none';return;}
  target.textContent=(distance<50?'⚠ ':'✓ ')+'最短POI '+distance.toFixed(1)+'m';
  target.classList.toggle('danger',distance<50);target.classList.toggle('safe',distance>=50);
  if(ui.mode==='add')target.style.display='block';
 }
 function openCoordinate(){
  if(!bar)return;
  if(!coordinatePanel){
   coordinatePanel=create('section',{id:'cmCoordinateJumpPanel',className:'cm-v52-existing-new',hidden:true},source.coordinatePanel());
   coordinatePanel.setAttribute('aria-label','座標で位置を合わせる');doc.body.append(coordinatePanel);
   const input=id('cmCoordinateInput'),error=coordinatePanel.querySelector('.cm-coordinate-error');
   // Source v53 requests the ordinary text keyboard; this is a view setting only.
   input.type='text';input.setAttribute('inputmode','text');id('cmCoordinateApply').hidden=true;
   const mode=create('div',{className:'cm-v52-mode-switch'},source.coordinateMode()),confirm=create('div',{className:'cm-v52-confirm-row'},source.coordinateConfirmRow());confirm.querySelector('.cm-v52-keyboard-toggle').remove();confirm.style.justifyContent='flex-end';coordinatePanel.querySelector('.cm-coordinate-row').append(mode);coordinatePanel.querySelector('.cm-coordinate-row').after(confirm);
   const sourceMode=value=>{mode.dataset.mode=value;mode.setAttribute('aria-label',value==='new'?'新規を選択中':'既存を選択中');mode.querySelector('.existing').setAttribute('aria-pressed',String(value==='existing'));mode.querySelector('.new').setAttribute('aria-pressed',String(value==='new'));coordinatePanel.dataset.placementSource=value;};sourceMode('new');
   for(const value of ['existing','new'])listen(mode.querySelector('.'+value),'click',()=>sourceMode(value));
   const hideCoordinate=()=>{coordinatePanel.hidden=true;doc.documentElement.classList.remove('cm-v52-panel-open');};
   const parsedPosition=()=>{const raw=String(input.value).trim().replace(/，/g,',');if(!raw)return null;let parts=raw.split(',').map(x=>x.trim()).filter(Boolean);if(parts.length!==2)parts=raw.split(/\s+/).filter(Boolean);const numbers=parts.map(Number);return numbers.length===2&&numbers.every(Number.isFinite)&&Math.abs(numbers[0])<=90&&Math.abs(numbers[1])<=180?numbers:false;};
   const apply=()=>{
    const parts=parsedPosition();if(!parts){error.textContent='「緯度, 経度」の形式で入力してください';return;}
    input.blur();map?.stop();map?.setView(parts,map.getZoom(),{animate:false,reset:true});hideCoordinate();updatePreview();
   };
   listen(confirm.querySelector('.cm-v52-confirm'),'click',()=>{const parts=parsedPosition();if(parts===false){error.textContent='「緯度, 経度」の形式で入力してください';return;}error.textContent='';if(parts){map.stop();map.setView(parts,map.getZoom(),{animate:false,reset:true});updatePreview();}hold({type:'coordinate-add',source:mode.dataset.mode,kind:ui.layer,position:{...map.getCenter()}});});
   listen(coordinatePanel.querySelector('.cm-coordinate-close'),'click',hideCoordinate);
   listen(id('cmCoordinateApply'),'click',apply);
   listen(input,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
  }
  coordinatePanel.hidden=false;doc.documentElement.classList.add('cm-v52-panel-open');coordinatePanel.querySelector('.cm-coordinate-error').textContent='';
  const bottom=Math.max(86,win.innerHeight-bar.getBoundingClientRect().top+50);
  coordinatePanel.style.bottom=Math.min(Math.max(bottom,110),Math.max(110,win.innerHeight-210))+'px';
  later(()=>id('cmCoordinateInput')?.focus(),30);
 }

 function lockSurface(){if(surfaceLock)return;surfaceLock={html:{overflow:doc.documentElement.style.overflow,overscrollBehavior:doc.documentElement.style.overscrollBehavior},body:{overflow:doc.body.style.overflow,overscrollBehavior:doc.body.style.overscrollBehavior,touchAction:doc.body.style.touchAction},map:{dragging:map.dragging.enabled(),touchZoom:map.touchZoom.enabled(),doubleClickZoom:map.doubleClickZoom.enabled()}};Object.assign(doc.documentElement.style,{overflow:'hidden',overscrollBehavior:'none'});Object.assign(doc.body.style,{overflow:'hidden',overscrollBehavior:'none',touchAction:'none'});for(const key of Object.keys(surfaceLock.map))map[key].disable();}
 function unlockSurface(){if(!surfaceLock)return;Object.assign(doc.documentElement.style,surfaceLock.html);Object.assign(doc.body.style,surfaceLock.body);for(const [k,enabled]of Object.entries(surfaceLock.map))if(enabled)map?.[k].enable();surfaceLock=null;}
 function attachLever(node){
  let origin=null;const block=e=>{if(e.cancelable)e.preventDefault();e.stopPropagation();};
  const begin=(id,y,e)=>{block(e);lockSurface();origin={id,y,radius:ui.radius,current:ui.radius};node.classList.add('dragging');};
  const move=(y,e)=>{if(!origin)return;block(e);ui.radius=Math.max(30,Math.min(50,origin.radius-(y-origin.y)*.32));origin.current=ui.radius;updatePreview();};
  const end=e=>{block(e);if(origin)ui.radius=Math.max(30,Math.min(50,Math.round(origin.current/10)*10));origin=null;node.classList.remove('dragging');unlockSurface();updatePreview();};
  listen(node,'pointerdown',e=>{if(e.pointerType==='touch'||origin)return;begin(e.pointerId,e.clientY,e);node.setPointerCapture?.(e.pointerId);});
  listen(node,'pointermove',e=>{if(origin?.id===e.pointerId&&e.pointerType!=='touch')move(e.clientY,e);});
  listen(node,'pointerup',e=>{if(origin?.id!==e.pointerId||e.pointerType==='touch')return;end(e);node.releasePointerCapture?.(e.pointerId);});
  listen(node,'pointercancel',e=>{if(e.pointerType!=='touch')end(e);});
  listen(node,'touchstart',e=>{if(e.touches.length===1&&!origin)begin(e.touches[0].identifier,e.touches[0].clientY,e);},{passive:false});
  listen(node,'touchmove',e=>{const t=[...e.touches].find(t=>t.identifier===origin?.id);if(t)move(t.clientY,e);},{passive:false});
  for(const type of ['touchend','touchcancel'])listen(node,type,end,{passive:false});
 }
 function place(mode,poi=null){
  if(stopped||!map)return;
  clearTools();closeSheet();closePanels();closeSave();removePreview();ui.mode=mode;ui.menu=false;ui.radius=50;
  ui.selected=poi?.id||null;
  if(mode==='add'){
   dot=descriptor('cmSafeAddDotElement',source.addDot());doc.body.append(dot);dot.style.setProperty('display','grid','important');
   const meta=source.types[ui.layer];
   bar=create('div',{id:'cmSafeAddBar',className:'cm-safe-add-bar'},source.selectedPoi(meta)+source.addBarTail());
   doc.body.append(bar);
   listen(id('cmSafeAddConfirm'),'click',()=>hold({type:'add',kind:ui.layer,position:{...map.getCenter()}}));
   listen(id('cmSafeAddCancel'),'click',()=>cancelPlacement(true));
   attachLever(id('cmSafeAddLever'));
  }else{
   dot=descriptor('cmMoveCrosshairElement',source.moveCrosshair());doc.body.append(dot);dot.style.display='block';
   bar=create('div',{id:'cmMoveBar',className:'cm-move-bar'},source.moveBar());doc.body.append(bar);
   listen(id('cmMoveConfirm'),'click',()=>hold({type:'move',id:poi.id,position:{...map.getCenter()}}));
   listen(id('cmMoveCancel'),'click',()=>cancelPlacement(true));attachLever(id('cmMoveLever'));
  }
  const coordinate=descriptor('coordinateButton');bar.append(coordinate);listen(coordinate,'click',openCoordinate);
  previewCircle=L.circle(map.getCenter(),mode==='add'?source.addCircleOptions(ui.radius,circleRenderer):source.moveCircleOptions(circleRenderer)).addTo(map);
  doc.body.classList.add('cm-placement-docked');syncFab();updatePreview();message(mode==='add'?'POI追加モード':'地図を動かして十字を移動先に合わせてください',mode==='add'?900:1800);
 }
 function openSheet(poiId){
  const poi=frame().pois.find(p=>p.id===poiId&&!p.deleted);if(stopped||!poi||ui.mode==='move')return false;
  cancelPlacement();closeSheet();closePanels();ui.selected=poi.id;
  const r={...poi,layer:(poi.role==='new'?'new-':'existing-')+poi.kind,latlng:[poi.lat,poi.lng]};
  const label=source.types[r.layer]?.label||source.layerDefs.find(x=>x[0]===r.layer)?.[1]||r.layer;
  const near=nearest(poi,poi.id),warn=near&&near.distance<50?near:null;
  sheet=create('div',{className:'cm-sheet'},poi.role==='new'?source.newSheet(r,label,warn,source.types):source.existingSheet(r,label));
  doc.body.append(sheet);listen(sheet.querySelector('.cm-sheet-close'),'click',closeSheet);
  if(map)selectedCircle=L.circle([poi.lat,poi.lng],{radius:50,color:'#d18a00',fillColor:'#d18a00',weight:2,fillOpacity:.055,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  if(poi.role==='new'){
   listen(sheet.querySelector('#cmName'),'input',e=>hold({type:'edit',id:poi.id,patch:{title:e.target.value.slice(0,30)}}));
   listen(sheet.querySelector('#cmMemo'),'input',e=>hold({type:'edit',id:poi.id,patch:{memo:e.target.value.slice(0,50)}}));
   listen(sheet.querySelector('#cmMove'),'click',()=>place('move',poi));
   listen(sheet.querySelector('#cmType'),'click',()=>sheet.querySelector('#cmTypePicker').classList.toggle('open'));
   listen(sheet.querySelector('#cmDelete'),'click',()=>hold({type:'delete',id:poi.id}));
   sheet.querySelectorAll('#cmTypePicker button').forEach(n=>listen(n,'click',()=>hold({type:'change-kind',id:poi.id,kind:n.dataset.layer})));
   if(warn){const field=present('cmV69InstallSpacingReason','field'),label=present('cmV69InstallSpacingReason','label'),input=present('cmV69InstallSpacingReason','textarea'),count=present('cmV69InstallSpacingReason','count'),value=present('cmV69InstallSpacingReason','countValue');input.value=poi.applicationComment||'';value.textContent=String(input.value.length);count.append(value,doc.createTextNode(' / 300'));field.append(label,input,count);sheet.querySelector('.cm-actions').before(field);listen(input,'input',()=>{value.textContent=String(input.value.length);hold({type:'edit',id:poi.id,patch:{applicationComment:input.value.slice(0,300)}});});}
  }
  const handle=sheet.querySelector('.cm-sheet-handle');let y=null;listen(handle,'touchstart',e=>{if(e.touches.length===1)y=e.touches[0].clientY;},{passive:true});
  listen(handle,'touchend',e=>{if(y!==null&&e.changedTouches.length===1&&e.changedTouches[0].clientY-y>65)closeSheet();y=null;},{passive:true});listen(handle,'touchcancel',()=>{y=null;},{passive:true});
  return true;
 }
 function openChooser(){
  closeSave();closeChooser();chooser=present('showSaveChooser','wrap');
  const choose=present('showSaveChooser','choose'),download=present('showSaveChooser','download'),close=present('showSaveChooser','close');chooser.append(choose,download,close);doc.body.append(chooser);doc.body.classList.add('cm-save-chooser-open');
  listen(choose,'click',()=>hold({type:'save',destination:'choose'}));listen(download,'click',()=>hold({type:'save',destination:'download'}));listen(close,'click',()=>{closeChooser();message('保存をキャンセルしました');});
 }
 function openSave(){
  closeSave();saveMenu=create('div',{id:'cmStandaloneSaveMenu'},source.standaloneSave());
  // Production v63 removes this original manual-save button; do the same before presenting.
  saveMenu.querySelector('#cmStandaloneWorkspaceSave')?.remove();doc.body.append(saveMenu);
  listen(id('cmStandaloneKmz'),'click',()=>{hold({type:'exportKmz'});openChooser();});
  listen(id('cmStandaloneCoords'),'click',openCoords);
  listen(id('cmStandaloneClose'),'click',closeSave);
 }
 function openCoords(){
  if(coords)return;closeSave();coords=create('div',{className:'cm-coords'},source.coords());const root=coords.lastElementChild;
  for(const p of frame().pois.filter(p=>p.role==='new'&&!p.deleted)){
   const r={...p,latlng:[p.lat,p.lng]},card=create('div',{className:'cm-coord-card'},source.coordinateCard(r,source.types['new-'+p.kind]?.label||''));
   for(const button of card.querySelectorAll('[data-copy]'))listen(button,'click',async()=>{let ok=false;try{await win.navigator.clipboard.writeText(button.dataset.copy);ok=true;}catch{const input=create('textarea',{value:button.dataset.copy});Object.assign(input.style,{position:'fixed',left:'-9999px'});doc.body.append(input);input.select();try{ok=doc.execCommand('copy');}catch{}destroy(input);}if(stopped||!card.isConnected)return;const text=button.parentElement.querySelector('.cm-copy-ok');text.textContent=ok?'コピーしました':'コピー失敗';later(()=>{if(text.isConnected)text.textContent='';},1200);});
   if(String(p.memo||'').trim())card.append(create('div',{className:'cm-v54-memo'},source.coordinateMemo(String(p.memo).trim())));
   const near=nearest(p,p.id);if(near&&near.distance<50){const reason=create('label',{className:'cm-v46-reason'},source.coordinateReason()),input=reason.querySelector('textarea');input.value=p.applicationComment||'';listen(input,'input',()=>hold({type:'edit',id:p.id,patch:{applicationComment:input.value.slice(0,300)}}));card.append(reason);}
   root.append(card);
  }
  if(!root.children.length)root.innerHTML='<div style="padding:24px;text-align:center">新規ゲームスポットはまだありません。</div>';
  doc.body.append(coords);listen(coords.querySelector('.cm-view-head button'),'click',closeCoords);
 }
 function nearest(position,exclude){let result=null;for(const p of frame().pois.filter(p=>!p.deleted&&p.id!==exclude)){const distance=map.distance([position.lat,position.lng],[p.lat,p.lng]);if(!result||distance<result.distance)result={distance,record:p};}return result;}
 function openList(){closeSheet();cancelPlacement();closeList();list=create('div',{className:'cm-list'},source.list());list.dataset.page='0';doc.body.append(list);listen(list.querySelector('.cm-view-head button'),'click',closeList);list.querySelectorAll('.cm-folder-tab').forEach((button,i)=>listen(button,'click',()=>listPage(i)));let x=null;listen(list,'touchstart',e=>{if(e.touches.length===1)x=e.touches[0].clientX;},{passive:true});listen(list,'touchend',e=>{if(x!==null&&e.changedTouches.length===1){const dx=e.changedTouches[0].clientX-x;if(Math.abs(dx)>55)listPage(dx<0?1:0);}x=null;},{passive:true});listen(list,'touchcancel',()=>{x=null;},{passive:true});listPage(0);}
 function listPage(page){if(!list)return;list.dataset.page=String(page);const v=frame().pois.filter(p=>!p.deleted),tabs=list.querySelectorAll('.cm-folder-tab'),root=list.querySelector('.cm-folder-body');tabs[0].textContent='新規ゲームスポット '+v.filter(p=>p.role==='new').length;tabs[1].textContent='既存POI '+v.filter(p=>p.role!=='new').length;tabs.forEach((t,i)=>t.classList.toggle('active',i===page));for(const child of [...root.children])destroy(child);
  for(const p of v.filter(p=>(p.role==='new')===(page===0))){const key=(p.role==='new'?'new-':'existing-')+p.kind,iconHtml=p.role==='new'?'<img src="'+source.types[key].icon+'">':'<span class="cm-existing-dot" style="background:'+source.layerDefs.find(x=>x[0]===key)[2]+'"></span>',near=nearest(p,p.id),marks=(String(p.memo||'').trim()?'📝 ':'')+(p.role==='new'&&near?.distance<50?'⚠️':'');const button=create('button',{className:'cm-list-row'},source.listRow(p,marks,iconHtml));listen(button,'click',()=>{closeList();map.setView([p.lat,p.lng],Math.max(map.getZoom(),18),{animate:true});later(()=>openSheet(p.id),180);});root.append(button);}
  if(!root.children.length)root.innerHTML='<div style="padding:22px;text-align:center;color:#8a7a60;font-size:12px">まだありません</div>';
 }
 function toolState(){doc.querySelectorAll('#toolMenu button').forEach(b=>b.classList.toggle('active',b.dataset.tool===ui.tool));id('undo').disabled=ui.tool==='polygon'?!draftPoints.length:!(frame().history.undo>0);id('redo').disabled=ui.tool==='polygon'?!draftRedo.length:!(frame().history.redo>0);}
 function clearDraft(){for(const l of draftLayers)map?.removeLayer(l);draftLayers=[];draftPoints=[];draftRedo=[];areaClosing=false;destroy(areaAction);areaAction=null;destroy(areaCrosshair);areaCrosshair=null;destroy(areaCancel);areaCancel=null;}
 function clearTools(){clearDraft();for(const l of rulerLayers)map?.removeLayer(l);rulerLayers=[];destroy(rulerExit);rulerExit=null;destroy(areaMenu);areaMenu=null;for(const l of deleteLayers){l.off();map?.removeLayer(l);}deleteLayers=[];destroy(areaDelete);areaDelete=null;ui.tool='';toolState();}
 function beginArea(){clearTools();cancelPlacement();closePanels();ui.tool='polygon';areaCrosshair=present('ensurePolyCrosshair','d',source.polygonCrosshair());areaAction=present('ensurePolyAction','b');areaCancel=present('ensurePolyAction','x');doc.body.append(areaCrosshair,areaAction,areaCancel);listen(areaCancel,'click',()=>{clearTools();message('活動範囲の作成をキャンセルしました');});listen(areaAction,'click',()=>{if(areaClosing){hold({type:'area-create',points:draftPoints.map(p=>[...p])});return;}const c=map.getCenter(),last=draftPoints.at(-1);if(last&&map.distance(last,c)<2){message('少し移動してから点を打ってください',1200);return;}draftPoints.push([c.lat,c.lng]);draftRedo=[];updateAreaPreview();toolState();});updateAreaPreview();toolState();}
 function updateAreaPreview(){if(!areaAction||!map)return;for(const layer of draftLayers)map.removeLayer(layer);draftLayers=[];areaClosing=draftPoints.length>=3&&map.latLngToContainerPoint(draftPoints[0]).distanceTo(map.getSize().divideBy(2))<=30;const c=map.getCenter(),points=draftPoints.length?[...draftPoints,areaClosing?draftPoints[0]:[c.lat,c.lng]]:[];
  if(points.length>=2)draftLayers.push(L.polyline(points,{pane:'polygon',color:'#5a8b5f',weight:3,interactive:false}).addTo(map));if(points.length>=3)draftLayers.push(L.polygon(points,{pane:'polygon',color:'#5a8b5f',weight:0,fillColor:'#6ea979',fillOpacity:.09,interactive:false}).addTo(map));draftPoints.forEach((ll,i)=>draftLayers.push(L.marker(ll,{icon:L.divIcon(source.polygonIcon(i===0,areaClosing)),pane:'polygon',interactive:false,zIndexOffset:1500}).addTo(map)));areaAction.textContent=areaClosing?'活動範囲を作成！':'点を打つ';areaAction.style.background=areaClosing?'linear-gradient(180deg,#f3d77f,#c58c1f)':'#fff8e6';
 }
 function openAreaChoice(){if(!frame().areas.some(p=>!p.deleted)){beginArea();return;}clearTools();closePanels();areaMenu=present('openPolygonChoice','w');const draw=present('openPolygonChoice','a'),remove=present('openPolygonChoice','d'),cancel=present('openPolygonChoice','c');areaMenu.append(draw,remove,cancel);doc.body.append(areaMenu);listen(draw,'click',()=>{hold({type:'area-redraw'});beginArea();});listen(remove,'click',beginAreaDelete);listen(cancel,'click',()=>{destroy(areaMenu);areaMenu=null;});}
 function beginAreaDelete(){clearTools();closePanels();for(const p of frame().areas.filter(p=>!p.deleted)){const layer=L.polygon(p.points,{pane:'polygon',color:'#d6453d',weight:4,fillColor:'#d6453d',fillOpacity:.10,interactive:true}).addTo(map);layer.on('click',e=>{L.DomEvent.stopPropagation(e);destroy(areaDelete);const w=present('showPolygonDeleteConfirm','w'),del=present('showPolygonDeleteConfirm','d'),back=present('showPolygonDeleteConfirm','b');areaDelete=w;deleteLayers.forEach(l=>l.setStyle({color:l===layer?'#d6453d':'#bf6b66',weight:l===layer?6:4,fillColor:'#d6453d',fillOpacity:l===layer?.18:.08}));w.append(del,back);doc.body.append(w);listen(del,'click',()=>hold({type:'area-delete',id:p.id}));listen(back,'click',()=>{destroy(w);areaDelete=null;deleteLayers.forEach(l=>l.setStyle({color:'#d6453d',weight:4,fillColor:'#d6453d',fillOpacity:.10}));});});deleteLayers.push(layer);}message('削除する活動範囲を選択',0);}
 function beginRuler(){clearTools();cancelPlacement();closePanels();ui.tool='ruler';toolState();message('始点をクリック / タップしてください',0);}
 function rulerPoint(ll){if(!rulerLayers.length){rulerLayers.push(L.circleMarker(ll,{radius:6,color:'#263e73',fillColor:'#fff',fillOpacity:1,pane:'ruler'}).addTo(map));message('始点を設定しました。終点をクリック / タップしてください',0);return;}if(rulerLayers.length===1){rulerLayers.push(L.circleMarker(ll,{radius:6,color:'#263e73',fillColor:'#fff',fillOpacity:1,pane:'ruler'}).addTo(map));rulerLayers.push(L.polyline([rulerLayers[0].getLatLng(),ll],{color:'#344e84',weight:4,pane:'ruler'}).addTo(map));}else{rulerLayers[1].setLatLng(ll);rulerLayers[2].setLatLngs([rulerLayers[0].getLatLng(),ll]);}message('距離 '+map.distance(rulerLayers[0].getLatLng(),ll).toFixed(1)+'m',0);if(!rulerExit){rulerExit=present('beginRuler','exit');doc.body.append(rulerExit);listen(rulerExit,'click',()=>{clearTools();message('物差しを終了しました',1000);});}}
 function renderLayers(){
  const root=id('layerRows');if(!root)return;for(const child of [...root.children])destroy(child);
  for(const [key,label]of source.layerDefs){
   const row=create('div',{className:'layer-row'}),b=create('button',{type:'button',textContent:label});
   b.classList.toggle('active',ui.visibleLayers[key]);b.setAttribute('aria-pressed',String(ui.visibleLayers[key]));row.append(b);root.append(row);
   listen(b,'click',()=>{const visible=!b.classList.contains('active');b.classList.toggle('active',visible);b.setAttribute('aria-pressed',String(visible));
    ui.visibleLayers[key]=visible;viewLayers.filter(x=>x.key===key).forEach(x=>{if(visible)x.layer.addTo(map);else map.removeLayer(x.layer);});renderCircles();message((visible?'表示：':'非表示：')+label);});
  }
  for(const radius of [50,40,30]){
   const row=create('div',{className:'layer-row cm-circle-layer-row'}),b=create('button',{type:'button',textContent:radius+'m円'});
   b.classList.toggle('active',ui.circleRadii.includes(radius));b.setAttribute('aria-pressed',String(ui.circleRadii.includes(radius)));row.append(b);root.append(row);
   listen(b,'click',()=>{ui.circleRadii=ui.circleRadii.includes(radius)?ui.circleRadii.filter(r=>r!==radius):[...ui.circleRadii,radius].sort((a,b)=>b-a);renderCircles();renderLayers();message((ui.circleRadii.includes(radius)?'表示：':'非表示：')+radius+'m円',1000);});
  }
  const row=create('div',{className:'layer-row'}),b=create('button',{type:'button',textContent:frame().areas.length?'活動範囲 (1)':'活動範囲',disabled:!frame().areas.length});row.append(b);root.append(row);
  b.classList.toggle('active',ui.areaVisible&&frame().areas.length>0);b.setAttribute('aria-pressed',String(ui.areaVisible&&frame().areas.length>0));listen(b,'click',()=>{ui.areaVisible=!ui.areaVisible;viewLayers.filter(x=>x.key==='area').forEach(x=>ui.areaVisible?x.layer.addTo(map):map.removeLayer(x.layer));renderLayers();message((ui.areaVisible?'表示：':'非表示：')+'活動範囲');});
  const missing=!frame().areas.length;doc.body.classList.toggle('cm-v77-activity-missing',missing);id('layerButton')?.classList.toggle('cm-v77-layer-hint',missing);b.classList.toggle('cm-v77-activity-hint',missing);
 }
 function renderCircles(){for(const layer of recordCircles)map?.removeLayer(layer);recordCircles=[];if(!map)return;for(const radius of ui.circleRadii)for(const p of frame().pois.filter(p=>!p.deleted&&ui.visibleLayers[(p.role==='new'?'new-':'existing-')+p.kind])){const options=source['recordCircle'+radius](circleRenderer);delete options.renderer;recordCircles.push(L.circle([p.lat,p.lng],options).addTo(map));}}
 function render(){
  if(stopped)return;
  const v=frame();id('cmCount').textContent=v.pois.filter(p=>p.role==='new'&&!p.deleted).length+' / 25';
  id('undo').disabled=!(v.history.undo>0);id('redo').disabled=!(v.history.redo>0);
  if(map){
   for(const x of viewLayers){x.layer.off();map.removeLayer(x.layer);}viewLayers=[];
   for(const p of v.pois.filter(p=>!p.deleted)){
    const css='cm-v45-'+(p.kind==='gym'?'gym':p.kind==='power'?'power':'stop');
    const kind=p.kind==='gym'?'GYM':p.kind==='power'?'POWERSPOT':'POKESTOP';
    const icon=p.role==='new'?L.icon(source.displayCandidateIcon(source.markerUrls[kind])):L.divIcon(source.displayExistingIcon(css,'cm-engine-existing-icon'));
    const layer=L.marker([p.lat,p.lng],{icon,draggable:false,zIndexOffset:p.role==='new'?20:0});if(ui.visibleLayers[(p.role==='new'?'new-':'existing-')+p.kind])layer.addTo(map);
    layer.on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e.originalEvent);openSheet(p.id);});viewLayers.push({key:(p.role==='new'?'new-':'existing-')+p.kind,layer});
   }
   for(const p of v.areas.filter(p=>!p.deleted)){const layer=L.polygon(p.points,{pane:'polygon',color:'#5a8b5f',weight:3,fillColor:'#6ea979',fillOpacity:.09,interactive:false});if(ui.areaVisible)layer.addTo(map);viewLayers.push({key:'area',layer});}
  }
  renderCircles();renderLayers();if(list)listPage(Number(list.dataset.page));toolState();
 }
 function showMap(){
  if(stopped)return;id('entry').classList.add('hidden');map?.invalidateSize();
  const v=frame();if(map&&v.pois.length)map.fitBounds(v.pois.map(p=>[p.lat,p.lng]),{padding:[28,28],maxZoom:18,animate:false});
  render();if(!ui.dragged)raf(positionFab);
 }
 function transition(done=showMap){
  if(stopped)return;
  if(id('entry').classList.contains('hidden')){done();return;}
  id('entry').classList.add('cm-v58-starting');id('startButton').disabled=true;
  later(()=>{try{done();}finally{id('entry').classList.remove('cm-v58-starting');}},1550);
 }
 function installRules(){
  const help=create('button',{id:'cmV59HelpButton',type:'button',textContent:'?',title:'設計ルール'});help.setAttribute('aria-label','設計ルール');doc.body.append(help);
  const panel=create('section',{id:'cmV60RulesPanel',hidden:true},source.rules());
  panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-label','設計ルール');doc.body.append(panel);
  const activity=create('li',{className:'cm-v77-activity-rule'},source.activityRule());panel.querySelector('.cm-v60-card[data-card="2"] .cm-v60-rules').prepend(activity);
  const track=panel.querySelector('#cmV60RulesTrack'),dots=[...panel.querySelectorAll('#cmV60RulesDots button')],cards=[...panel.querySelectorAll('.cm-v60-card')],close=id('cmV60RulesClose');
  const active=i=>dots.forEach((n,j)=>{n.classList.toggle('is-active',i===j);if(i===j)n.setAttribute('aria-current','true');else n.removeAttribute('aria-current');});
  const hide=()=>{panel.hidden=true;doc.body.classList.remove('cm-v60-rules-open');help.focus({preventScroll:true});};
  listen(help,'click',()=>{panel.hidden=false;doc.body.classList.add('cm-v60-rules-open');track.scrollLeft=0;active(0);raf(()=>close.focus({preventScroll:true}));});
  listen(close,'click',hide);dots.forEach((n,i)=>listen(n,'click',()=>{active(i);track.scrollTo({left:cards[i].offsetLeft-(track.clientWidth-cards[i].clientWidth)/2,behavior:'smooth'});}));
  listen(track,'scroll',()=>{if(rulesRaf)win.cancelAnimationFrame(rulesRaf);rulesRaf=raf(()=>{const center=track.getBoundingClientRect().left+track.clientWidth/2;let index=0,distance=Infinity;cards.forEach((n,i)=>{const r=n.getBoundingClientRect(),d=Math.abs((r.left+r.right)/2-center);if(d<distance){distance=d;index=i;}});active(index);});},{passive:true});
  listen(doc,'keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide();});
 }
 function feedback(position){
  if(stopped||!map||win.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const target=id('cmCount'),mr=map.getContainer().getBoundingClientRect(),point=map.latLngToContainerPoint([position.lat,position.lng]),tr=target.getBoundingClientRect();
  const sx=mr.left+point.x,sy=mr.top+point.y,ex=tr.left+tr.width/2,ey=tr.top+tr.height/2,dx=ex-sx,dy=ey-sy,star=create('div',{className:'cm-v46-shooting-star'});Object.assign(star.style,{left:sx+'px',top:sy+'px',transform:'translate(-50%,-50%) rotate('+(Math.atan2(dy,dx)*180/Math.PI)+'deg)'});doc.body.append(star);
  const a=star.animate([{left:sx+'px',top:sy+'px',opacity:0,offset:0},{left:(sx+dx*.12)+'px',top:(sy+dy*.12)+'px',opacity:1,offset:.16},{left:ex+'px',top:ey+'px',opacity:.15,offset:1}],{duration:430,easing:'cubic-bezier(.22,.72,.24,1)',fill:'forwards'});animations.add(a);a.onfinish=()=>{animations.delete(a);destroy(star);if(stopped)return;target.classList.remove('cm-v46-count-pop');void target.offsetWidth;target.classList.add('cm-v46-count-pop');later(()=>target.classList.remove('cm-v46-count-pop'),320);};
 }
 for(const style of source.dynamicStyles){const n=create('style',{id:style.id,textContent:style.css});doc.head.append(n);}
 id('entry').classList.add('cm-v58-new-entry');
 id('entry').querySelector('.entry-title').textContent='CREATIVE MODE';
 id('entry').querySelector('.entry-copy').textContent='新しい世界の幕開けへ。';
 id('startButton').textContent='創作をはじめる';
 const filebar=id('entry').querySelector('.filebar');filebar.querySelector('span:first-child').textContent='▱';filebar.querySelector('strong').textContent='地図データ（KMZ）を選択';
 id('entryState').textContent='先にCSV / KMZを選択してください';id('resumeButton').textContent='前回のデータから再開';id('resumeButton').style.display='none';
 const recent=create('div',{id:'cmRecent',className:'cm-recent'});recent.style.display='none';doc.querySelector('.entry-panel').prepend(recent);
 const transitionImage=create('div',{id:'cmV58StartTransition'});transitionImage.setAttribute('aria-hidden','true');id('entry').append(transitionImage);
 const fab=descriptor('cmInstallFab',source.fab(source.types));doc.body.append(fab);const button=id('cmAddFab');
 button.setAttribute('aria-label','候補地を追加');button.title='候補地を追加';
 Object.assign(button.style,{touchAction:'none',userSelect:'none',webkitUserSelect:'none'});
 let drag=null,suppressClick=false;
 const moveFab=(x,y)=>{const bottom=doc.querySelector('.bottom-bar').getBoundingClientRect().top;fab.style.setProperty('left',Math.max(8,Math.min(win.innerWidth-64,x))+'px','important');fab.style.setProperty('top',Math.max(8,Math.min(bottom-64,y))+'px','important');};
 const toggleMenu=()=>{if(!ui.menu&&frame().pois.filter(p=>p.role==='new'&&!p.deleted).length>=25){message('追加ゲームスポットは最大25個です',1800);return;}ui.menu=!ui.menu;syncFab();};
 listen(button,'pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;suppressClick=false;const r=fab.getBoundingClientRect();drag={id:e.pointerId,x:r.x,y:r.y,sx:e.clientX,sy:e.clientY,moved:false};button.setPointerCapture?.(e.pointerId);});
 listen(button,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)<7)return;drag.moved=true;ui.dragged=true;e.preventDefault();moveFab(drag.x+dx,drag.y+dy);});
 listen(button,'pointerup',e=>{if(drag?.id!==e.pointerId)return;const moved=drag.moved;if(!moved&&e.pointerType!=='touch')toggleMenu();suppressClick=moved||e.pointerType!=='touch';drag=null;button.releasePointerCapture?.(e.pointerId);if(suppressClick&&e.cancelable)e.preventDefault();});
 listen(button,'pointercancel',()=>{drag=null;});
 listen(button,'click',e=>{e.preventDefault();e.stopPropagation();if(suppressClick){suppressClick=false;return;}if(ui.menu&&ui.mode==='add')cancelPlacement();else toggleMenu();});
 fab.querySelectorAll('.cm-bubble').forEach(n=>listen(n,'click',e=>{e.stopPropagation();ui.layer=n.dataset.layer;place('add');}));
 const count=descriptor('cmInstallCount');doc.body.append(count);listen(count,'click',openList);
 const save=descriptor('cmInstallStandaloneSave');doc.body.append(save);listen(save,'click',openSave);
 installRules();
 id('undo').textContent='↶ 元に戻す';id('redo').textContent='やり直す ↷';
 listen(id('leftHand'),'click',()=>applyHand('left'));listen(id('rightHand'),'click',()=>applyHand('right'));
 listen(id('back'),'click',()=>{cancelPlacement();clearTools();closeSheet();closeSave();closeChooser();closeList();closeCoords();closePanels();id('entry').classList.remove('hidden');});
 for(const [buttonId,panelId]of [['layerButton','layerPanel'],['toolbox','toolMenu']])listen(id(buttonId),'click',()=>{const open=!id(panelId).classList.contains('open');closePanels();id(panelId).classList.toggle('open',open);});
 listen(id('mapToggle'),'click',()=>{closePanels();ui.aerial=!ui.aerial;map.removeLayer(tiles);tiles=L.tileLayer(ui.aerial?'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}':'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:ui.aerial?'Tiles © Esri':'© OpenStreetMap contributors'}).addTo(map);if(ui.aerial)id('mapLicense').textContent='Tiles © Esri';else id('mapLicense').innerHTML='<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';});
 for(const n of doc.querySelectorAll('#toolMenu button')){if(n.dataset.tool==='add'){n.remove();continue;}listen(n,'click',()=>{closePanels();if(n.dataset.tool==='polygon')openAreaChoice();else if(n.dataset.tool==='ruler'){if(ui.tool==='ruler')clearTools();else beginRuler();}});}
 listen(id('undo'),'click',()=>{if(ui.tool==='polygon'){if(draftPoints.length)draftRedo.push(draftPoints.pop());updateAreaPreview();toolState();}else hold({type:'undo'});});listen(id('redo'),'click',()=>{if(ui.tool==='polygon'){if(draftRedo.length)draftPoints.push(draftRedo.pop());updateAreaPreview();toolState();}else hold({type:'redo'});});
 listen(id('entryFile'),'change',()=>{const file=id('entryFile').files?.[0];id('startButton').disabled=!file;id('startButton').classList.toggle('ready',!!file);if(!file){id('entryFileName').textContent='未選択';return;}id('entryFileName').textContent=file.name;id('entryState').textContent='HOLD：KMZ読込は未接続です';hold({type:'prepare',fileName:file.name});});
 listen(id('startButton'),'click',()=>{hold({type:'acceptPrepared'});transition();});
 listen(win,'resize',()=>{if(!ui.dragged)positionFab();else{const r=fab.getBoundingClientRect();moveFab(r.x,r.y);}map?.invalidateSize();});
 listen(doc,'dblclick',e=>{if(e.target?.closest?.('button,input,textarea,select'))e.preventDefault();},true);
 doc.body.classList.add('cm-unified-renderer-interactive');initMap();applyHand('right');render();syncFab();
 return Object.freeze({
  render,showMap,transition,openSheet,feedback,setHand:applyHand,
  onCommand(sink){if(stopped)throw Error('UI_STOPPED');if(sink!==null&&typeof sink!=='function')throw Error('COMMAND_SINK_REQUIRED');commandSink=sink;},
  setCamera(camera){if(map&&camera)map.setView(camera.center,camera.zoom,{animate:false,reset:true});},
  setViewReader(provider){if(stopped||typeof provider!=='function')throw Error('READ_VIEW_REQUIRED');reader=provider;ui.areaVisible=frame().areas.length>0;ui.circleRadii=[...new Set(frame().circles.map(c=>c.radius))];render();},
  onRequest(fn){if(stopped)throw Error('UI_STOPPED');if(typeof fn!=='function')throw Error('OBSERVER_REQUIRED');observer=fn;},
  status:()=>Object.freeze({mode:commandSink?'PART_B1_POI_ONLY':'PART_A_VIEW_ONLY',dataConnected:!!commandSink,stopped,mapCount:map?1:0,proposals:sequence,resources:{listeners:listeners.size,timers:timers.size,rafs:rafs.size,animations:animations.size,observers:0,owned:owned.size},camera:map?{center:[map.getCenter().lat,map.getCenter().lng],zoom:map.getZoom()}:null,ui:{...ui},areaPreview:{points:draftPoints.map(p=>[...p]),closing:areaClosing},preview:previewCircle?{radius:previewCircle.getRadius(),position:previewCircle.getLatLng()}:null}),
  dispose(){
   if(stopped)return;stopped=true;commandSink=null;observer=()=>{};reader=()=>EMPTY;for(const item of listeners)item.remove();listeners.clear();for(const t of timers)win.clearTimeout(t);timers.clear();for(const r of rafs)win.cancelAnimationFrame(r);rafs.clear();for(const a of animations){a.onfinish=null;a.cancel();}animations.clear();
   removePreview();clearTools();closeSheet();closeSave();closeChooser();closeList();closeCoords();for(const x of viewLayers)x.layer.off();viewLayers=[];recordCircles=[];
   // Leaflet 1.9.4 retains DOM scroll/canvas/transition handlers after remove().
   // Release listeners on the exclusively owned map subtree before removing it.
   if(map){const root=map.getContainer();for(const n of [root,...root.querySelectorAll('*')])L.DomEvent.off(n);map.remove();}map=null;
   for(const n of owned)n.remove();owned.clear();delete doc.documentElement.dataset.r31UiOwner;
  }
 });
}
if(globalThis.document&&!globalThis.creativeR31)globalThis.creativeR31=mountCreativeUi();
