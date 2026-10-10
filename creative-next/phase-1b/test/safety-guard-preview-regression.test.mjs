import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';

const deps={JSZip,DOMParser,XMLSerializer};
const memory=()=>{const data=new Map();return {
 getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)
};};
const fixture={records:[{id:'existing-one',role:'existing',kind:'pokestop',title:'Original',memo:'',lat:35.642,lng:139.855,deleted:false}],activityAreas:[]};
const invalidKml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<ExtendedData><Data name="campsite.creative.format"><value>creative-mode-next</value></Data><Data name="campsite.creative.version"><value>1</value></Data></ExtendedData>
<Placemark><name>metadata missing (test only)</name><Point><coordinates>139.8550,35.6420,0</coordinates></Point></Placemark>
</Document></kml>`;

test('incomplete v1 KMZ is held without replacing the active work',async()=>{
 const session=createIsolatedEditorSession(deps);
 const valid=(await createFreshV1Kmz(fixture,deps)).bytes;
 assert.equal((await session.prepare(valid)).status,'REVIEW');
 assert.equal(session.acceptPrepared({confirmed:true}).applied,true);
 const previous=session.state();
 const zip=new JSZip();zip.file('doc.kml',invalidKml);
 const bytes=await zip.generateAsync({type:'uint8array'});
 const invalid=await session.prepare(bytes);
 assert.equal(invalid.status,'HOLD');
 assert.equal(invalid.canApply,false);
 assert.equal(session.state().records.length,previous.records.length);
 assert.equal(session.state().records[0].id,previous.records[0].id);
});

test('stale separate tab fails closed rather than overwriting previously saved journal',async()=>{
 const storage=memory(),namespace='campsite-creative-next-v1-save-isolated-r10-test';
 const original=(await createFreshV1Kmz(fixture,deps)).bytes;
 const first=createIsolatedEditorSession({...deps,storage,namespace});
 const second=createIsolatedEditorSession({...deps,storage,namespace});
 for(const session of [first,second]){
  assert.equal((await session.prepare(original)).status,'REVIEW');
  assert.equal(session.acceptPrepared({confirmed:true}).applied,true);
 }
 assert.equal((await first.saveDraft()).revision,1);
 const marker=storage.getItem(namespace+':current');
 assert.ok(marker);
 await assert.rejects(()=>second.saveDraft(),error=>error.code==='SAVE_CONFLICT');
 assert.equal(storage.getItem(namespace+':current'),marker);
 assert.equal((await second.inspectDraft()).revision,1);
});
