/*
 * X-01 data-only Distance candidate. Disconnected and READ ONLY.
 * Never installs runtime globals, writes storage or approves Distance mapping.
 */
import {previewX01AreaSelectionLab} from './x01-x04-transition-gate-lab.mjs';
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const clone=x=>JSON.parse(JSON.stringify(x));
function lock(x){
 if(x&&typeof x==='object'&&!Object.isFrozen(x)){
  for(const value of Object.values(x))lock(value);
  Object.freeze(x);
 }
 return x;
}
const EXPECTED=Object.freeze({
 existing:Object.freeze({POKESTOP:'既存 PokéStop',GYM:'既存 Gym',POWERSPOT:'既存 PowerSpot'}),
 added:Object.freeze({POKESTOP:'新規 PokéStop',GYM:'新規 Gym',POWERSPOT:'新規 PowerSpot'})
});
const id=x=>typeof x==='string'&&x.length>0&&x.trim()===x&&x.length<=128;
function polygon(p,n,code){
 if(!Array.isArray(p)||p.length<3||p.length>n)fail(code);
 for(const v of p)if(!Array.isArray(v)||v.length!==2||
  typeof v[0]!=='number'||!Number.isFinite(v[0])||Math.abs(v[0])>90||
  typeof v[1]!=='number'||!Number.isFinite(v[1])||Math.abs(v[1])>180)fail(code);
 return clone(p);
}
function groupedPoints(stage){
 const groups=stage.distanceInput.groups;
 if(!groups||typeof groups!=='object'||Array.isArray(groups))fail('X01_GROUPS_REQUIRED');
 let count=0;const keys=new Set(),out={};
 for(const [layer,points] of Object.entries(groups)){
  if(!Array.isArray(points))fail('X01_GROUPS_INVALID');
  out[layer]=[];
  for(const p of points){
   if(!p||!['existing','added'].includes(p.role)||!id(p.id)||
    !Object.hasOwn(EXPECTED[p.role],p.gameEntity)||
    EXPECTED[p.role][p.gameEntity]!==layer||
    typeof p.name!=='string'||!p.name.trim()||p.title!==p.name||
    typeof p.lat!=='number'||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||
    typeof p.lng!=='number'||!Number.isFinite(p.lng)||Math.abs(p.lng)>180)
    fail('X01_POI_INVALID');
   const stable=p.role==='existing'?p.guid:p.id;
   const key=p.role+':'+stable;
   if(!id(stable)||keys.has(key))fail('X01_POI_DUPLICATE_OR_UNSTABLE');
   keys.add(key);out[layer].push(clone(p));count++;
  }
 }
 if(count!==stage.summary?.currentPoiCount)fail('X01_POI_COUNT_MISMATCH');
 return out;
}
export function compileX01TypedDistanceCandidateLab({
 distanceStage,selectedActivityAreaIds,confirmed=false,zeroAreaAcknowledged=false
}={}){
 if(confirmed!==true)fail('X01_OPERATOR_CONFIRM_REQUIRED');
 const stage=distanceStage,d=stage?.distanceInput;
 if(stage?.status!=='LAB_DISTANCE_INPUT_STAGED_READ_ONLY'||
  stage.productionReady!==false||stage.writeAllowed!==false||
  stage.legacyDistanceCommitAllowed!==false||
  d?.legacyActivityPolygonMapping!=='UNAPPROVED'||
  d?.recomputeDistanceRequired!==true)fail('X01_UNAPPROVED_STAGE_HOLD');
 if(!Array.isArray(d.activityAreas)||d.activityAreas.length>64)
  fail('X01_AREA_COUNT_HOLD');
 if(d.activityAreas.length===0&&!zeroAreaAcknowledged)
  fail('X01_ZERO_AREAS_NOT_ACKNOWLEDGED');
 if(d.activityAreas.length>0&&zeroAreaAcknowledged)
  fail('X01_CONTRADICTORY_ZERO_ACK');
 const reviewed=previewX01AreaSelectionLab({distanceStage:stage,selectedActivityAreaIds});
 if(reviewed.approvedMapping!==false||reviewed.writeAllowed!==false||
  reviewed.legacyDistanceCommitAllowed!==false)fail('X01_APPROVAL_GATE');
 const originalActivityAreas=reviewed.proposedActivityAreas.map(a=>({
  id:a.id,points:polygon(a.points,512,'X01_ACTIVITY_POLYGON_INVALID')
 }));
 const result={
  status:'LAB_X01_TYPED_DISTANCE_ADAPTER_CANDIDATE_HOLD',
  productionReady:false,writeAllowed:false,approvedMapping:false,
  realDistanceInputCommitted:false,legacyDistanceCommitAllowed:false,
  sessionStorageWritten:false,realDistanceResult:false,
  needsProductMappingApproval:true,
  distancePreview:{
   layerPoints:groupedPoints(stage),
   activityPolygons:originalActivityAreas.map(a=>clone(a.points)),
   activityAreaIds:originalActivityAreas.map(a=>a.id),
   currentPoiCount:stage.summary.currentPoiCount,
   designPolygon:polygon(reviewed.designPolygon,30,'X01_DESIGN_POLYGON_INVALID'),
   acquisitionPolygon:polygon(reviewed.acquisitionPolygon,30,'X01_ACQUISITION_POLYGON_INVALID'),
   recomputeDistanceRequired:true,dataOnlyNotRuntimeBinding:true
  },
  originalActivityAreas,
  reason:'X01_TYPED_DISTANCE_CHANNEL_NOT_APPROVED'
 };
 return lock(result);
}
