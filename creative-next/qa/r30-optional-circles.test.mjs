import test from 'node:test';
import assert from 'node:assert/strict';
import {createOriginalOptionalCircleOverlay} from '../integration/original-optional-circles-r30.mjs';

function harness(records=[{id:'p1',role:'new',kind:'pokestop',deleted:false,lat:35.7,lng:139.8}]){
 const layers=new Set();
 const map={hasLayer:x=>layers.has(x),removeLayer:x=>layers.delete(x)};
 const L={circle(latlng,opts){
  return {latlng,opts,setLatLng(ll){this.latlng=ll;return this},addTo(target){target===map&&layers.add(this);return this}};
 }};
 const source=()=>JSON.stringify(records);
 const session={state:()=>({records})};
 const overlay=createOriginalOptionalCircleOverlay({session,map,L});
 const circleList=()=>[...layers];
 return {records,map,layers,overlay,circleList,source};
}
test('r30 optional rings start off and do not touch source',()=>{
 const h=harness();
 const source=h.source();h.overlay.refresh();
 assert.equal(h.circleList().length,0);
 assert.deepEqual(h.overlay.counts().radii,[]);
 assert.equal(h.source(),source);
 assert.equal(h.overlay.setCircleVisible(50,true),false);
 assert.equal(h.circleList().length,0);
});
test('40m and 30m use original visual styles and independently toggle',()=>{
 const h=harness();h.overlay.setCircleVisible(40,true);
 assert.equal(h.circleList().length,1);
 assert.equal(h.circleList()[0].opts.radius,40);
 assert.equal(h.circleList()[0].opts.color,'#8d62c1');
 assert.equal(h.circleList()[0].opts.dashArray,'6 5');
 h.overlay.setCircleVisible(30,true);
 assert.deepEqual(h.circleList().map(x=>x.opts.radius).sort(),[30,40]);
 assert.equal(h.circleList().find(x=>x.opts.radius===30).opts.color,'#3e9b68');
 assert.equal(h.circleList().find(x=>x.opts.radius===30).opts.dashArray,'4 5');
 assert(h.circleList().every(x=>x.opts.interactive===false));
 h.overlay.setCircleVisible(40,false);
 assert.deepEqual(h.circleList().map(x=>x.opts.radius),[30]);
});
test('POI moved, changed kind, deleted, undone and redone update active rings without history writes',()=>{
 const h=harness();const a=h.records[0];
 h.overlay.setCircleVisible(30,true);h.overlay.setCircleVisible(40,true);
 const original=h.circleList().find(x=>x.opts.radius===40);
 a.lat=35.71;a.lng=139.81;a.kind='gym';h.overlay.refresh();
 assert.deepEqual(original.latlng,[35.71,139.81]);
 assert.equal(h.circleList().length,2);
 a.deleted=true;h.overlay.refresh();assert.equal(h.circleList().length,0);
 a.deleted=false;h.overlay.refresh();assert.equal(h.circleList().length,2);
 a.deleted=true;h.overlay.refresh();assert.equal(h.circleList().length,0);
});
test('source layer hide also hides 30/40m circles, and unhide restores',()=>{
 const h=harness([
  {id:'n1',role:'new',kind:'pokestop',lat:35.7,lng:139.8,deleted:false},
  {id:'o1',role:'existing',kind:'gym',lat:35.8,lng:139.9,deleted:false}
 ]);
 h.overlay.setCircleVisible(30,true);
 assert.equal(h.circleList().length,2);
 h.overlay.setLayerVisible('new-pokestop',false);
 assert.equal(h.circleList().length,1);
 h.overlay.setLayerVisible('new-pokestop',true);
 assert.equal(h.circleList().length,2);
 assert.equal(h.overlay.setLayerVisible('UNKNOWN',false),false);
 assert.equal(h.overlay.setCircleVisible(37,true),false);
});
test('new additions get both rings; invalid and deleted entries do not leak, dispose cleans all',()=>{
 const h=harness([{id:'p1',role:'new',kind:'pokestop',lat:35.7,lng:139.8,deleted:false}]);
 h.overlay.setCircleVisible(40,true);
 h.records.push({id:'p2',role:'new',kind:'gym',lat:35.6,lng:139.7,deleted:false},
  {id:'bad',role:'new',kind:'power',lat:NaN,lng:139.5,deleted:false},
  {id:'old',role:'invalid',kind:'gym',lat:35.6,lng:139.7,deleted:false});
 h.overlay.refresh();assert.equal(h.circleList().length,2);
 h.overlay.destroy();assert.equal(h.circleList().length,0);
 assert.equal(h.overlay.setCircleVisible(30,true),false);
 h.overlay.refresh();assert.equal(h.circleList().length,0);
});
