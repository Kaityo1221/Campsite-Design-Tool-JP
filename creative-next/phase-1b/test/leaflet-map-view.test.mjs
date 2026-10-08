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
