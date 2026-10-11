import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalPoiPopup} from '../integration/creative-next-original-poi-popup.mjs';
import {attachCreativeNextOverlay} from '../integration/creative-next-original-leaflet-overlay.mjs';
function element(tag){
 const item={tag,id:'',value:'',textContent:'',className:'',innerHTML:'',children:[],events:{},
  classList:{classes:new Set(),add(name){this.classes.add(name)}},
  append(...nodes){this.children.push(...nodes)},
  addEventListener(type,fn){this.events[type]=fn},
  click(){this.events.click?.({preventDefault(){},stopPropagation(){}})},
  querySelector(selector){return this.parts?.[selector]||null}
 };
 if(tag==='div')Object.defineProperty(item,'innerHTML',{get(){return this.html||''},set(html){
   this.html=html;
   const parts={};
   for(const id of ['editBtn','deleteBtn','editTitle','editMemo','saveEdit','moveLayer','applyLayer']){
    parts['#'+id]=element(id==='moveLayer'?'select':'button');
   }
   for(const cls of ['popup-title','popup-layer','popup-edit','popup-actions'])parts['.'+cls]=element('div');
   this.parts=parts;
 }});
 return item;
}
const sample=({id='safe',role='existing',kind='pokestop',title='<img src=x onerror=alert(1)>',memo='旧メモ'}={})=>
 ({id,role,kind,title,memo,lat:35.7,lng:139.8,deleted:false});
function harness(poi=sample()){
 const records=[poi],commands=[],messages=[];
 let updates=0,closed=0,popup=null,moveId=null,stopped=0;
 const document={createElement:element},L={
  DomEvent:{disableClickPropagation(){stopped++},disableScrollPropagation(){stopped++}},
  popup(){return {setLatLng(){return this},setContent(value){popup=value;return this},openOn(){return this}}}
 };
 const map={closePopup(){closed++}};
 const session={state:()=>({records}),command(value,opts){
  commands.push({value,opts});
  const p=records.find(x=>x.id===value.id);
  if(value.type==='edit')Object.assign(p,value.patch);
  if(value.type==='delete')p.deleted=true;
  if(value.type==='change-kind')p.kind=value.kind;
  return {ok:true,changed:true};
 }};
 const view=createOriginalPoiPopup({document,L,map,session,onChanged(){updates++},onMessage:m=>messages.push(m),onMoveRequest:id=>{moveId=id}});
 return {view,records,commands,messages,get popup(){return popup},get updates(){return updates},get closed(){return closed},get moveId(){return moveId},get stopped(){return stopped}};
}
test('original popup renders user text via textContent rather than interpolating HTML',()=>{
 const h=harness();assert.equal(h.view.show('safe'),true);
 assert.ok(h.popup.className==='popup-form');
 assert.equal(h.popup.parts['.popup-title'].textContent,'<img src=x onerror=alert(1)>');
 assert.equal(h.popup.innerHTML.includes('<img src=x'),false);
 assert.equal(h.stopped,2);
 assert.equal(h.popup.parts['#moveLayer'].children.length,3);
 assert.equal(h.popup.parts['#movePos'],undefined);
});
test('editing a POI issues exactly one explicitly-confirmed isolated command',()=>{
 const h=harness();h.view.show('safe');
 const p=h.popup.parts;p['#editBtn'].click();
 assert.equal(p['.popup-edit'].classList.classes.has('open'),true);
 p['#editTitle'].value='新しい名称';p['#editMemo'].value='更新メモ';
 p['#saveEdit'].click();
 assert.deepEqual(h.commands,[{value:{type:'edit',id:'safe',patch:{title:'新しい名称',memo:'更新メモ'}},opts:{confirmed:true}}]);
 assert.equal(h.updates,1);assert.equal(h.closed,1);
});
test('empty name and stale deleted POI never mutate editor',()=>{
 const h=harness();h.view.show('safe');
 const p=h.popup.parts;p['#editTitle'].value='  ';p['#editMemo'].value='test';
 p['#saveEdit'].click();assert.equal(h.commands.length,0);
 h.records[0].deleted=true;
 p['#deleteBtn'].click();assert.equal(h.commands.length,0);
});
test('new POI exposes position adjustment but existing POI cannot move',()=>{
 const h=harness(sample({id:'n',role:'new'}));h.view.show('n');
 assert.ok(h.popup.parts['.popup-actions'].children.some(x=>x.id==='movePos'));
 h.popup.parts['.popup-actions'].children.find(x=>x.id==='movePos').click();
 assert.equal(h.moveId,'n');assert.equal(h.commands.length,0);
});
test('marker tap opt-in does not change read-only overlays and opens only callback IDs',()=>{
 const taps=[],markers=[],layers=new Set(),on=(action,...args)=>{void args;return action};
 const map={addLayer(x){layers.add(x)},removeLayer(x){layers.delete(x)},hasLayer(x){return layers.has(x)}};
 const L={
  marker(latlng,opts){
   const item={latlng,opts,on(event,callback){this.callback=callback;return this},addTo(){markers.push(this);return this},setLatLng(x){this.latlng=x}};
   return item;
  },
  divIcon(data){return data},
  circle(){return {addTo(){return this},setLatLng(){return this}}},
 };
 const session={state:()=>({records:[sample()],circles:[],areas:[],hasActive:true,history:{undo:0,redo:0}})};
 const overlay=attachCreativeNextOverlay({session,map,L,onPoiClick:id=>taps.push(id)});
 overlay.refresh();assert.equal(markers.length,1);assert.equal(markers[0].opts.interactive,true);
 markers[0].callback({originalEvent:{stopPropagation(){}}});
 assert.deepEqual(taps,['safe']);overlay.destroy();
});
