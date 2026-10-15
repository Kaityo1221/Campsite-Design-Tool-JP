import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {
 createPortableReturnBundleLab,inspectPortableReturnBundleLab
} from '../contracts/portable-return-bundle-lab.mjs';

const {project,makeKmz}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const raw=project(),originalKmz=new Uint8Array(await makeKmz());
const snap=v=>JSON.parse(JSON.stringify(v));
const opts=()=>({project:snap(raw),activityAreas:[],kmzBytes:new Uint8Array(originalKmz),
 revision:2,expectedProjectId:raw.projectId,expectedHandoffId:raw.meta.bridgeHandoffId,
 JSZip,DOMParser,cryptoProvider:webcrypto});
let packed;
test('portable LAB: deterministic provenance roundtrip with independent Project and NEW_V1 file',async()=>{
 const source=opts(),before=snap(source.project),kmz=new Uint8Array(source.kmzBytes);
 packed=await createPortableReturnBundleLab(source);
 assert.equal(packed.status,'LAB_PORTABLE_RETURN_CREATED');
 assert.equal(packed.writeAllowed,false);
 const zip=await JSZip.loadAsync(packed.bytes);
 assert.deepEqual(Object.keys(zip.files).sort(),['creative-new-v1.kmz','linked-pair.json']);
 const received=await inspectPortableReturnBundleLab({bytes:packed.bytes,...source});
 assert.equal(received.status,'LAB_PORTABLE_RETURN_VERIFIED');
 assert.equal(received.revision,2);
 assert.equal(received.productionReady,false);
 assert.equal(received.writeAllowed,false);
 assert.deepEqual(received.project,before);
 assert.deepEqual(received.kmzBytes,originalKmz);
 assert.deepEqual(source.project,before);
 assert.deepEqual(source.kmzBytes,kmz);
 assert.equal(received.summary.reference100Count,1);
 assert.equal(received.summary.reserve200Count,1);
});
test('portable LAB: wrong ID and Handoff fail closed',async()=>{
 const a=opts(),wrong={...a,expectedProjectId:'other-project'};
 await assert.rejects(()=>inspectPortableReturnBundleLab({bytes:packed.bytes,...wrong}),{code:'PORTABLE_IDENTITY_MISMATCH'});
 await assert.rejects(()=>inspectPortableReturnBundleLab({bytes:packed.bytes,...a,expectedHandoffId:'other-handoff'}),{code:'PORTABLE_IDENTITY_MISMATCH'});
 await assert.rejects(()=>inspectPortableReturnBundleLab({bytes:packed.bytes,...a,expectedHandoffId:''}),{code:'PORTABLE_IDS_REQUIRED'});
});
test('portable LAB: malformed ZIP, extra entries and corrupt manifest STOP',async()=>{
 const a=opts();
 await assert.rejects(()=>inspectPortableReturnBundleLab({bytes:new Uint8Array([1,2,3]),...a}),{code:'PORTABLE_ARCHIVE_SIZE'});
 const extra=await JSZip.loadAsync(packed.bytes);extra.file('surprise.txt','malicious');
 const other=await extra.generateAsync({type:'uint8array'});
 await assert.rejects(()=>inspectPortableReturnBundleLab({bytes:other,...a}),{code:'PORTABLE_FILES_INVALID'});
 const changed=await JSZip.loadAsync(packed.bytes);const document=JSON.parse(await changed.file('linked-pair.json').async('string'));
 document.manifest.projectJson=document.manifest.projectJson.replace('existing-guid','changed-guid');
 changed.file('linked-pair.json',JSON.stringify(document));
 const alteredBytes=await changed.generateAsync({type:'uint8array'});
 await assert.rejects(()=>inspectPortableReturnBundleLab({
  bytes:alteredBytes,...a}),{code:'PAIR_INTEGRITY_MISMATCH'});
});
test('portable LAB: altered KMZ refused and package creation rejects incomplete coverage',async()=>{
 const a=opts();
 const changed=await JSZip.loadAsync(packed.bytes);
 changed.file('creative-new-v1.kmz',new Uint8Array([80,75,3,4,0,0]));
 const alteredBytes=await changed.generateAsync({type:'uint8array'});
 await assert.rejects(()=>inspectPortableReturnBundleLab({
  bytes:alteredBytes,...a}),{code:'PAIR_INTEGRITY_MISMATCH'});
 const incomplete=opts();incomplete.project.wayfarerObservation.acquisition.coverageComplete=false;
 await assert.rejects(()=>createPortableReturnBundleLab(incomplete),e=>typeof e?.code==='string');
});
