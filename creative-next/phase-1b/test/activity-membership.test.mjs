import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {plannedAreaOperations} from '../core/activity-areas.mjs';
const deps={JSZip,DOMParser,XMLSerializer};
const box=[[35.640,139.850],[35.640,139.860],[35.650,139.860],[35.650,139.850]];
const triangle=[[35.641,139.851],[35.642,139.853],[35.643,139.851]];
const record={id:'poi-test-1',role:'existing',kind:'pokestop',title:'Example',memo:'',lat:35.645,lng:139.854,deleted:false};
const source=async(withArea=true)=>(await createFreshV1Kmz({records:[record],activityAreas:withArea?[{id:'area-original',points:box}]:[]},deps)).bytes;
const start=async({storage=null,withArea=true}={})=>{
 const session=createIsolatedEditorSession({...deps,storage});
 assert.equal((await session.prepare(await source(withArea))).status,'REVIEW');
 assert.equal(session.acceptPrepared({confirmed:true}).applied,true);
 return session;
};
const mem=()=>{const m=new Map([['next-lab-creative-v7','STAY']]);return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),dump:()=>m};};
const create=(id='area-created-1')=>({type:'area-create',id,points:triangle});
const remove=(id='area-original')=>({type:'area-remove',id});
const parsed=async session=>stageKmlInput((await session.exportKmz()).bytes,deps);
const getAreas=st=>st.places.filter(p=>p.data?.some(d=>d.name==='campsite.creative.object'&&d.value==='activity-area'));

test('explicit consent required for area creation and deletion',async()=>{
 const s=await start(),before=s.state().areas;
 assert.equal(s.commandArea(create(),{confirmed:false}).changed,false);
 assert.equal(s.commandArea(remove(),{confirmed:false}).changed,false);
 assert.deepEqual(s.state().areas,before);
 assert.deepEqual(s.state().history,{undo:0,redo:0});
});
test('create a second area while retaining original area and source POIs',async()=>{
 const s=await start();s.commandArea(create(),{confirmed:true});
 const st=await parsed(s);
 assert.equal(diagnoseKmzCandidate(st).disposition,'READY');
 assert.equal(getAreas(st).length,2);
 assert.equal(st.places.filter(p=>p.geometry==='Point').length,1);
 assert.equal(st.places.filter(p=>p.data?.some(d=>d.name==='campsite.creative.area-id'&&d.value==='area-created-1')).length,1);
});
test('new area can be edited then re-exported with exact new coordinates',async()=>{
 const s=await start();s.commandArea(create(),{confirmed:true});
 s.commandArea({type:'area-move-vertex',id:'area-created-1',index:0,lat:35.6401,lng:139.851},{confirmed:true});
 const st=await parsed(s),area=getAreas(st).find(p=>p.data.some(d=>d.name==='campsite.creative.area-id'&&d.value==='area-created-1'));
 assert.equal(area.polygonGeometry.points[0][1],35.6401);
 assert.equal(area.polygonGeometry.points[0][0],139.851);
});
test('remove original area without removing POIs, keep original source for Undo',async()=>{
 const s=await start();s.commandArea(remove(),{confirmed:true});
 assert.equal(s.state().areas.length,0);
 const st=await parsed(s);assert.equal(getAreas(st).length,0);assert.equal(st.places.filter(p=>p.geometry==='Point').length,1);
 assert.equal(s.undo().changed,true);assert.equal(s.state().areas.length,1);
 const restored=await parsed(s);assert.deepEqual(getAreas(restored)[0].polygonGeometry.points.slice(0,-1).map(p=>[p[1],p[0]]),box);
});
test('undo and redo membership changes in chronological order with POI change',async()=>{
 const s=await start();s.commandArea(create(),{confirmed:true});s.command({type:'edit',id:'poi-test-1',patch:{memo:'change'}},{confirmed:true});s.commandArea(remove(),{confirmed:true});
 assert.equal(s.state().areas.length,1);assert.equal(s.state().records[0].memo,'change');
 s.undo();assert.equal(s.state().areas.length,2);
 s.undo();assert.equal(s.state().records[0].memo,'');
 s.undo();assert.equal(s.state().areas.length,1);
 s.redo();s.redo();s.redo();assert.equal(s.state().areas.length,1);
 assert.equal(getAreas(await parsed(s)).length,1);
});
test('no source area still supports creating first activity area',async()=>{
 const s=await start({withArea:false});s.commandArea(create(),{confirmed:true});
 assert.equal(getAreas(await parsed(s)).length,1);
});
test('area edits survive two-generation isolated save and resume, old key untouched',async()=>{
 const storage=mem(),s=await start({storage});
 s.commandArea(remove(),{confirmed:true});s.commandArea(create(),{confirmed:true});
 assert.equal((await s.saveDraft()).status,'SAVED');
 const later=createIsolatedEditorSession({...deps,storage});
 assert.equal((await later.resumeDraft({confirmed:true})).applied,true);
 assert.deepEqual(later.state().areas.map(a=>a.id),['area-created-1']);
 assert.equal(getAreas(await parsed(later)).length,1);
 assert.equal(storage.dump().get('next-lab-creative-v7'),'STAY');
});
test('duplicate, invalid and reused area IDs fail without mutation',async()=>{
 const s=await start(),original=s.state().areas;
 for(const c of [create('area-original'),create('bad/id'),create(''),{type:'area-create',id:'area-created-1',points:[[0,0],[1,1],[2,2]]}])
   assert.throws(()=>s.commandArea(c,{confirmed:true}));
 assert.deepEqual(s.state().areas,original);
 s.commandArea(create(),{confirmed:true});s.commandArea(remove('area-created-1'),{confirmed:true});
 assert.throws(()=>s.commandArea(create(),{confirmed:true}),e=>e.code==='AREA_ID');
});
test('unrelated or repeated area operations are rejected before export',async()=>{
 const st=await stageKmlInput(await source(),deps);
 await assert.rejects(()=>import('../core/export-kmz.mjs').then(m=>m.exportNewV1Kmz(st,{...deps,areaDeletions:['no-such']})),e=>e.code==='AREA_EDITS');
 await assert.rejects(()=>import('../core/export-kmz.mjs').then(m=>m.exportNewV1Kmz(st,{...deps,areaDeletions:['area-original','area-original']})),e=>e.code==='AREA_EDITS');
 await assert.rejects(()=>import('../core/export-kmz.mjs').then(m=>m.exportNewV1Kmz(st,{...deps,areaEdits:[{id:'area-original',points:box}],areaDeletions:['area-original']})),e=>e.code==='AREA_EDITS');
});
test('source mutation does not happen when invalid new geometry is submitted',async()=>{
 const s=await start(),state=s.state();
 assert.throws(()=>s.commandArea({type:'area-create',id:'area-bad',points:[[35,139],[35,139.1],[35,139.2]]},{confirmed:true}));
 assert.deepEqual(s.state(),state);
});
test('membership planner fails closed on duplicate or ambiguous IDs and excessive counts',()=>{
 assert.throws(()=>plannedAreaOperations([{id:'area-original',points:box}],[{id:'area-original',points:box},{id:'area-original',points:box}]));
 assert.throws(()=>plannedAreaOperations([],[{id:'unknown-from-third-party',points:box}]));
 const tooMany=Array.from({length:65},(_,i)=>({id:`area-${i}`,points:box}));
 assert.throws(()=>plannedAreaOperations([],tooMany),e=>e.code==='AREA_LIMIT');
});
