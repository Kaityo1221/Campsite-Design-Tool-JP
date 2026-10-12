/*
 * X-01/X-04 LAB-ONLY linked pair prototype.
 * Conserves the complete Project JSON separately from the unmodified KMZ bytes.
 * NO storage, network, UI, save, release or schema migration side effects.
 * A verified pair is NOT an approved production project<->NEW_V1 converter.
 */
import {auditX01X04} from './audit-x01-x04.mjs';
import {stageKmlInput} from '../phase-1b/core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../phase-1b/core/diagnose-kmz-candidate.mjs';
import {sourceActivityAreas} from '../phase-1b/core/activity-areas.mjs';
import {previewLegacyPoiStore} from '../phase-1b/integration/legacy-poi-preview.mjs';

const KIND='campsite-project-kmz-linked-pair-LAB';
const VERSION=0;
const MAX_JSON_BYTES=4*1024*1024;
const MAX_NODES=160000;
function hold(code){const error=new Error(code);error.code=code;throw error;}
function jsonSnapshot(value){
 const seen=new Set();let count=0;
 function visit(v,depth){
  if(++count>MAX_NODES||depth>64)hold('PAIR_JSON_COMPLEXITY');
  if(v===null||typeof v==='string'||typeof v==='boolean')return;
  if(typeof v==='number'&&Number.isFinite(v))return;
  if(typeof v!=='object'||seen.has(v)||Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null&&
     !Array.isArray(v))hold('PAIR_JSON_UNSUPPORTED');
  if(seen.has(v))hold('PAIR_JSON_CYCLE');
  seen.add(v);
  if(Array.isArray(v)){
   for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))hold('PAIR_JSON_SPARSE');visit(v[i],depth+1);}
  }else{
   for(const [k,x] of Object.entries(v)){
    if(k==='__proto__'||k==='prototype')hold('PAIR_JSON_KEY');
    visit(x,depth+1);
   }
  }
  seen.delete(v);
 }
 visit(value,0);
 const json=JSON.stringify(value);
 if(typeof json!=='string'||new TextEncoder().encode(json).length>MAX_JSON_BYTES)hold('PAIR_JSON_SIZE');
 return json;
}
const bytesCopy=bytes=>{
 if(!(bytes instanceof Uint8Array)||bytes.length===0)hold('PAIR_KMZ_BYTES');
 return new Uint8Array(bytes);
};
const stringValue=v=>typeof v==='string'&&v.trim().length>0;
async function sha256(bytes,cryptoProvider){
 if(!cryptoProvider?.subtle?.digest)hold('PAIR_SHA256_UNAVAILABLE');
 const digest=new Uint8Array(await cryptoProvider.subtle.digest('SHA-256',bytes));
 return Array.from(digest,x=>x.toString(16).padStart(2,'0')).join('');
}
const hashJson=(json,provider)=>sha256(new TextEncoder().encode(json),provider);
function normalizedProjectPoi(p){
 if(!p||typeof p!=='object'||Array.isArray(p))hold('PAIR_POI_PROJECT');
 const rawKind=String(p.gameEntity||p.type||'').toUpperCase();
 const kind=({POKESTOP:'pokestop',GYM:'gym',POWERSPOT:'power'})[rawKind];
 const role=p.role==='added'?'new':p.role==='existing'?'existing':null;
 const id=role==='existing'?String(p.guid||p.poiId||'').trim():String(p.id||'').trim();
 if(!role||!kind||!id||!stringValue(p.title)||typeof p.lat!=='number'||typeof p.lng!=='number'||
   !Number.isFinite(p.lat)||!Number.isFinite(p.lng))hold('PAIR_POI_PROJECT');
 return {id,role,kind,title:p.title,lat:p.lat,lng:p.lng,guid:role==='existing'?String(p.guid||'').trim():null};
}
function normalizedKmzPoi(p){
 if(!p||!['existing','new'].includes(p.role))hold('PAIR_POI_KMZ');
 const identity=p.role==='existing'?String(p.guid||p.poiId||'').trim():p.id;
 if(!identity)hold('PAIR_POI_STABLE_ID');
 return {id:identity,role:p.role,kind:p.kind,title:p.title,lat:p.lat,lng:p.lng,
  guid:p.role==='existing'?String(p.guid||'').trim():null};
}
function comparePois(project,kmzRecords){
 // This *strict LAB subset* deliberately does not guess mappings for a
 // partial/legacy/currentPois shape, nor use title or coordinates as an ID.
 const current=project.currentPois;
 if(!Array.isArray(current)||current.length!==kmzRecords.length)hold('PAIR_POI_COUNT_MISMATCH');
 const projectMap=new Map();
 for(const p of current){
  const norm=normalizedProjectPoi(p);
  if(projectMap.has(norm.role+':'+norm.id))hold('PAIR_POI_DUPLICATE');
  projectMap.set(norm.role+':'+norm.id,norm);
 }
 for(const p of kmzRecords){
  const norm=normalizedKmzPoi(p),key=norm.role+':'+norm.id,other=projectMap.get(key);
  if(!other||JSON.stringify(other)!==JSON.stringify(norm))hold('PAIR_POI_MISMATCH');
  projectMap.delete(key);
 }
 if(projectMap.size)hold('PAIR_POI_MISMATCH');
}
function compareAreas(expected,source){
 if(source.length!==expected.length)hold('PAIR_AREA_COUNT_MISMATCH');
 const ids=new Set();
 for(const a of source){
  const candidate=expected.find(e=>e.id===a.id);
  if(!candidate||ids.has(a.id)||JSON.stringify(candidate.points)!==JSON.stringify(a.points))hold('PAIR_AREA_MISMATCH');
  ids.add(a.id);
 }
}
async function preflight(project,areas,bytes,{JSZip,DOMParser,cryptoProvider}){
 if(!JSZip||!DOMParser)hold('PAIR_PARSER_REQUIRED');
 const stage=await stageKmlInput(bytes,{JSZip,DOMParser});
 if(stage.errors.length)hold('PAIR_SOURCE_INVALID');
 const diagnosis=diagnoseKmzCandidate(stage);
 if(diagnosis.profile!=='NEW_V1'||diagnosis.disposition!=='READY')hold('PAIR_NOT_NEW_V1_READY');
 const audit=auditX01X04({project,activityAreas:areas,kmzStage:stage});
 // The sole tolerated issue is that NEW_V1 has no embedded Project envelope:
 // that context is preserved by this separate, experimental LAB-only pair.
 if(!audit.structureValid||!audit.observationPresent||!audit.observationComplete||
    audit.issues.some(x=>x.code!=='PROJECT_ENVELOPE_NOT_DEFINED'))hold('PAIR_PROJECT_PREFLIGHT_HOLD');
 const kmzRecords=previewLegacyPoiStore(stage).records;
 const sourceAreas=sourceActivityAreas(stage);
 compareAreas(areas,sourceAreas);
 comparePois(project,kmzRecords);
 return {diagnosis,kmzPoiCount:kmzRecords.length,areaCount:sourceAreas.length};
}
function checkExpected(project,expectedProjectId,expectedHandoffId){
 if(!stringValue(expectedProjectId)||!stringValue(expectedHandoffId)||
   project.projectId!==expectedProjectId||project.meta?.bridgeHandoffId!==expectedHandoffId)
   hold('PAIR_HANDOFF_IDENTITY_MISMATCH');
}
export async function createLinkedPairLab({project,activityAreas,kmzBytes,expectedProjectId,expectedHandoffId,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto}={}){
 const projectJson=jsonSnapshot(project),areasJson=jsonSnapshot(activityAreas);
 const sourceProject=JSON.parse(projectJson),sourceAreas=JSON.parse(areasJson);
 checkExpected(sourceProject,expectedProjectId,expectedHandoffId);
 const bytes=bytesCopy(kmzBytes);
 const preflightResult=await preflight(sourceProject,sourceAreas,bytes,{JSZip,DOMParser,cryptoProvider});
 const manifest=Object.freeze({
  kind:KIND,version:VERSION,projectId:sourceProject.projectId,handoffId:sourceProject.meta.bridgeHandoffId,
  sourceSnapshotId:sourceProject.wayfarerObservation.snapshotId,projectJson,activityAreasJson:areasJson,
  projectSha256:await hashJson(projectJson,cryptoProvider),activityAreasSha256:await hashJson(areasJson,cryptoProvider),
  kmzSha256:await sha256(bytes,cryptoProvider),kmzByteLength:bytes.length
 });
 return Object.freeze({status:'LAB_PAIR_CREATED',productionReady:false,manifest,kmzBytes:bytes,
  diagnostics:Object.freeze({kmzPoiCount:preflightResult.kmzPoiCount,areaCount:preflightResult.areaCount})});
}
export async function reopenLinkedPairLab({pair,expectedProjectId,expectedHandoffId,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto}={}){
 if(!pair||pair.manifest?.kind!==KIND||pair.manifest?.version!==VERSION)hold('PAIR_FORMAT');
 const m=pair.manifest;
 if(!stringValue(expectedProjectId)||!stringValue(expectedHandoffId)||
   m.projectId!==expectedProjectId||m.handoffId!==expectedHandoffId)hold('PAIR_HANDOFF_IDENTITY_MISMATCH');
 if(typeof m.projectJson!=='string'||typeof m.activityAreasJson!=='string')hold('PAIR_JSON_INVALID');
 if(new TextEncoder().encode(m.projectJson).length>MAX_JSON_BYTES||
    new TextEncoder().encode(m.activityAreasJson).length>MAX_JSON_BYTES)hold('PAIR_JSON_SIZE');
 const bytes=bytesCopy(pair.kmzBytes);
 if(bytes.length!==m.kmzByteLength||await sha256(bytes,cryptoProvider)!==m.kmzSha256||
    await hashJson(m.projectJson,cryptoProvider)!==m.projectSha256||
    await hashJson(m.activityAreasJson,cryptoProvider)!==m.activityAreasSha256)hold('PAIR_INTEGRITY_MISMATCH');
 let project,areas;
 try{project=JSON.parse(m.projectJson);areas=JSON.parse(m.activityAreasJson);}catch{hold('PAIR_JSON_INVALID');}
 if(jsonSnapshot(project)!==m.projectJson||jsonSnapshot(areas)!==m.activityAreasJson)hold('PAIR_JSON_NONCANONICAL');
 checkExpected(project,expectedProjectId,expectedHandoffId);
 if(project.wayfarerObservation?.snapshotId!==m.sourceSnapshotId)hold('PAIR_SNAPSHOT_MISMATCH');
 const proof=await preflight(project,areas,bytes,{JSZip,DOMParser,cryptoProvider});
 return Object.freeze({status:'LAB_PAIR_VERIFIED',productionReady:false,project,activityAreas:areas,kmzBytes:bytes,
  diagnostics:Object.freeze({kmzPoiCount:proof.kmzPoiCount,areaCount:proof.areaCount})});
}
