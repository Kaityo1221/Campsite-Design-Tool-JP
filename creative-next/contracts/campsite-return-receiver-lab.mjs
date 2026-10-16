/*
 * Campsite Project RETURN receiver, READ-ONLY isolated LAB candidate.
 * This is NOT the existing Bridge POI Receiver, an approved return protocol,
 * a migration or production persistence. Never write campsiteProject.v1.
 */
import {createLinkedPairLab,reopenLinkedPairLab} from './linked-project-kmz-lab.mjs';

const hold=code=>{const e=new Error(code);e.code=code;throw e;};
const snapshot=x=>JSON.parse(JSON.stringify(x));
const validId=s=>typeof s==='string'&&s.trim().length>0&&s.length<=128;

export async function inspectCampsiteReturnLab({
 project,activityAreas,kmzBytes,expectedProjectId,expectedHandoffId,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto
}={}){
 if(!validId(expectedProjectId)||!validId(expectedHandoffId))hold('RETURN_IDS_REQUIRED');
 if(!project||!Array.isArray(activityAreas)||!(kmzBytes instanceof Uint8Array))
  hold('RETURN_PAIR_REQUIRED');
 // Reuse the real canonical Project/NEW_V1 verifier, not a partial preview of
 // the uploaded JSON. Unsupported zones/identity/geometry/POIs must fail closed.
 const opts={expectedProjectId,expectedHandoffId,JSZip,DOMParser,cryptoProvider};
 const pair=await createLinkedPairLab({project,activityAreas,kmzBytes,...opts});
 const verified=await reopenLinkedPairLab({pair,...opts});
 const p=verified.project;
 if(p.schemaVersion!=='1.0'||p.source!=='bridge'||
    p.meta?.projectContract!=='campsiteProject.v1')hold('RETURN_PROJECT_CONTRACT');
 if(!p.wayfarerObservation?.acquisition?.coverageComplete)hold('RETURN_OBSERVATION_INCOMPLETE');
 const zones=p.wayfarerObservation.zones,source=Array.isArray(p.sourcePois)?p.sourcePois:null;
 if(!source||!Array.isArray(p.selectedPois)||!Array.isArray(p.addedPois)||
    !Array.isArray(p.deletedPois)||!Array.isArray(p.edits))hold('RETURN_PROJECT_LINEAGE_REQUIRED');
 const outsideIds=new Set([...zones.reference100,...zones.reserve200]
  .map(x=>String(x.guid||x.poiId||'').trim()).filter(Boolean));
 const current=p.currentPois||[];
 if(current.some(x=>outsideIds.has(String(x.guid||x.poiId||'').trim())))
  hold('RETURN_EXTERNAL_POI_LEAK');
 const added=current.filter(x=>x.role==='added');
 const incomingAdded=new Set(p.addedPois.map(x=>String(x.id||'')));
 if(added.some(x=>!incomingAdded.has(String(x.id||'')))||
    added.length!==p.addedPois.length)hold('RETURN_ADDED_POI_IDENTITY');
 const summary=Object.freeze({
  projectId:p.projectId,handoffId:p.meta.bridgeHandoffId,
  snapshotId:p.wayfarerObservation.snapshotId,
  designPolygonVertices:p.polygon.length,
  acquisitionPolygonVertices:p.wayfarerObservation.polygon.length,
  activityAreaCount:verified.activityAreas.length,
  currentPoiCount:current.length,addedPoiCount:added.length,
  interiorCount:zones.interior.length,reference100Count:zones.reference100.length,
  reserve200Count:zones.reserve200.length,
  coverageComplete:true,legacyBridgeReceiverCompatible:false
 });
 return Object.freeze({status:'LAB_CAMPSITE_RETURN_VERIFIED',
  productionReady:false,writeAllowed:false,legacyBridgeReceiverCompatible:false,
  summary,project:snapshot(p),activityAreas:snapshot(verified.activityAreas),
  kmzBytes:new Uint8Array(verified.kmzBytes)});
}
