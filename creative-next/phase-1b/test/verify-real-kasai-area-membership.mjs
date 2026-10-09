/* PRIVATE real-Kasai fixture validation. Never commit the source or generated KMZ. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
const path=process.argv[2];if(!path)throw Error('Private KMZ required');
const input=readFileSync(path),hash=createHash('sha256').update(input).digest('hex');
assert.equal(hash,'1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162');
const deps={JSZip,DOMParser,XMLSerializer};
const m=new Map([['next-lab-creative-v7','LOCKED_OLD']]);const storage={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};
const s=createIsolatedEditorSession({...deps,storage});assert.equal((await s.prepare(new Uint8Array(input))).status,'REVIEW');assert.equal(s.acceptPrepared({confirmed:true}).applied,true);
const original=s.state(),oldArea=original.areas[0];
assert.equal(original.records.filter(r=>r.role==='existing').length,188);
assert.equal(original.records.filter(r=>r.role==='new').length,25);
assert.equal(original.circles.length,213);assert.equal(original.areas.length,1);
s.commandArea({type:'area-remove',id:oldArea.id},{confirmed:true});
assert.equal(s.state().areas.length,0);
let stage=await stageKmlInput((await s.exportKmz()).bytes,deps),report=diagnoseKmzCandidate(stage);
assert.deepEqual([report.counts.existing,report.counts.newTotal,report.counts.circles,report.counts.activityAreas],[188,25,213,0]);
assert.equal(report.disposition,'READY');
const first=original.areas[0].points.slice(0,4);
// Reuse known valid coordinates for a NEW area with its own independent identity.
s.commandArea({type:'area-create',id:'area-added-for-kasai-real-test',points:first},{confirmed:true});
assert.equal(s.state().areas.length,1);
stage=await stageKmlInput((await s.exportKmz()).bytes,deps),report=diagnoseKmzCandidate(stage);
assert.deepEqual([report.counts.existing,report.counts.newTotal,report.counts.circles,report.counts.activityAreas],[188,25,213,1]);
assert.equal(report.disposition,'READY');
const newArea=stage.places.find(p=>p.data.some(d=>d.name==='campsite.creative.area-id'&&d.value==='area-added-for-kasai-real-test'));
assert.ok(newArea);assert.equal(newArea.polygonGeometry.points.length,first.length+1);
assert.equal((await s.saveDraft()).status,'SAVED');
const r=createIsolatedEditorSession({...deps,storage});assert.equal((await r.resumeDraft({confirmed:true})).applied,true);
assert.deepEqual(r.state().areas.map(a=>a.id),['area-added-for-kasai-real-test']);
assert.equal(r.state().circles.length,213);
s.undo();assert.equal(s.state().areas.length,0);
s.undo();assert.equal(s.state().areas[0].id,oldArea.id);
s.redo();s.redo();assert.equal(s.state().areas[0].id,'area-added-for-kasai-real-test');
const inZip=await JSZip.loadAsync(input,{checkCRC32:true});const outZip=await JSZip.loadAsync((await s.exportKmz()).bytes,{checkCRC32:true});
for(const [name,file] of Object.entries(inZip.files))if(!file.dir&&!name.toLowerCase().endsWith('.kml')){
 assert.ok(outZip.file(name),'original attachment lost: '+name);
 assert.deepEqual(await outZip.file(name).async('uint8array'),await file.async('uint8array'),'attachment changed: '+name);
}
assert.equal(m.get('next-lab-creative-v7'),'LOCKED_OLD');
assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'),hash);
console.log('REAL_KASAI_AREA_MEMBERSHIP: PASS original 188/25/213/1 -> delete 0 areas -> add 1 new area, Undo/Redo, journal restore, attachments unchanged, legacy store protected, original raw file untouched');
