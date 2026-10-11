// PART A presentation controller. No editor/store/history/KMZ/storage imports.
// Source-derived templates/styles live in source-templates.mjs; connection code lives here.
import * as source from './source-templates.mjs';
const EMPTY=Object.freeze({pois:[],circles:[],areas:[],history:{undo:0,redo:0}});
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
export function mountCreativeUi({document:doc=globalThis.document,L=globalThis.L,readView=()=>EMPTY,onRequest=()=>{}}={}){
 if(doc.documentElement.dataset.r31UiOwner||doc.getElementById('map')?._leaflet_id)throw Error('UI_ALREADY_MOUNTED');
 doc.documentElement.dataset.r31UiOwner='view-only';
 const win=doc.defaultView,id=n=>doc.getElementById(n),listeners=[],timers=new Set(),rafs=new Set(),owned=new Set();
 let stopped=false,map=null,tiles=null,circleRenderer=null,coordinatePanel=null,previewCircle=null,selectedCircle=null,sheet=null,bar=null,dot=null,saveMenu=null,list=null,rulesRaf=0;
 let reader=readView,observer=onRequest,sequence=0,viewLayers=[];
 const ui={hand:'right',menu:false,mode:null,layer:'new-pokestop',radius:50,selected:null,dragged:false};
 const listen=(target,type,fn,options)=>{if(!target)return;target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));};
 const later=(fn,ms)=>{const t=win.setTimeout(()=>{timers.delete(t);if(!stopped)fn();},ms);timers.add(t);return t;};
 const raf=fn=>{const r=win.requestAnimationFrame(()=>{rafs.delete(r);if(!stopped)fn();});rafs.add(r);return r;};
 const own=node=>{owned.add(node);return node;};
 const create=(tag,attrs={},html=null)=>{const n=own(doc.createElement(tag));for(const [k,v]of Object.entries(attrs))n[k]=v;if(html!==null)n.innerHTML=html;return n;};
 function descriptor(name,html=null){const d=source.descriptors[name];const n=create(d.tag,d.properties,html);for(const [k,v]of Object.entries(d.attributes))n.setAttribute(k,v);return n;}
 function frame(){
  // Copy input as a view projection. Never retain engine objects or mutate supplied data.
  const supplied=reader()||EMPTY;
  return JSON.parse(JSON.stringify({pois:supplied.pois||[],circles:supplied.circles||[],areas:supplied.areas||[],history:supplied.history||{undo:0,redo:0}}));
 }
 function message(text,ms=1600){const n=id('status');if(!n)return;n.textContent=text;n.classList.remove('fade');if(ms)later(()=>n.classList.add('fade'),ms);}
 function hold(action){
  if(stopped)return{status:'STOPPED',changed:false};
  const result=Object.freeze({status:'HOLD',changed:false,reason:'PART_A_DATA_DISCONNECTED'});
  observer(Object.freeze({...action,requestId:'r31-ui-'+(++sequence)}),result);
  message('HOLD：データ処理は未接続です');
  return result;
 }
 function closePanels(){for(const n of ['layerPanel','circlePanel','toolMenu'])id(n)?.classList.remove('open');}
 function closeSheet(){sheet?.remove();sheet=null;ui.selected=null;if(selectedCircle&&map)map.removeLayer(selectedCircle);selectedCircle=null;}
 function closeSave(){saveMenu?.remove();saveMenu=null;doc.body.classList.remove('cm-save-chooser-open');}
 function syncFab(){
  const wrap=id('cmFabWrap'),fab=id('cmAddFab'),selected=id('cmSelectedType');if(!wrap)return;
  wrap.classList.toggle('open',ui.menu);fab.textContent=ui.menu?'×':'＋';
  wrap.querySelectorAll('.cm-bubble').forEach(n=>n.classList.toggle('selected',n.dataset.layer===ui.layer&&ui.mode==='add'));
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
  ui.hand=hand;doc.body.className=hand==='left'?'left-hand':'right-hand';
  id('leftHand')?.classList.toggle('active',hand==='left');id('rightHand')?.classList.toggle('active',hand!=='left');
  raf(positionFab);
 }
 function initMap(){
  if(map||!L?.map)return;
  map=L.map('map',{zoomControl:false,doubleClickZoom:false}).setView([35.6812,139.7671],16);
  for(const [name,css]of [['distance','distance-pane'],['polygon','polygon-pane'],['placement','placement-pane'],['ruler','ruler-pane']])map.createPane(name).classList.add(css);
  map.attributionControl.setPosition('bottomleft');map.attributionControl.setPrefix(false);circleRenderer=L.canvas({padding:.5,pane:'distance'});
  tiles=L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:20,attribution:'© OpenStreetMap contributors'}).addTo(map);
  const onMove=()=>updatePreview();map.on('move',onMove);listeners.push(()=>map?.off('move',onMove));
 }
 function removePreview(){
  if(previewCircle&&map)map.removeLayer(previewCircle);previewCircle=null;
  bar?.remove();dot?.remove();bar=null;dot=null;id('cmSafeNearestWarning')?.remove();coordinatePanel?.remove();coordinatePanel=null;
  doc.body.classList.remove('cm-placement-docked');
 }
 function cancelPlacement(){removePreview();ui.mode=null;ui.menu=false;syncFab();}
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
   coordinatePanel=create('section',{id:'cmCoordinateJumpPanel',hidden:true},source.coordinatePanel());
   coordinatePanel.setAttribute('aria-label','座標で位置を合わせる');doc.body.append(coordinatePanel);
   const input=id('cmCoordinateInput'),error=coordinatePanel.querySelector('.cm-coordinate-error');
   // Source v53 requests the ordinary text keyboard; this is a view setting only.
   input.type='text';input.removeAttribute('inputmode');
   const apply=()=>{
    const parts=String(input.value).trim().replace(/，/g,',').split(',').map(x=>Number(x.trim()));
    if(parts.length!==2||!parts.every(Number.isFinite)||Math.abs(parts[0])>90||Math.abs(parts[1])>180){error.textContent='「緯度, 経度」の形式で入力してください';return;}
    input.blur();map?.setView(parts,map.getZoom(),{animate:false});coordinatePanel.hidden=true;updatePreview();
   };
   listen(coordinatePanel.querySelector('.cm-coordinate-close'),'click',()=>{coordinatePanel.hidden=true;});
   listen(id('cmCoordinateApply'),'click',apply);
   listen(input,'keydown',e=>{if(e.key==='Enter'){e.preventDefault();apply();}});
  }
  coordinatePanel.hidden=false;coordinatePanel.querySelector('.cm-coordinate-error').textContent='';
  const bottom=Math.max(86,win.innerHeight-bar.getBoundingClientRect().top+50);
  coordinatePanel.style.bottom=Math.min(Math.max(bottom,110),Math.max(110,win.innerHeight-210))+'px';
  later(()=>id('cmCoordinateInput')?.focus(),30);
 }

 function attachLever(node){
  let origin=null;
  listen(node,'pointerdown',e=>{origin={id:e.pointerId,y:e.clientY,radius:ui.radius};node.setPointerCapture?.(e.pointerId);e.preventDefault();});
  listen(node,'pointermove',e=>{if(!origin||origin.id!==e.pointerId)return;ui.radius=Math.max(30,Math.min(50,origin.radius-(e.clientY-origin.y)/2.2));updatePreview();e.preventDefault();});
  for(const type of ['pointerup','pointercancel'])listen(node,type,e=>{if(!origin||origin.id!==e.pointerId)return;origin=null;node.releasePointerCapture?.(e.pointerId);});
 }
 function place(mode,poi=null){
  if(stopped||!map)return;
  closeSheet();closePanels();closeSave();removePreview();ui.mode=mode;ui.menu=false;ui.radius=50;
  ui.selected=poi?.id||null;
  if(mode==='add'){
   dot=descriptor('cmSafeAddDotElement',source.addDot());doc.body.append(dot);dot.style.setProperty('display','grid','important');
   const meta=source.types[ui.layer];
   bar=create('div',{id:'cmSafeAddBar',className:'cm-safe-add-bar'},source.selectedPoi(meta)+source.addBarTail());
   doc.body.append(bar);
   listen(id('cmSafeAddConfirm'),'click',()=>hold({type:'add',kind:ui.layer,position:{...map.getCenter()}}));
   listen(id('cmSafeAddCancel'),'click',cancelPlacement);
   attachLever(id('cmSafeAddLever'));
  }else{
   dot=descriptor('cmMoveCrosshairElement',source.moveCrosshair());doc.body.append(dot);dot.style.display='block';
   bar=create('div',{id:'cmMoveBar',className:'cm-move-bar'},source.moveBar());doc.body.append(bar);
   listen(id('cmMoveConfirm'),'click',()=>hold({type:'move',id:poi.id,position:{...map.getCenter()}}));
   listen(id('cmMoveCancel'),'click',cancelPlacement);attachLever(id('cmMoveLever'));
  }
  const coordinate=descriptor('coordinateButton');bar.append(coordinate);listen(coordinate,'click',openCoordinate);
  previewCircle=L.circle(map.getCenter(),mode==='add'?source.addCircleOptions(ui.radius,circleRenderer):source.moveCircleOptions(circleRenderer)).addTo(map);
  doc.body.classList.add('cm-placement-docked');syncFab();updatePreview();
 }
 function openSheet(poiId){
  const poi=frame().pois.find(p=>p.id===poiId&&!p.deleted);if(!poi)return false;
  cancelPlacement();closeSheet();closePanels();ui.selected=poi.id;
  const r={...poi,layer:(poi.role==='new'?'new-':'existing-')+poi.kind,latlng:[poi.lat,poi.lng]};
  const label=source.types[r.layer]?.label||source.layerDefs.find(x=>x[0]===r.layer)?.[1]||r.layer;
  sheet=create('div',{className:'cm-sheet'},poi.role==='new'?source.newSheet(r,label,null,source.types):source.existingSheet(r,label));
  doc.body.append(sheet);listen(sheet.querySelector('.cm-sheet-close'),'click',closeSheet);
  if(map)selectedCircle=L.circle([poi.lat,poi.lng],{radius:50,color:'#d18a00',fillColor:'#d18a00',weight:2,fillOpacity:.055,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);
  if(poi.role==='new'){
   listen(sheet.querySelector('#cmName'),'input',e=>hold({type:'edit',id:poi.id,patch:{title:e.target.value.slice(0,30)}}));
   listen(sheet.querySelector('#cmMemo'),'input',e=>hold({type:'edit',id:poi.id,patch:{memo:e.target.value.slice(0,50)}}));
   listen(sheet.querySelector('#cmMove'),'click',()=>place('move',poi));
   listen(sheet.querySelector('#cmType'),'click',()=>sheet.querySelector('#cmTypePicker').classList.toggle('open'));
   listen(sheet.querySelector('#cmDelete'),'click',()=>hold({type:'delete',id:poi.id}));
   sheet.querySelectorAll('#cmTypePicker button').forEach(n=>listen(n,'click',()=>hold({type:'change-kind',id:poi.id,kind:n.dataset.layer})));
  }
  let y=null;listen(sheet,'touchstart',e=>{if(e.touches.length===1)y=e.touches[0].clientY;},{passive:true});
  listen(sheet,'touchend',e=>{if(y!==null&&e.changedTouches.length===1&&e.changedTouches[0].clientY-y>65)closeSheet();y=null;},{passive:true});
  return true;
 }
 function openSave(){
  closeSave();saveMenu=create('div',{id:'cmStandaloneSaveMenu'},source.standaloneSave());
  // Production v63 removes this original manual-save button; do the same before presenting.
  saveMenu.querySelector('#cmStandaloneWorkspaceSave')?.remove();doc.body.append(saveMenu);
  listen(id('cmStandaloneKmz'),'click',()=>hold({type:'exportKmz'}));
  listen(id('cmStandaloneCoords'),'click',openCoords);
  listen(id('cmStandaloneClose'),'click',closeSave);
 }
 function openCoords(){
  closeSave();hold({type:'coordinate-view',reason:'CARD_TEMPLATE_NOT_SEPARATED'});
 }
 function renderLayers(){
  const root=id('layerRows');if(!root)return;root.replaceChildren();
  for(const [key,label]of source.layerDefs){
   const row=create('div',{className:'layer-row'}),b=create('button',{type:'button',textContent:label});
   b.classList.add('active');b.setAttribute('aria-pressed','true');row.append(b);root.append(row);
   listen(b,'click',()=>{const visible=!b.classList.contains('active');b.classList.toggle('active',visible);b.setAttribute('aria-pressed',String(visible));
    viewLayers.filter(x=>x.key===key).forEach(x=>{if(visible)x.layer.addTo(map);else map.removeLayer(x.layer);});});
  }
  for(const radius of [50,40,30]){
   const row=create('div',{className:'layer-row cm-circle-layer-row'}),b=create('button',{type:'button',textContent:radius+'m円'});
   b.classList.toggle('active',radius===50);b.setAttribute('aria-pressed',String(radius===50));row.append(b);root.append(row);
   listen(b,'click',()=>{b.classList.toggle('active');b.setAttribute('aria-pressed',String(b.classList.contains('active')));});
  }
  const row=create('div',{className:'layer-row'}),b=create('button',{type:'button',textContent:frame().areas.length?'活動範囲 (1)':'活動範囲',disabled:!frame().areas.length});row.append(b);root.append(row);
  const missing=!frame().areas.length;doc.body.classList.toggle('cm-v77-activity-missing',missing);id('layerButton')?.classList.toggle('cm-v77-layer-hint',missing);b.classList.toggle('cm-v77-activity-hint',missing);
 }
 function render(){
  if(stopped)return;
  const v=frame();id('cmCount').textContent=v.pois.filter(p=>p.role==='new'&&!p.deleted).length+' / 25';
  id('undo').disabled=!(v.history.undo>0);id('redo').disabled=!(v.history.redo>0);
  if(map){
   for(const x of viewLayers)map.removeLayer(x.layer);viewLayers=[];
   for(const p of v.pois.filter(p=>!p.deleted)){
    const css='cm-v73-'+(p.kind==='gym'?'gym':p.kind==='power'?'power':'stop');
    const icon=p.role==='new'?L.icon(source.newIconOptions(source.types['new-'+p.kind].icon)):L.divIcon(source.existingIconOptions(css));
    const layer=L.marker([p.lat,p.lng],{icon,draggable:false}).addTo(map);
    layer.on('click',()=>openSheet(p.id));viewLayers.push({key:(p.role==='new'?'new-':'existing-')+p.kind,layer});
   }
   for(const c of v.circles)viewLayers.push({key:'circle-'+c.radius,layer:L.circle([c.lat,c.lng],{radius:c.radius,interactive:false,pane:'distance',color:'#22a3ba',weight:1.2,fillOpacity:.04}).addTo(map)});
  }
  renderLayers();
 }
 function showMap(){
  if(stopped)return;id('entry').classList.add('hidden');map?.invalidateSize();
  const v=frame();if(map&&v.pois.length)map.fitBounds(v.pois.map(p=>[p.lat,p.lng]),{padding:[28,28],maxZoom:18});
  render();raf(positionFab);
 }
 function transition(done=showMap){
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
 listen(button,'pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const r=fab.getBoundingClientRect();drag={id:e.pointerId,x:r.x,y:r.y,sx:e.clientX,sy:e.clientY,moved:false};button.setPointerCapture?.(e.pointerId);});
 listen(button,'pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.sx,dy=e.clientY-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)<7)return;drag.moved=true;ui.dragged=true;e.preventDefault();Object.assign(fab.style,{left:Math.max(8,Math.min(win.innerWidth-64,drag.x+dx))+'px',top:Math.max(8,Math.min(win.innerHeight-120,drag.y+dy))+'px'});});
 listen(button,'pointerup',e=>{if(drag?.id!==e.pointerId)return;suppressClick=drag.moved;drag=null;button.releasePointerCapture?.(e.pointerId);});
 listen(button,'pointercancel',()=>{drag=null;});
 listen(button,'click',e=>{e.preventDefault();e.stopPropagation();if(suppressClick){suppressClick=false;return;}if(ui.mode)cancelPlacement();else{ui.menu=!ui.menu;syncFab();}});
 fab.querySelectorAll('.cm-bubble').forEach(n=>listen(n,'click',e=>{e.stopPropagation();ui.layer=n.dataset.layer;place('add');}));
 const count=descriptor('cmInstallCount');doc.body.append(count);listen(count,'click',()=>hold({type:'list',reason:'ROW_GROUP_NOT_SEPARATED'}));
 const save=descriptor('cmInstallStandaloneSave');doc.body.append(save);listen(save,'click',openSave);
 installRules();
 id('undo').textContent='↶ 元に戻す';id('redo').textContent='やり直す ↷';
 listen(id('leftHand'),'click',()=>applyHand('left'));listen(id('rightHand'),'click',()=>applyHand('right'));
 listen(id('back'),'click',()=>{cancelPlacement();closeSheet();closeSave();closePanels();id('entry').classList.remove('hidden');});
 for(const [buttonId,panelId]of [['layerButton','layerPanel'],['toolbox','toolMenu']])listen(id(buttonId),'click',()=>{const open=!id(panelId).classList.contains('open');closePanels();id(panelId).classList.toggle('open',open);});
 listen(id('mapToggle'),'click',()=>hold({type:'map-background',reason:'DISPLAY_GROUP_NOT_COMPLETED'}));
 for(const n of doc.querySelectorAll('#toolMenu button'))listen(n,'click',()=>hold({type:'tool',tool:n.dataset.tool}));
 listen(id('undo'),'click',()=>hold({type:'undo'}));listen(id('redo'),'click',()=>hold({type:'redo'}));
 listen(id('entryFile'),'change',()=>{const file=id('entryFile').files?.[0];if(!file)return;id('entryFileName').textContent=file.name;id('entryState').textContent='HOLD：KMZ読込は未接続です';hold({type:'prepare',fileName:file.name});});
 listen(id('startButton'),'click',()=>hold({type:'acceptPrepared'}));
 listen(win,'resize',()=>{if(!ui.dragged)positionFab();map?.invalidateSize();});
 listen(doc,'dblclick',e=>{if(e.target?.closest?.('button,input,textarea,select'))e.preventDefault();},true);
 initMap();applyHand('right');render();syncFab();
 return Object.freeze({
  render,showMap,transition,openSheet,setHand:applyHand,
  setCamera(camera){if(map&&camera)map.setView(camera.center,camera.zoom,{animate:false});},
  setViewReader(provider){if(stopped||typeof provider!=='function')throw Error('READ_VIEW_REQUIRED');reader=provider;render();},
  onRequest(fn){if(stopped)throw Error('UI_STOPPED');if(typeof fn!=='function')throw Error('OBSERVER_REQUIRED');observer=fn;},
  status:()=>Object.freeze({mode:'PART_A_VIEW_ONLY',dataConnected:false,stopped,mapCount:map?1:0,proposals:sequence,ui:{...ui},preview:previewCircle?{radius:previewCircle.getRadius(),position:previewCircle.getLatLng()}:null}),
  dispose(){
   if(stopped)return;stopped=true;observer=()=>{};reader=()=>EMPTY;for(const remove of listeners)remove();for(const t of timers)win.clearTimeout(t);for(const r of rafs)win.cancelAnimationFrame(r);
   removePreview();closeSheet();closeSave();list?.remove();map?.remove();map=null;
   for(const n of owned)n.remove();owned.clear();delete doc.documentElement.dataset.r31UiOwner;
  }
 });
}
if(globalThis.document&&!globalThis.creativeR31)globalThis.creativeR31=mountCreativeUi();
