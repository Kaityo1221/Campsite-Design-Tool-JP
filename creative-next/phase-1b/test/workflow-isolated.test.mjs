import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {exportNewV1Kmz} from '../core/export-kmz.mjs';
import {createCreativeSaveJournal} from '../core/journal-save.mjs';
const deps={JSZip,DOMParser,XMLSerializer};
const r=(id,role='existing',kind='pokestop')=>({id,role,kind,title:'東京 '+id,lat:35.65,lng:139.72,memo:'メモ 🐑'});
const snapshot=(records)=>({records,activityAreas:[],view:{center:[35.65,139.72],zoom:17}});
const memory=()=>{
 const store=new Map();return{getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v))};
};

test('isolated end-to-end: new canonical -> KMZ -> staging -> edit -> KMZ re-import -> 2-gen save recovery',async()=>{
 const state=snapshot([r('old'),r('new','new','gym')]);
 const original=await createFreshV1Kmz(state,deps);
 const staged=await stageKmlInput(original.bytes,deps);
 assert.equal(diagnoseKmzCandidate(staged).disposition,'READY');
 assert.equal(diagnoseKmzCandidate(staged).canApply,false);
 const changed=await exportNewV1Kmz(staged,{...deps,edits:[{id:'new',memo:'変更したメモ',lat:35.650001,lng:139.720002}]});
 const imported=await stageKmlInput(changed.bytes,deps);
 assert.equal(diagnoseKmzCandidate(imported).disposition,'READY');
 assert.equal(imported.places.length,2);
 assert.equal(imported.places[1].description,'変更したメモ');
 assert.equal(imported.places[0].coordinates,'139.72,35.65');
 const storage=memory(),journal=createCreativeSaveJournal({storage});
 await journal.save(state);
 await journal.save(snapshot([r('old'),{...r('new','new','gym'),lat:35.650001,lng:139.720002,memo:'変更したメモ'}]),{expectedRevision:1});
 const restored=await createCreativeSaveJournal({storage}).load();
 assert.equal(restored.status,'READY');assert.equal(restored.revision,2);
 assert.equal(restored.snapshot.records[1].memo,imported.places[1].description);
 assert.equal(restored.snapshot.records[0].lat,state.records[0].lat);
});

test('import staging stays outside live store and save journal until explicit future commit',async()=>{
 const state=snapshot([r('old')]);const original=await createFreshV1Kmz(state,deps);
 const storage=memory(),journal=createCreativeSaveJournal({storage});await journal.save(state);
 const before=await journal.load();
 const candidate=await stageKmlInput(original.bytes,deps);
 assert.equal(candidate.audit.safeXml,true);assert.equal(diagnoseKmzCandidate(candidate).canApply,false);
 assert.deepEqual(await journal.load(),before);
});