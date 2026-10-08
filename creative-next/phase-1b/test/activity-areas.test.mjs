import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {validateActivityPoints,planActivityChange,plannedAreaEdits} from '../core/activity-areas.mjs';
const deps={JSZip,DOMParser,XMLSerializer};
const base=[[35.64,139.85],[35.64,139.86],[35.65,139.86],[35.65,139.85]];
const record={id:'old',role:'existing',kind:'pokestop',title:'サンプル',memo:'原文',lat:35.644,lng:139.854,deleted:false};
const bytes=async()=> (await createFreshV1Kmz({records:[record],activityAreas:[{id:'area-one',points:base}]},deps)).bytes;
const start=async(storage)=>{const s=createIsolatedEditorSession({...deps,storage});assert.equal((await s.prepare(await bytes())).status,'REVIEW');assert.equal(s.acceptPrepared({confirmed:true}).applied,true);return s;};
const getArea=stage=>stage.places.find(p=>p.data?.some(d=>d.name==='campsite.creative.area-id'&&d.value==='area-one'));
const move=(i,lat,lng)=>({type:'area-move-vertex',id:'area-one',index:i,lat,lng});
const add=(i,lat,lng)=>({type:'area-add-vertex',id:'area-one',index:i,lat,lng});
const del=i=>({type:'area-delete-vertex',id:'area-one',index:i});
const memory=()=>{const m=new Map([['next-lab-creative-v7','DO_NOT_TOUCH']]);return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),dump:()=>new Map(m)}};

test('activity editor requires confirmation and does not affect original',async()=>{
 const x=await start();const a=x.state().areas;
 assert.equal(x.commandArea(move(0,35.639,139.85),{confirmed:false}).changed,false);
 assert.deepEqual(x.state().areas,a);
 assert.equal(x.commandArea(move(0,35.639,139.85),{confirmed:true}).changed,true);
 assert.deepEqual(a[0].points,base);
 const leaked=x.state().areas;leaked[0].points[0][0]=100;
 assert.equal(x.state().areas[0].points[0][0],35.639);
});
test('move vertex -> re-export -> import has same ID and coordinates',async()=>{
 const x=await start();x.commandArea(move(0,35.639,139.85),{confirmed:true});
 const out=await x.exportKmz(),stage=await stageKmlInput(out.bytes,deps);
 assert.equal(diagnoseKmzCandidate(stage).disposition,'READY');
 assert.equal(getArea(stage).polygonGeometry.points[0][1],35.639);
 assert.equal(getArea(stage).polygonGeometry.points[0][0],139.85);
 assert.equal(getArea(stage).polygonGeometry.points.at(-1)[1],35.639);
 assert.equal(stage.places.filter(p=>p.geometry==='Point').length,1);
});
test('insert a vertex and delete it, maintaining exact source geometry after undo',async()=>{
 const x=await start();const initial=x.state().areas[0].points;
 x.commandArea(add(0,35.64,139.855),{confirmed:true});assert.equal(x.state().areas[0].points.length,5);
 x.commandArea(del(1),{confirmed:true});assert.deepEqual(x.state().areas[0].points,initial);
 x.undo();assert.equal(x.state().areas[0].points.length,5);
 x.undo();assert.deepEqual(x.state().areas[0].points,initial);
 x.redo();assert.equal(x.state().areas[0].points.length,5);
 x.redo();assert.deepEqual(x.state().areas[0].points,initial);
});
test('POI and area operations undo/redo in chronological order',async()=>{
 const x=await start();assert.equal(x.command({type:'edit',id:'old',patch:{memo:'変更'}},{confirmed:true}).ok,true);
 x.commandArea(move(0,35.639,139.85),{confirmed:true});
 assert.deepEqual(x.state().history,{undo:2,redo:0});
 assert.equal(x.undo().ok,true);assert.equal(x.state().areas[0].points[0][0],35.64);
 assert.equal(x.state().records[0].memo,'変更');
 assert.equal(x.undo().ok,true);assert.equal(x.state().records[0].memo,'原文');
 assert.equal(x.redo().ok,true);assert.equal(x.state().records[0].memo,'変更');
 assert.equal(x.redo().ok,true);assert.equal(x.state().areas[0].points[0][0],35.639);
 assert.deepEqual(x.state().history,{undo:2,redo:0});
 x.undo();x.command({type:'edit',id:'old',patch:{memo:'枝分かれ'}},{confirmed:true});
 assert.deepEqual(x.state().history,{undo:2,redo:0});
});
test('activity area + POI change survive isolated journal save and reopen',async()=>{
 const storage=memory(),x=await start(storage);
 x.commandArea(move(0,35.639,139.85),{confirmed:true});
 x.command({type:'edit',id:'old',patch:{memo:'保存メモ'}},{confirmed:true});
 assert.equal((await x.saveDraft()).status,'SAVED');
 const next=createIsolatedEditorSession({...deps,storage});
 assert.equal((await next.resumeDraft({confirmed:true})).applied,true);
 assert.equal(next.state().areas[0].points[0][0],35.639);
 assert.equal(next.state().records[0].memo,'保存メモ');
 const again=await stageKmlInput((await next.exportKmz()).bytes,deps);
 assert.equal(getArea(again).polygonGeometry.points[0][1],35.639);
 assert.equal(storage.dump().get('next-lab-creative-v7'),'DO_NOT_TOUCH');
});
test('reject degenerate polygons, zero area, intersections and dateline ambiguity',()=>{
 for(const p of [
   [[35,139],[35,139.1],[35,139.2]],
   [[0,0],[1,1],[0,1],[1,0]],
   [[35,139],[35,139],[36,139]],
   [[0,-179],[1,179],[2,-179]],
 ])assert.throws(()=>validateActivityPoints(p),e=>e.code?.startsWith('AREA_'));
});
test('no repeated points, NaN, infinity or out-of-range',()=>{
 for(const pts of [[...base,[...base[0]]],[[NaN,3],[0,4],[2,4]],[[92,3],[0,4],[2,4]],[[35,Infinity],[0,4],[2,4]]])assert.throws(()=>validateActivityPoints(pts));
});
test('cannot delete below three vertices or edit unsupported area',async()=>{
 const x=await start();x.commandArea(del(1),{confirmed:true});
 assert.throws(()=>x.commandArea(del(0),{confirmed:true}),e=>e.code==='AREA_VERTEX_COUNT');
 assert.throws(()=>x.commandArea({type:'area-move-vertex',id:'missing',index:0,lat:35.6,lng:139.8},{confirmed:true}),e=>e.code==='AREA_NOT_FOUND');
});
test('invalid vertex index and coordinate are rejected with no partial change',async()=>{
 const x=await start(),a=x.state().areas;
 for(const c of [move(-1,35,139),move(77,35,139),move(0,100,139),add(0,35,181)])assert.throws(()=>x.commandArea(c,{confirmed:true}));
 assert.deepEqual(x.state().areas,a);assert.deepEqual(x.state().history,{undo:0,redo:0});
});
test('edit validation does not confuse distance circles with activity areas',async()=>{
 const x=await start(),before=x.state().areas;assert.throws(()=>x.commandArea({...move(0,35.5,139.8),id:'fake-circle-owner'},{confirmed:true}),e=>e.code==='AREA_NOT_FOUND');assert.deepEqual(x.state().areas,before);
});
test('planned exports reject removed or renamed activity IDs',()=>{
 const source=[{id:'one',points:base}];
 assert.throws(()=>plannedAreaEdits(source,[]),e=>e.code==='AREA_SOURCE');
 assert.throws(()=>plannedAreaEdits(source,[{id:'other',points:base}]),e=>e.code==='AREA_SOURCE');
});
test('unknown command types fail before any mutation',async()=>{
 const x=await start(),before=x.state().areas;
 assert.throws(()=>x.commandArea({type:'delete-all',id:'area-one',index:0},{confirmed:true}),e=>e.code==='AREA_COMMAND');
 assert.deepEqual(x.state().areas,before);
});

test('unknown foreign polygon geometry extension refuses source edit',async()=>{
 const s=await stageKmlInput(await bytes(),deps);
 const {editableAreaGeometry}=await import('../core/activity-areas.mjs');
 const xml=new DOMParser().parseFromString(s.sourceKml,'application/xml');
 const poly=xml.getElementsByTagNameNS('http://www.opengis.net/kml/2.2','Polygon')[0];
 poly.appendChild(xml.createElementNS('http://example.org/private','private:altitudeMode'));
 assert.throws(()=>editableAreaGeometry(s,xml,{id:'area-one',points:base.map(p=>[...p])}),e=>e.code==='AREA_UNSUPPORTED');
});
test('special altitude or inner ring geometry refuses source edit',async()=>{
 const {editableAreaGeometry}=await import('../core/activity-areas.mjs');
 const s=await stageKmlInput(await bytes(),deps);
 const xml=new DOMParser().parseFromString(s.sourceKml,'application/xml');
 const ns='http://www.opengis.net/kml/2.2',poly=xml.getElementsByTagNameNS(ns,'Polygon')[0];
 const inner=xml.createElementNS(ns,'innerBoundaryIs');poly.appendChild(inner);
 assert.throws(()=>editableAreaGeometry(s,xml,{id:'area-one',points:base.map(p=>[...p])}),e=>e.code==='AREA_UNSUPPORTED');
 poly.removeChild(inner);
 const coords=poly.getElementsByTagNameNS(ns,'coordinates')[0];
 coords.textContent=coords.textContent.trim().split(/\s+/).map((x,i)=>x+(i===0?',100':',0')).join(' ');
 assert.throws(()=>editableAreaGeometry(s,xml,{id:'area-one',points:base.map(p=>[...p])}),e=>e.code==='AREA_ALTITUDE_HOLD');
});
test('500+ vertices remain bounded while 512 is the limit',()=>{
 const many=Array.from({length:513},(_,i)=>[35+Math.sin(2*Math.PI*i/513)*.001,139+Math.cos(2*Math.PI*i/513)*.001]);
 assert.throws(()=>validateActivityPoints(many),e=>e.code==='AREA_VERTEX_COUNT');
});
test('area draft remains immutable during in-flight async save and cannot leak references',async()=>{
 const storage=memory(),x=await start(storage);
 x.commandArea(move(0,35.639,139.85),{confirmed:true});
 const before=x.state();
 const saved=await x.saveDraft();assert.equal(saved.status,'SAVED');
 const mutable=x.state();mutable.areas[0].points[0][0]=34;
 const again=createIsolatedEditorSession({...deps,storage});assert.equal((await again.resumeDraft({confirmed:true})).applied,true);
 assert.deepEqual(again.state().areas,before.areas);
});
