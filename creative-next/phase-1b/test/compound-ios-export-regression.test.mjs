import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {circleRingAt} from '../core/dependent-circles.mjs';

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
 // The actual iPhone source includes a third 50m circle owned by existing A.
 // Preserve it as a verified source circle, not a newly added POI.
 const zipped=await JSZip.loadAsync((await seed.exportKmz()).bytes);
 const xml=new DOMParser().parseFromString(await zipped.file('doc.kml').async('string'),'application/xml');
 const ns='http://www.opengis.net/kml/2.2';
 const document=xml.getElementsByTagNameNS(ns,'Document')[0];
 const folder=Array.from(xml.getElementsByTagNameNS(ns,'Folder')).find(x=>Array.from(x.childNodes||[]).some(y=>y.localName==='name'&&y.textContent==='50m サークル'));
 assert.ok(folder);
 const el=(parent,name,value)=>{const n=xml.createElementNS(ns,name);if(value!==undefined)n.textContent=String(value);parent.appendChild(n);return n;};
 const pm=el(folder,'Placemark');el(pm,'name','50m 既存POI A');
 const ext=el(pm,'ExtendedData');
 for(const [k,v] of Object.entries({object:'distance-circle','circle-owner-id':'existing-a','circle-radius':'50'})){
   const d=el(ext,'Data');d.setAttribute('name','campsite.creative.'+k);el(d,'value',v);
 }
 const polygon=el(pm,'Polygon'),outer=el(polygon,'outerBoundaryIs'),ring=el(outer,'LinearRing');
 el(ring,'coordinates',circleRingAt(orig.lat,orig.lng,50));
 zipped.file('doc.kml',new XMLSerializer().serializeToString(xml));
 const imported=await zipped.generateAsync({type:'uint8array',compression:'DEFLATE'});
 const originalStage=await stageKmlInput(imported,deps);
 assert.equal(diagnoseKmzCandidate(originalStage).disposition,'READY');
 assert.equal(diagnoseKmzCandidate(originalStage).counts.circles,3);
 const x=createIsolatedEditorSession({...deps,storage:memory()});await confirmed(x,imported);
 const gym=x.state().records.find(r=>r.title==='Gym B');
 assert.ok(gym);
 assert.equal(x.command({type:'edit',id:'existing-a',patch:{memo:'iPhone動作確認'}},{confirmed:true}).ok,true);
 assert.equal(x.command({type:'move',id:gym.id,lat:35.6428,lng:139.8558},{confirmed:true}).ok,true);
 add(x,'テスト用・新規POI D','pokestop',35.6430,139.8568);
 assert.equal(x.state().circles.length,4);
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
 assert.equal(diagnosis.counts.circles,4);
 assert.equal(diagnosis.counts.activityAreas,1);
 const saved=await x.saveDraft();
 assert.equal(saved.status,'SAVED');

});
