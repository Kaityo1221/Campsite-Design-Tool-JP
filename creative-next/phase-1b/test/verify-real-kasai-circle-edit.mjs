/* Private fixture runner: node test/verify-real-kasai-circle-edit.mjs /private/Kasai.kmz
 * No fixture data or derivative export may be added to public GitHub.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
const filename=process.argv[2];if(!filename)throw Error('Provide original private Kasai KMZ as first argument');
const bytes=new Uint8Array(readFileSync(filename));
const digest=createHash('sha256').update(bytes).digest('hex');
assert.equal(digest,'1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162');
const deps={JSZip,DOMParser,XMLSerializer};
const x=createIsolatedEditorSession(deps);
const prep=await x.prepare(bytes);assert.equal(prep.status,'REVIEW');assert.equal(prep.converted,true);
assert.equal(x.acceptPrepared({confirmed:true}).applied,true);
let state=x.state();assert.equal(state.records.length,213);assert.equal(state.circles.length,213);assert.equal(state.areas.length,1);
const moved=state.records.find(p=>p.role==='new');assert(moved);
const deleted=state.records.find(p=>p.role==='existing');assert(deleted);
// Real old-form data; a NEW POI moves together with the linked 50m circle.
const before=state.circles.find(c=>c.ownerId===moved.id);assert(before);
assert.equal(x.command({type:'move',id:moved.id,lat:moved.lat+0.0001,lng:moved.lng+0.0001},{confirmed:true}).ok,true);
state=x.state();assert.equal(state.circles.length,213);
assert.notEqual(state.circles.find(c=>c.ownerId===moved.id).lat,before.lat);
let out=await x.exportKmz(),staged=await stageKmlInput(out.bytes,deps);let diag=diagnoseKmzCandidate(staged);
assert.equal(diag.disposition,'READY',JSON.stringify(diag.issues));
assert.deepEqual([diag.counts.existing,diag.counts.newTotal,diag.counts.circles,diag.counts.activityAreas],[188,25,213,1]);
// Deleting an existing owner removes its owned circle from the export, not unrelated rings.
assert.equal(x.command({type:'delete',id:deleted.id},{confirmed:true}).ok,true);
state=x.state();assert.equal(state.circles.length,212);assert.equal(state.records.find(p=>p.id===deleted.id).deleted,true);
out=await x.exportKmz();staged=await stageKmlInput(out.bytes,deps);diag=diagnoseKmzCandidate(staged);
assert.equal(diag.disposition,'READY',JSON.stringify(diag.issues));
assert.deepEqual([diag.counts.existing,diag.counts.newTotal,diag.counts.circles,diag.counts.activityAreas],[187,25,212,1]);
// Undo of deletion restores that original ring; undo of move restores original centre.
assert.equal(x.undo().ok,true);assert.equal(x.state().circles.length,213);
assert.equal(x.undo().ok,true);assert.equal(x.state().circles.find(c=>c.ownerId===moved.id).lat,before.lat);
out=await x.exportKmz();staged=await stageKmlInput(out.bytes,deps);diag=diagnoseKmzCandidate(staged);
assert.deepEqual([diag.counts.existing,diag.counts.newTotal,diag.counts.circles,diag.counts.activityAreas],[188,25,213,1]);
assert.equal(diag.disposition,'READY');
console.log('REAL_KASAI_CIRCLE_EDIT: PASS (213 owned circles, move new POI with 50m circle, delete existing with circle, Undo restores 213; original SHA protected)');
