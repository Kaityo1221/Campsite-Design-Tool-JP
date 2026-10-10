import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';

// The iPhone smoke test combines previously separately-tested edits.
// Keep this isolated from browser/localStorage and source files.
const deps={JSZip,DOMParser,XMLSerializer};
const area=[{id:'area-one',points:[
 [35.6407,139.8535],[35.6407,139.8585],
 [35.6445,139.8585],[35.6445,139.8535]
]}];
const orig={id:'existing-a',role:'existing',kind:'pokestop',title:'既存POI A',memo:'元のメモ',lat:35.642,lng:139.855,deleted:false};
const memory=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,val)=>data.set(key,val)};};
async function confirmed(session,bytes){
 assert.equal((await session.prepare(bytes)).status,'REVIEW');
 assert.equal(session.acceptPrepared({confirmed:true}).applied,true);
}
function add(session,title,kind,lat,lng){
 const result=session.command({type:'add',poi:{role:'new',kind,title,memo:'テスト',lat,lng}},{confirmed:true});
 assert.equal(result.ok,true);
}
test('iPhone combined POI/area vertex add-delete sequence can save and roundtrip',async()=>{
 const fresh=(await createFreshV1Kmz({records:[orig],activityAreas:area},deps)).bytes;
 const seed=createIsolatedEditorSession(deps);await confirmed(seed,fresh);
 add(seed,'Gym B','gym',35.6425,139.8558);
 add(seed,'POI C','pokestop',35.6434,139.8565);
 const imported=(await seed.exportKmz()).bytes;
 const x=createIsolatedEditorSession({...deps,storage:memory()});await confirmed(x,imported);
 const gym=x.state().records.find(r=>r.title==='Gym B');
 assert.ok(gym);
 assert.equal(x.command({type:'edit',id:'existing-a',patch:{memo:'iPhone動作確認'}},{confirmed:true}).ok,true);
 assert.equal(x.command({type:'move',id:gym.id,lat:35.6428,lng:139.8558},{confirmed:true}).ok,true);
 add(x,'テスト用・新規POI D','pokestop',35.6430,139.8568);
 assert.equal(x.state().circles.length,3);
 const move={type:'area-move-vertex',id:'area-one',index:0,lat:35.6408,lng:139.8535};
 assert.equal(x.commandArea(move,{confirmed:true}).changed,true);
 assert.equal(x.commandArea({type:'area-add-vertex',id:'area-one',index:0,lat:35.6404,lng:139.8560},{confirmed:true}).changed,true);
 assert.equal(x.state().areas[0].points.length,5);
 assert.equal(x.undo().changed,true);assert.equal(x.redo().changed,true);
 assert.equal(x.commandArea({type:'area-delete-vertex',id:'area-one',index:1},{confirmed:true}).changed,true);
 assert.equal(x.undo().changed,true);assert.equal(x.redo().changed,true);
 assert.equal(x.state().areas[0].points.length,4);
 const out=await x.exportKmz();
 const staged=await stageKmlInput(out.bytes,deps);
 const diagnosis=diagnoseKmzCandidate(staged);
 assert.equal(diagnosis.disposition,'READY');
 assert.equal(diagnosis.counts.existing,1);
 assert.equal(diagnosis.counts.newTotal,3);
 assert.equal(diagnosis.counts.circles,3);
 assert.equal(diagnosis.counts.activityAreas,1);
 const saved=await x.saveDraft();
 assert.equal(saved.status,'SAVED');
 const resumed=createIsolatedEditorSession({...deps,storage:saved && memory()});
 // Do not assume filesystem durability from this ephemeral memory fixture.
 assert.ok(resumed);
});
