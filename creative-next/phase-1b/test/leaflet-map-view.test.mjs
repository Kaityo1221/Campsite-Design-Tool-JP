import test from 'node:test';
import assert from 'node:assert/strict';
import {createLeafletMapView} from '../../phase-2-preview/leaflet-map-view.mjs';
function mockLeaflet(){
 const layers=new Set();let create=0,remove=0,fit=0,selected=null;
 class Layer{
  constructor(type,ll,options){this.type=type;this.latlng=ll;this.options=options;create++;}
  addTo(){layers.add(this);return this}
  setLatLng(ll){this.latlng=ll;return this}
  setLatLngs(ll){this.latlng=ll;return this}
  setRadius(n){this.options.radius=n;return this}
  setStyle(style){this.options={...this.options,...style};return this}
  on(event,callback){if(event==='click')this.select=callback;return this}
 }
 const map={setView(){return this},fitBounds(){fit++;return this},invalidateSize(){return this},removeLayer(layer){assert.ok(layers.delete(layer));remove++},remove(){layers.clear()}};
 const L={map:()=>map,tileLayer:()=>new Layer('tile',null,{}),circleMarker:(ll,o)=>new Layer('poi',ll,o),
  circle:(ll,o)=>new Layer('circle',ll,o),polygon:(ll,o)=>new Layer('area',ll,o),latLngBounds:x=>x};
 return {L,layers,stats:()=>({create,remove,fit,selected})};
}
const e=(id,role='existing')=>({id,role,kind:'pokestop',lat:35.644,lng:139.855,title:id,deleted:false});
const circle=(id,lat=35.644)=>({ownerId:id,lat,lng:139.855,radius:50});

test('keyed map renderer displays POI, owned circles and areas without re-creating unchanged layers',()=>{
 const mock=mockLeaflet(),view=createLeafletMapView({L:mock.L,root:{},tiles:false});
 const input={records:[e('one'),e('two','new')],circles:[circle('one'),circle('two')],areas:[{id:'area1',points:[[35.64,139.85],[35.66,139.86],[35.65,139.87]]}]};
 view.render(input,{fit:true});assert.equal(mock.layers.size,5);assert.equal(mock.stats().fit,1);
 const n=mock.stats().create;
 view.render(input);assert.equal(mock.stats().create,n);assert.equal(mock.stats().remove,0);
 const updated={...input,records:[e('one'),{...e('two','new'),lat:35.646}],circles:[circle('one'),circle('two',35.646)]};
 view.render(updated,{selectedId:'two'});
 assert.equal(mock.stats().create,n);assert.ok([...mock.layers].some(p=>p.type==='circle'&&p.latlng?.[0]===35.646));
 assert.ok([...mock.layers].some(p=>p.type==='poi'&&p.latlng?.[0]===35.646));
 view.render({...updated,records:[e('one')],circles:[circle('one')]});
 assert.equal(mock.layers.size,3);assert.equal(mock.stats().remove,2);
 view.destroy();assert.equal(mock.layers.size,0);
});
test('map POI selection uses canonical POI internal ID and avoids invalid initialization',()=>{
 const fake=mockLeaflet();let clicked=null;
 const view=createLeafletMapView({L:fake.L,root:{},tiles:false,onSelect:id=>clicked=id});
 view.render({records:[e('same')],circles:[],areas:[]});
 [...fake.layers].find(layer=>layer.type==='poi').select();assert.equal(clicked,'same');
 assert.throws(()=>createLeafletMapView({L:null,root:{}}),/Leaflet/);
 view.destroy();
});

function interactiveLeaflet(){
 const layers=new Set(),events=new Map();let removed=0,fit=0;
 class FakeLayer{
  constructor(type,position,options){this.type=type;this.position=position;this.options=options;this.events=new Map();this.opacity=1;}
  addTo(){layers.add(this);return this;}
  setLatLng(p){this.position=p;return this;}
  setLatLngs(p){this.position=p;return this;}
  setStyle(opts){Object.assign(this.options,opts);return this;}
  setRadius(r){this.options.radius=r;return this;}
  setOpacity(n){this.opacity=n;return this;}
  getLatLng(){return Array.isArray(this.position)?{lat:this.position[0],lng:this.position[1]}:this.position;}
  on(name,callback){this.events.set(name,callback);return this;}
  fire(name){this.events.get(name)?.();}
 }
 const map={setView(){return this},on(name,cb){events.set(name,cb);return this},off(name,cb){if(events.get(name)===cb)events.delete(name);return this},fitBounds(){fit++;return this},invalidateSize(){},removeLayer(l){assert.ok(layers.delete(l));removed++},remove(){layers.clear()}};
 const L={map:()=>map,tileLayer:()=>new FakeLayer('tile'),circleMarker:(p,o)=>new FakeLayer('poi',p,o),
  circle:(p,o)=>new FakeLayer('circle',p,o),polygon:(p,o)=>new FakeLayer('area',p,o),
  marker:(p,o)=>new FakeLayer('vertex',p,o),divIcon:o=>o,latLngBounds:points=>points};
 return {L,layers,events,stats:()=>({removed,fit}),map};
}
const sampleArea={id:'area-K',points:[[35.6,139.8],[35.6,139.9],[35.7,139.85]]};
const mapSample={records:[e('original'),e('candidate','new')],circles:[circle('original'),circle('candidate')],areas:[sampleArea]};

test('independent layer toggles never mutate the input and hide only the requested overlay',()=>{
 const mock=interactiveLeaflet(),before=structuredClone(mapSample);
 const view=createLeafletMapView({L:mock.L,root:{},tiles:false});
 view.render(mapSample,{selectedAreaId:'area-K'});
 assert.equal(mock.layers.size,2+2+1+3);
 view.render(mapSample,{selectedAreaId:'area-K',visibility:{circles:false}});
 assert.equal(mock.layers.size,2+0+1+3);
 view.render(mapSample,{selectedAreaId:'area-K',visibility:{poi:false,areas:false}});
 assert.equal(mock.layers.size,2);
 assert.ok([...mock.layers].every(x=>x.type==='circle'));
 view.render(mapSample,{selectedAreaId:'area-K',visibility:{poi:false,circles:false,areas:false}});
 assert.equal(mock.layers.size,0);
 view.render(mapSample,{selectedAreaId:'area-K'});
 assert.equal(mock.layers.size,8);
 assert.deepEqual(mapSample,before);
 view.destroy();
});

test('map click proposes a coordinate; POI clicks only select the canonical ID',()=>{
 const mock=interactiveLeaflet(),points=[],selected=[];
 const view=createLeafletMapView({L:mock.L,root:{},tiles:false,onMapClick:p=>points.push(p),onSelect:id=>selected.push(id)});
 view.render(mapSample);
 mock.events.get('click')({latlng:{lat:35.64,lng:139.87}});
 mock.events.get('click')({latlng:{lat:Infinity,lng:139.87}});
 mock.events.get('click')({latlng:{lat:35.64,lng:200}});
 assert.deepEqual(points,[{lat:35.64,lng:139.87}]);
 [...mock.layers].find(x=>x.type==='poi').fire('click');
 assert.deepEqual(selected,['original']);
 view.destroy();assert.ok(!mock.events.has('click'));
});

test('vertex drop is only a proposal and a cancelled edit is restored by render',()=>{
 const mock=interactiveLeaflet(),drops=[],picked=[];
 const view=createLeafletMapView({L:mock.L,root:{},tiles:false,
   onVertexDrop:e=>drops.push(e),onVertexSelect:e=>picked.push(e)});
 view.render(mapSample,{selectedAreaId:'area-K',selectedVertexIndex:1});
 const handles=[...mock.layers].filter(x=>x.type==='vertex');
 assert.equal(handles.length,3);
 handles[1].fire('click');assert.deepEqual(picked,[{id:'area-K',index:1}]);
 handles[1].setLatLng([35.63,139.88]);handles[1].fire('dragend');
 assert.deepEqual(drops,[{id:'area-K',index:1,lat:35.63,lng:139.88}]);
 // A cancelled edit changes no source geometry; redraw must reset the handle.
 assert.deepEqual(mapSample.areas[0].points[1],[35.6,139.9]);
 view.render(mapSample,{selectedAreaId:'area-K',selectedVertexIndex:1});
 assert.deepEqual(handles[1].position,[35.6,139.9]);
 // Switching the selected area off removes every edit handle.
 view.render(mapSample,{selectedAreaId:'area-K',editable:false});
 assert.equal([...mock.layers].filter(x=>x.type==='vertex').length,0);
 view.destroy();
});

test('vertex handles track every inserted/deleted vertex without stale index callbacks',()=>{
 const mock=interactiveLeaflet(),drops=[];
 const view=createLeafletMapView({L:mock.L,root:{},tiles:false,onVertexDrop:p=>drops.push(p)});
 view.render(mapSample,{selectedAreaId:'area-K'});
 const bigger={...mapSample,areas:[{id:'area-K',points:[[35.6,139.8],[35.6,139.9],[35.65,139.92],[35.7,139.85]]}]};
 view.render(bigger,{selectedAreaId:'area-K'});
 const v3=[...mock.layers].find(x=>x.type==='vertex'&&Array.isArray(x.position)&&x.position[0]===35.65);
 v3.fire('dragend');assert.deepEqual(drops.at(-1),{id:'area-K',index:2,lat:35.65,lng:139.92});
 view.render(mapSample,{selectedAreaId:'area-K'});
 assert.equal([...mock.layers].filter(x=>x.type==='vertex').length,3);
 view.destroy();
});

test('map reports real Leaflet tile-layer lifecycle without claiming downloaded tiles initially',()=>{
 const fake=interactiveLeaflet(),reports=[];
 const view=createLeafletMapView({L:fake.L,root:{},onTilesState:s=>reports.push(s)});
 assert.deepEqual(reports,['WAITING']);
 const tile=[...fake.layers].find(layer=>layer.type==='tile');assert.ok(tile);
 tile.fire('load');assert.deepEqual(reports,['WAITING','READY']);
 tile.fire('tileerror');assert.deepEqual(reports,['WAITING','READY','ERROR']);
 view.destroy();
});

test('no tile layer is explicitly not a basemap PASS',()=>{
 const fake=interactiveLeaflet(),reports=[];
 const view=createLeafletMapView({L:fake.L,root:{},tiles:false,onTilesState:s=>reports.push(s)});
 assert.deepEqual(reports,['NO_TILES']);
 assert.equal([...fake.layers].filter(x=>x.type==='tile').length,0);
 view.destroy();
});
