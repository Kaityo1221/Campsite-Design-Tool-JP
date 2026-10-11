import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalPlacementR30} from '../integration/original-placement-r30.mjs';

function element(tag='div'){
 const listeners={};
 const node={tagName:tag,children:[],removed:false,style:{},dataset:{},id:'',className:'',textContent:'',type:'',src:'',alt:'',
  attr:{},classList:{keys:new Set(),add(k){this.keys.add(k)},remove(k){this.keys.delete(k)},toggle(k,v){if(v===true)this.keys.add(k);else if(v===false)this.keys.delete(k);else if(this.keys.has(k))this.keys.delete(k);else this.keys.add(k)}},
  setAttribute(k,v){this.attr[k]=v},addEventListener(k,fn){listeners[k]=fn},
  click(){listeners.click?.({stopPropagation(){}})},
  append(...items){for(const x of items){x.parentNode=this;this.children.push(x)}},
  replaceChildren(...items){this.children=items},
  remove(){this.removed=true},querySelectorAll(q){if(q==='.cm-bubble')return this.children.filter(x=>x.className==='cm-bubble');return[];}
 };
 return node;
}
function harness(initial){
 const body=element('body'),document={body,createElement:element};
 const live=new Set(),events=new Map(),commands=[],notices=[];
 const store=(initial||[{id:'n',role:'new',kind:'pokestop',lat:35.7,lng:139.8,deleted:false}]).map(x=>({...x}));
 let center={lat:35.7,lng:139.8},zoom=17,changes=0,moved=null;
 const map={
  on(k,fn){events.set(k,fn)},off(k,fn){if(events.get(k)===fn)events.delete(k)},
  getCenter:()=>({...center}),getZoom:()=>zoom,
  setView(ll,z){center={lat:ll[0],lng:ll[1]};zoom=z;return this},
  removeLayer:layer=>live.delete(layer)
 };
 function layer(pos,options){
  return {latlng:pos,options,addTo(m){assert.equal(m,map);live.add(this);return this},
   setLatLng(ll){this.latlng=ll;return this}};
 }
 const L={circle:(pos,opts)=>layer(pos,opts),marker:(pos,opts)=>layer(pos,opts),divIcon:opts=>opts};
 const session={state:()=>({records:store}),command(action,{confirmed}){
  assert.equal(confirmed,true);commands.push(action);
  if(action.type==='move'){
   const r=store.find(x=>x.id===action.id);if(r?.role!=='new')throw Error('EXISTING_LOCKED');
   r.lat=action.lat;r.lng=action.lng;return {ok:true,changed:true};
  }
  if(action.type==='add'){
   store.push({id:'added-'+commands.length,...action.poi});return {ok:true,changed:true};
  }
  throw Error('UNKNOWN_CMD');
 }};
 const placement=createOriginalPlacementR30({document,map,L,session,onChanged(){changes++},
  onMessage:s=>notices.push(s),onMoved:id=>moved=id});
 return {body,document,map,live,events,commands,notices,store,placement,
  get changes(){return changes},get moved(){return moved},
  go(lat,lng){center={lat,lng};events.get('move')?.()},
  buttons:()=>body.children.filter(x=>!x.removed).flatMap(x=>x.children).filter(x=>x.tagName==='button'),
  action:(label)=>{const bar=body.children.find(x=>!x.removed&&x.children.some(y=>y.textContent===label));assert(bar,'missing action bar');return bar.children.find(y=>y.textContent===label)}
 };
}
test('exact original plus FAB and three icon bubbles, not legacy add prompt',()=>{
 const h=harness();
 assert.equal(h.body.children[0].className,'cm-fab-wrap');
 assert.equal(h.body.children[0].children[0].className,'cm-add-fab');
 assert.equal(h.body.children[0].children[0].textContent,'＋');
 const types=h.buttons().filter(x=>x.className==='cm-bubble');
 assert.deepEqual(types.map(x=>x.dataset.layer),['new-pokestop','new-gym','new-power']);
 assert.equal(h.commands.length,0);
 h.placement.dispose();assert.equal(h.body.children[0].removed,true);
});
test('tap plus, select Gym, center cyan 50m+40m with crosshair, confirm and undoable engine add',()=>{
 const h=harness();h.buttons()[0].click();
 assert(h.body.children[0].classList.keys.has('open'));
 const gym=h.buttons().find(x=>x.dataset.layer==='new-gym');gym.click();
 assert.equal(h.placement.status().mode,'add');
 const circles=[...h.live].filter(x=>x.options.radius);
 assert.deepEqual(circles.map(x=>x.options.radius).sort((a,b)=>a-b),[40,50]);
 assert.equal(circles.find(x=>x.options.radius===50).options.color,'#13b8d4');
 assert.equal(circles.find(x=>x.options.radius===50).options.pane,'placement');
 assert([...h.live].some(x=>x.options.icon?.html?.includes('preview-dot move-aim')));
 h.go(35.701,139.802);
 assert(circles.every(x=>x.latlng.lat===35.701));
 h.action('この場所に追加').click();
 assert.equal(h.commands.length,1);assert.equal(h.commands[0].type,'add');
 assert.equal(h.commands[0].poi.role,'new');assert.equal(h.commands[0].poi.kind,'gym');
 assert.equal(h.commands[0].poi.lat,35.701);assert.equal(h.changes,1);
 assert.equal(h.placement.status().mode,'add');
 h.placement.dispose();assert.equal(h.live.size,0);
});
test('new POI move starts at POI and only commits after explicit center button',()=>{
 const h=harness();assert.equal(h.placement.beginMove('n'),true);
 assert.equal(h.placement.status().mode,'move');assert.equal(h.commands.length,0);
 assert.equal(h.action('この位置に確定').textContent,'この位置に確定');
 h.go(35.705,139.805);
 assert([...h.live].some(x=>x.options.radius===50&&x.latlng.lat===35.705));
 h.action('この位置に確定').click();
 assert.equal(h.commands[0].type,'move');assert.equal(h.commands[0].id,'n');
 assert.deepEqual([h.store[0].lat,h.store[0].lng],[35.705,139.805]);
 assert.equal(h.moved,'n');assert.equal(h.changes,1);assert.equal(h.live.size,0);
});
test('cancel and existing POI never issue engine commands, no source modification',()=>{
 const old={id:'old',role:'existing',kind:'pokestop',lat:35.6,lng:139.6,deleted:false};
 const h=harness([old]);assert.equal(h.placement.beginMove('old'),false);
 assert.equal(h.commands.length,0);assert.deepEqual(h.store[0],old);
 h.buttons()[0].click();
 h.buttons().find(x=>x.dataset.layer==='new-pokestop').click();
 h.go(35.8,139.9);
 h.action('×').click();
 assert.equal(h.commands.length,0);assert.equal(h.live.size,0);
 h.placement.dispose();
});
test('hide/show cancels placement and keeps old map source read-only',()=>{
 const h=harness();h.placement.beginMove('n');h.placement.hide();
 assert.equal(h.placement.isActive(),false);assert.equal(h.body.children[0].style.display,'none');
 assert.equal(h.live.size,0);h.placement.show();
 assert.equal(h.body.children[0].style.display,'');
 assert.equal(h.commands.length,0);
});
