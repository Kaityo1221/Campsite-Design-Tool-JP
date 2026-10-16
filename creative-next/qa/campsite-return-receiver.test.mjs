import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {inspectCampsiteReturnLab} from '../contracts/campsite-return-receiver-lab.mjs';

const {project,makeKmz}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const orig=project(),bytes=new Uint8Array(await makeKmz());
const copy=v=>JSON.parse(JSON.stringify(v));
const opts=()=>({project:copy(orig),activityAreas:[],kmzBytes:new Uint8Array(bytes),
 expectedProjectId:orig.projectId,expectedHandoffId:orig.meta.bridgeHandoffId,
 JSZip,DOMParser,cryptoProvider:webcrypto});
test('Campsite return: verified Project+KMZ is read-only, keeps original and three zone metadata',async()=>{
 const arg=opts(),before=copy(arg.project),origBytes=new Uint8Array(arg.kmzBytes);
 const s=await inspectCampsiteReturnLab(arg);
 assert.equal(s.status,'LAB_CAMPSITE_RETURN_VERIFIED');
 assert.equal(s.productionReady,false);assert.equal(s.writeAllowed,false);
 assert.equal(s.legacyBridgeReceiverCompatible,false);
 assert.equal(s.summary.interiorCount,1);
 assert.equal(s.summary.reference100Count,1);
 assert.equal(s.summary.reserve200Count,1);
 assert.equal(s.summary.designPolygonVertices,4);
 assert.equal(s.summary.activityAreaCount,0);
 assert.deepEqual(s.project,before);
 assert.deepEqual(arg.project,before);
 assert.deepEqual(arg.kmzBytes,origBytes);
});
test('Campsite return: cannot receive an incorrect or missing Handoff ID',async()=>{
 const bad=opts();bad.expectedHandoffId='handoff:other';
 await assert.rejects(()=>inspectCampsiteReturnLab(bad),e=>e?.code==='PAIR_HANDOFF_IDENTITY_MISMATCH');
 const absent=opts();absent.expectedHandoffId='';
 await assert.rejects(()=>inspectCampsiteReturnLab(absent),e=>e?.code==='RETURN_IDS_REQUIRED');
});
test('Campsite return: rejects incomplete Wayfarer observations',async()=>{
 const bad=opts();bad.project.wayfarerObservation.acquisition.coverageComplete=false;
 await assert.rejects(()=>inspectCampsiteReturnLab(bad),e=>e?.code==='PAIR_PROJECT_PREFLIGHT_HOLD');
});
test('Campsite return: refuses partial Project lineage rather than inventing it',async()=>{
 const bad=opts();delete bad.project.sourcePois;
 await assert.rejects(()=>inspectCampsiteReturnLab(bad),e=>e?.code==='RETURN_PROJECT_LINEAGE_REQUIRED');
});
test('Campsite return: outside reference cannot become an editable current POI',async()=>{
 const bad=opts();
 bad.project.currentPois[0].guid='outside-guid';
 await assert.rejects(()=>inspectCampsiteReturnLab(bad),e=>typeof e?.code==='string');
 assert.equal(orig.currentPois[0].guid,'existing-guid');
});
test('Campsite return: corrupted KMZ cannot be marked verified',async()=>{
 const bad=opts();bad.kmzBytes[0]^=0xff;
 await assert.rejects(()=>inspectCampsiteReturnLab(bad),e=>typeof e?.code==='string');
});
