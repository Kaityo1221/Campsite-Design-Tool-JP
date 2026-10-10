import assert from 'node:assert/strict';
import {attachCreativeNextOverlay} from '../integration/creative-next-original-leaflet-overlay.mjs';
const layers=new Set(),made=[];
const map={removeLayer(l){layers.delete(l);l.removed=true}};
const leaf=(kind,at,opt)=>{const v={kind,at,opt,removed:false,moved:0,
 addTo(){layers.add(this);made.push(this);return this},
 setLatLng(next){this.at=next;this.moved++;return this}};return v};
const L={marker:(a,b)=>leaf('marker',a,b),circle:(a,b)=>leaf('circle',a,b),divIcon:x=>x};
const state={records:[{id:'old',lat:35,lng:139,kind:'pokestop',role:'existing'}],circles:[],areas:[],history:{undo:0,redo:0},hasActive:true};
const adapter=attachCreativeNextOverlay({session:{state:()=>state},map,L});
adapter.refresh();assert.equal(layers.size,1);
const icon=made[0].opt.icon;assert.equal(icon.className,'cm-v73-map-icon');assert.match(icon.html,/cm-v73-stop/);assert.equal(made[0].opt.draggable,false);
state.records[0].lat=36;adapter.refresh();assert.equal(layers.size,1);assert.equal(made.length,1);assert.equal(made[0].moved,1);
state.records.push({id:'new',lat:37,lng:140,kind:'gym',role:'new'});state.circles=[{ownerId:'new',lat:37,lng:140,radius:50}];adapter.refresh();assert.equal(layers.size,3);assert.equal(adapter.counts().pois,2);
state.records[0].kind='power';adapter.refresh();assert.equal(layers.size,3);assert.equal(adapter.counts().pois,2);assert.equal(made[0].removed,true);
state.records[0].deleted=true;state.circles=[];adapter.refresh();assert.equal(layers.size,1);assert.equal(adapter.counts().circles,0);
const before=made.length;adapter.destroy();assert.equal(layers.size,0);
assert.equal(adapter.refresh(),null);assert.equal(made.length,before);
assert.throws(()=>attachCreativeNextOverlay({session:{state:()=>state},map,L:{}}));
console.log('PASS: Original Creative marker classes, keyed position/kind/deletion, circle owner, cleanup and no mutation');
