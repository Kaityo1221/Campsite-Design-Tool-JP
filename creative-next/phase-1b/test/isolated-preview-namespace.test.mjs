import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';
import {
  LEGACY_PREVIEW_NAMESPACE,R10_SAVE_NAMESPACE,R11_AUDIT_NAMESPACE,R12_WINDING_NAMESPACE,namespaceForPreviewPath
} from '../../phase-2-preview/workspace-namespace.mjs';

const deps={JSZip,DOMParser,XMLSerializer};
const makeStorage=()=>{
 const m=new Map();
 return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),has:k=>m.has(k)};
};
const fixture={
 records:[{id:'old',role:'existing',kind:'pokestop',title:'source',memo:'',lat:35.64,lng:139.85,deleted:false}],
 activityAreas:[{id:'area-one',points:[[35.6408,139.8535],[35.6407,139.8585],[35.6445,139.8585],[35.6445,139.8535]]}]
};
test('versioned preview URL selects a distinct valid namespace only in r10',()=>{
 assert.notEqual(LEGACY_PREVIEW_NAMESPACE,R10_SAVE_NAMESPACE);
 assert.notEqual(LEGACY_PREVIEW_NAMESPACE,R11_AUDIT_NAMESPACE);
 assert.notEqual(R10_SAVE_NAMESPACE,R11_AUDIT_NAMESPACE);
 assert.notEqual(R12_WINDING_NAMESPACE,R11_AUDIT_NAMESPACE);
 assert.notEqual(R12_WINDING_NAMESPACE,R10_SAVE_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/roundtrip-fix-r9/phase-2-preview/index.html'),LEGACY_PREVIEW_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/phase-2-preview/index.html'),LEGACY_PREVIEW_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/save-isolated-r10/phase-2-preview/index.html'),R10_SAVE_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/save-isolated-r10/phase-2-preview/'),R10_SAVE_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/save-isolated-r10/other/index.html'),LEGACY_PREVIEW_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/legacy-audit-r11/phase-2-preview/index.html'),R11_AUDIT_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/legacy-audit-r11/phase-2-preview/'),R11_AUDIT_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/legacy-winding-r12/phase-2-preview/index.html'),R12_WINDING_NAMESPACE);
 assert.equal(namespaceForPreviewPath('/campsite-creative-next-preview/legacy-winding-r12/phase-2-preview/'),R12_WINDING_NAMESPACE);
});

test('old saved journal is untouched when a separate r10 session saves',async()=>{
 const data=makeStorage();
 const zip=(await createFreshV1Kmz(fixture,deps)).bytes;
 const prepare=async namespace=>{
   const s=createIsolatedEditorSession({...deps,namespace,storage:data});
   assert.equal((await s.prepare(zip)).status,'REVIEW');
   assert.equal(s.acceptPrepared({confirmed:true}).applied,true);
   return s;
 };
 const old=await prepare(LEGACY_PREVIEW_NAMESPACE);
 const oldSaved=await old.saveDraft();assert.equal(oldSaved.revision,1);
 const pointerKey=LEGACY_PREVIEW_NAMESPACE+':current';
 const oldPointer=data.getItem(pointerKey);
 assert.ok(oldPointer);
 const next=await prepare(R10_SAVE_NAMESPACE);
 assert.equal((await next.inspectDraft()).status,'EMPTY');
 const newSaved=await next.saveDraft();assert.equal(newSaved.revision,1);
 assert.equal(data.getItem(pointerKey),oldPointer);
 assert.ok(data.getItem(R10_SAVE_NAMESPACE+':current'));
 assert.equal((await old.inspectDraft()).revision,1);
 assert.equal((await next.inspectDraft()).revision,1);
});
