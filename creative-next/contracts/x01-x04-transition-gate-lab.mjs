/*
 * X-01/X-04 verified handoff and generation-transition dry run.
 * Synthetic LAB only; NO approval, actual writes, rollback, or live import.
 * Deliberately no access to indexedDB, sessionStorage or a network transport.
 */
import {createLinkedPairLab} from './linked-project-kmz-lab.mjs';
import {inspectCampsiteReturnLab} from './campsite-return-receiver-lab.mjs';

const hold=code=>{const e=new Error(code);e.code=code;throw e;};
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const copy=x=>JSON.parse(JSON.stringify(x));
const isInt=x=>Number.isSafeInteger(x)&&x>=1;
const id=x=>typeof x==='string'&&x.trim().length>0&&x.length<=128;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function canonicalActivityAreas(areas,selectedIds){
 if(!Array.isArray(areas)||!Array.isArray(selectedIds))hold('X01_AREAS_OR_SELECTION_REQUIRED');
 const byId=new Map();
 for(const area of areas){
  if(!area||!id(area.id)||!Array.isArray(area.points)||byId.has(area.id))
   hold('X01_AREA_INVALID');
  byId.set(area.id,area);
 }
 if(selectedIds.length!==areas.length||new Set(selectedIds).size!==selectedIds.length||
  selectedIds.some(x=>!id(x)||!byId.has(x)))
  hold('X01_EXPLICIT_SELECTION_INCOMPLETE');
 return selectedIds.map(x=>copy(byId.get(x)));
}
/**
 * An explicit, ordered all-area selection is required even when zero areas exist.
 * It is a *proposal*, never a Distance _activityPolygons mapping or import grant.
 */
export function previewX01AreaSelectionLab({distanceStage,selectedActivityAreaIds}={}){
 const d=distanceStage?.distanceInput;
 if(distanceStage?.status!=='LAB_DISTANCE_INPUT_STAGED_READ_ONLY'||
  distanceStage.productionReady!==false||distanceStage.writeAllowed!==false||
  distanceStage.legacyDistanceCommitAllowed!==false||!d||
  !Array.isArray(d.designPolygon)||!Array.isArray(d.acquisitionPolygon))
  hold('X01_DISTANCE_STAGE_REQUIRED');
 const chosen=canonicalActivityAreas(d.activityAreas,selectedActivityAreaIds);
 return Object.freeze({
  status:'LAB_X01_EXPLICIT_AREA_SELECTION_HOLD',
  productionReady:false,writeAllowed:false,
  legacyDistanceCommitAllowed:false,approvedMapping:false,
  selectionIntent:'ALL_AREAS_EXPLICIT_ORDER',
  mappedAreaIds:chosen.map(x=>x.id),
  proposedActivityAreas:chosen,
  designPolygon:copy(d.designPolygon),
  acquisitionPolygon:copy(d.acquisitionPolygon),
  reason:'X01_AREA_DISTANCE_MAPPING_UNAPPROVED'
 });
}
async function verifySnapshot(row,expectedProjectId,expectedHandoffId,deps){
 if(!row||!row.project||!Array.isArray(row.activityAreas)||!isInt(row.revision)||
  !(row.kmzBytes instanceof Uint8Array))hold('X04_SNAPSHOT_REQUIRED');
 const verified=await inspectCampsiteReturnLab({
  ...row,expectedProjectId,expectedHandoffId,...deps
 });
 if(verified.productionReady!==false||verified.writeAllowed!==false)hold('X04_WRITE_GATE');
 const pair=await createLinkedPairLab({
  project:verified.project,activityAreas:verified.activityAreas,kmzBytes:verified.kmzBytes,
  expectedProjectId,expectedHandoffId,...deps
 });
 const m=pair.manifest;
 return Object.freeze({
  revision:row.revision,
  project:verified.project,
  activityAreas:verified.activityAreas,
  kmzBytes:verified.kmzBytes,
  fingerprint:Object.freeze({projectSha256:m.projectSha256,
   activityAreasSha256:m.activityAreasSha256,kmzSha256:m.kmzSha256})
 });
}
const matches=(a,b)=>!!a&&!!b&&['projectSha256','activityAreasSha256','kmzSha256']
 .every(k=>own(a,k)&&typeof a[k]==='string'&&a[k]===b[k]);

/**
 * Compare an explicitly selected base generation against verified current bytes.
 * The caller cannot mutate the real store via this object. Even PASS as a dry
 * run never authorizes the proposed successor or rollback.
 */
export async function previewX04GenerationTransitionLab({
 current,candidate,baseRevision,baseFingerprint,operation,
 rollbackSource=null,confirmed=false,
 expectedProjectId,expectedHandoffId,JSZip,DOMParser,
 cryptoProvider=globalThis.crypto
}={}){
 if(!id(expectedProjectId)||!id(expectedHandoffId))hold('X04_IDS_REQUIRED');
 if(!['REEDIT','ROLLBACK'].includes(operation))hold('X04_OPERATION_REQUIRED');
 if(confirmed!==true)hold('X04_CONFIRMATION_REQUIRED');
 if(!isInt(baseRevision))hold('X04_BASE_REVISION_REQUIRED');
 const deps={JSZip,DOMParser,cryptoProvider};
 const currentVerified=await verifySnapshot(current,expectedProjectId,expectedHandoffId,deps);
 if(baseRevision!==currentVerified.revision||!matches(baseFingerprint,currentVerified.fingerprint))
  hold('X04_STALE_GENERATION_HOLD');
 // No trusted 'source generation' can be inferred from the sender's ZIP.
 if(candidate?.revision!==undefined)hold('X04_CANDIDATE_REVISION_NOT_ASSIGNED');
 const proposed=await verifySnapshot({revision:1,...candidate},
  expectedProjectId,expectedHandoffId,deps);
 if(!same(currentVerified.project.wayfarerObservation,proposed.project.wayfarerObservation))
  hold('X04_WM7_REOBSERVATION_HOLD');
 if(!same(currentVerified.project.polygon,proposed.project.polygon))
  hold('X01_DESIGN_POLYGON_CHANGE_HOLD');
 let sourceRevision=null;
 if(operation==='ROLLBACK'){
  const source=await verifySnapshot(rollbackSource,expectedProjectId,expectedHandoffId,deps);
  if(source.revision>=currentVerified.revision)hold('X04_ROLLBACK_NOT_OLDER_HOLD');
  if(!matches(source.fingerprint,proposed.fingerprint))
   hold('X04_ROLLBACK_SOURCE_MISMATCH');
  sourceRevision=source.revision;
 }else if(rollbackSource!==null){
  hold('X04_UNEXPECTED_ROLLBACK_SOURCE');
 }
 if(currentVerified.revision===Number.MAX_SAFE_INTEGER)hold('X04_REVISION_OVERFLOW');
 return Object.freeze({
  status:'LAB_X04_TRANSITION_REVIEWED_HOLD',
  operation,productionReady:false,writeAllowed:false,
  legacyDistanceCommitAllowed:false,
  transportAuthenticated:false,producerIdentityVerified:false,
  rollbackPerformed:false,committed:false,
  basedOnRevision:currentVerified.revision,
  proposedRevision:currentVerified.revision+1,
  rollbackSourceRevision:sourceRevision,
  basedOnFingerprint:copy(currentVerified.fingerprint),
  candidateFingerprint:copy(proposed.fingerprint),
  activityAreaCount:proposed.activityAreas.length,
  reason:'X04_MULTI_GENERATION_COMMIT_UNAPPROVED'
 });
}
