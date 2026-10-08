/* Optional private fixture runner: node test/verify-real-kasai-editor.mjs /path/to/private.kmz
 * NEVER commit the referenced user KMZ or generated output to a public repository.
 */
import JSZip from 'jszip';import{DOMParser,XMLSerializer}from '@xmldom/xmldom';
import{readFileSync}from 'node:fs';import{createHash}from 'node:crypto';
import{createIsolatedEditorSession}from '../integration/isolated-editor-session.mjs';
import{stageKmlInput}from '../core/stage-kmz.mjs';
import assert from 'node:assert/strict';
const file=process.argv[2];if(!file){console.error('Provide a private KMZ path');process.exitCode=2;}
else{
 const source=readFileSync(file);const hash=createHash('sha256').update(source).digest('hex');
 if(hash!=='1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162')throw Error('Unexpected fixture fingerprint');
 const map=new Map([['next-lab-creative-v7','KEEP_ORIGINAL']]);const storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))};
 const deps={JSZip,DOMParser,XMLSerializer,storage};const editor=createIsolatedEditorSession(deps);
 const candidate=await editor.prepare(source);assert.equal(candidate.status,'REVIEW');assert.equal(candidate.converted,true);
 assert.equal(editor.state().hasActive,false);assert.deepEqual([candidate.counts.existing,candidate.counts.newTotal,candidate.counts.circles,candidate.counts.activityAreas],[188,25,213,1]);
 editor.acceptPrepared({confirmed:true});assert.equal(editor.state().records.length,213);
 const target=editor.state().records.find(p=>p.role==='existing');const sourceText=target.metadata.originalPointCoordinates;
 const changed=editor.command({type:'edit',id:target.id,patch:{memo:'隔離復元検証'}},{confirmed:true});assert.equal(changed.ok,true);
 assert.equal(editor.undo().ok,true);assert.equal(editor.redo().ok,true);
 const old=editor.state().records.find(p=>p.role==='existing');assert.equal(old.metadata.originalPointCoordinates,sourceText);
 assert.throws(()=>editor.command({type:'move',id:target.id,lat:35.7,lng:139.9},{confirmed:true}),e=>e.code==='EXISTING_POSITION_LOCKED');
 const changedKind=editor.command({type:'change-kind',id:target.id,kind:target.kind==='gym'?'pokestop':'gym'},{confirmed:true});
 assert.equal(changedKind.ok,true,'Audited Kasai legacy layers can move kind with matching folder/icon');
 assert.equal(editor.undo().ok,true);
 const deletion=editor.command({type:'delete',id:target.id},{confirmed:true});assert.equal(deletion.ok,true);
 assert.equal(editor.state().circles.length,212);
 assert.equal(editor.undo().ok,true);assert.equal(editor.state().circles.length,213);
 const out=await editor.exportKmz(),outStage=await stageKmlInput(out.bytes,deps);
 assert.equal(outStage.errors.length,0);assert.equal(out.verification.counts.circles,213);
 const save=await editor.saveDraft();assert.equal(save.status,'SAVED');const resumed=createIsolatedEditorSession(deps);
 assert.equal((await resumed.resumeDraft({confirmed:true})).applied,true);assert.equal(resumed.state().records[0].memo,'隔離復元検証');
 assert.equal(map.get('next-lab-creative-v7'),'KEEP_ORIGINAL');
 console.log('REAL_KASAI_SESSION: PASS (188 existing, 25 new, 213 circles, 1 area; existing move denied, safe kind edit/Undo accepted; source-linked delete/Undo updates circles; export, journal and resume verified; original v7 untouched)');
}
