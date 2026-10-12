/*
 * X-01 LAB: explicitly typed geometry save planner for a Project + activity-area
 * pair. No I/O, storage, UI side effects, mutation or production approval.
 * Never select a primary polygon by array index, size or geometric coincidence.
 */
import {validateActivityPoints} from '../phase-1b/core/activity-areas.mjs';

function hold(code){const e=new Error(code);e.code=code;throw e;}
const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
 (Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null);
const id=v=>typeof v==='string'&&v.trim().length>0&&v.length<=128;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const clonePoints=p=>p.map(([lat,lng])=>[lat,lng]);

function safeClone(value){
 const seen=new Set();let nodes=0;
 function check(v,depth){
  if(++nodes>160000||depth>64)hold('X01_COMPLEXITY');
  if(v===null||typeof v==='string'||typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v)))return;
  if(typeof v!=='object'||(!plain(v)&&!Array.isArray(v)))hold('X01_NON_JSON_VALUE');
  if(seen.has(v))hold('X01_CIRCULAR_REFERENCE');
  seen.add(v);
  if(Array.isArray(v)){
   for(let i=0;i<v.length;i++){
    if(!own(v,i))hold('X01_SPARSE_ARRAY');
    check(v[i],depth+1);
   }
  }else{
   for(const [key,entry] of Object.entries(v)){
    if(key==='__proto__'||key==='prototype'||key==='constructor')hold('X01_UNSAFE_FIELD');
    check(entry,depth+1);
   }
  }
  seen.delete(v);
 }
 check(value,0);
 const json=JSON.stringify(value);
 if(new TextEncoder().encode(json).length>4*1024*1024)hold('X01_PROJECT_TOO_LARGE');
 return JSON.parse(json);
}
function validateShapePoints(points,max,code){
 if(!Array.isArray(points)||points.length<3||points.length>max)hold(code+'_VERTEX_COUNT');
 try{return validateActivityPoints(points)}
 catch(e){hold(code+'_'+(e?.code||'INVALID_GEOMETRY'));}
}
function rejectUnknownKeys(obj,allowed,code){
 if(!plain(obj)||Object.keys(obj).some(k=>!allowed.includes(k)))hold(code);
}
function validateIdentity(project,expectedProjectId,expectedHandoffId){
 if(!plain(project)||project.schemaVersion!=='1.0'||project.source!=='bridge'||
  project.meta?.projectContract!=='campsiteProject.v1'||
  !id(expectedProjectId)||!id(expectedHandoffId)||
  project.projectId!==expectedProjectId||project.meta?.bridgeHandoffId!==expectedHandoffId)
  hold('X01_PROJECT_HANDOFF_MISMATCH');
}
/**
 * Geometry objects are intentionally not the existing untyped Creative `polygons`:
 * {kind:'project-design-polygon',projectId,handoffId,basePolygon,points,deleted:false}
 * {kind:'activity-area',id,points,deleted:false}
 *
 * The caller must explicitly identify one primary polygon, and provide the
 * original snapshot's base polygon. Any unknown/legacy shape -> HOLD.
 *
 * Output is an IN-MEMORY pair; activity areas are NOT written into Project.
 * A later approved persistence adapter must atomically bind the two artifacts.
 */
export function planDesignPolygonSaveLab({project,expectedProjectId,expectedHandoffId,
 expectedBasePolygon,geometryObjects,evaluateCoverage}={}){
 validateIdentity(project,expectedProjectId,expectedHandoffId);
 if(!Array.isArray(geometryObjects))hold('X01_SHAPES_REQUIRED');
 const base=validateShapePoints(project.polygon,30,'X01_DESIGN');
 const snapshot=validateShapePoints(expectedBasePolygon,30,'X01_EXPECTED_DESIGN');
 if(!same(base,snapshot))hold('X01_STALE_BASE_POLYGON');
 const primary=[];
 const areas=[];
 const seenAreaIds=new Set();
 for(const shape of geometryObjects){
  if(!plain(shape))hold('X01_UNTYPED_OR_UNKNOWN_SHAPE');
  if(shape.kind==='project-design-polygon'){
   rejectUnknownKeys(shape,['kind','projectId','handoffId','basePolygon','points','deleted'],'X01_PRIMARY_SHAPE_FIELDS');
   if(shape.deleted===true)hold('X01_PRIMARY_DELETION_FORBIDDEN');
   if(shape.deleted!==false||shape.projectId!==expectedProjectId||shape.handoffId!==expectedHandoffId)
    hold('X01_PRIMARY_OWNER_MISMATCH');
   if(!same(validateShapePoints(shape.basePolygon,30,'X01_PRIMARY_BASE'),snapshot))
    hold('X01_PRIMARY_SOURCE_MISMATCH');
   primary.push(validateShapePoints(shape.points,30,'X01_PRIMARY'));
  }else if(shape.kind==='activity-area'){
   rejectUnknownKeys(shape,['kind','id','points','deleted'],'X01_AREA_FIELDS');
   if(!id(shape.id)||seenAreaIds.has(shape.id))hold('X01_AREA_ID');
   seenAreaIds.add(shape.id);
   // No approved tombstone/area lineage mapping yet; deletion cannot vanish.
   if(shape.deleted===true)hold('X01_AREA_DELETION_UNSUPPORTED');
   if(shape.deleted!==false)hold('X01_AREA_STATE');
   areas.push({id:shape.id,points:validateShapePoints(shape.points,512,'X01_AREA')});
  }else hold('X01_UNTYPED_OR_UNKNOWN_SHAPE');
 }
 if(primary.length!==1)hold('X01_EXACTLY_ONE_PRIMARY_REQUIRED');
 if(areas.length>64)hold('X01_TOO_MANY_AREAS');
 const nextPolygon=primary[0];
 const primaryChanged=!same(base,nextPolygon);
 let coverageStatus='UNCHANGED',coveredByReserve=null;
 if(primaryChanged){
  if(!project.wayfarerObservation||typeof evaluateCoverage!=='function')
   hold('X01_COVERAGE_EVALUATOR_REQUIRED');
  if(project.wayfarerObservation.acquisition?.coverageComplete!==true)
   hold('X01_ACQUISITION_INCOMPLETE');
  const coverage=evaluateCoverage(project.wayfarerObservation,nextPolygon);
  if(!coverage||coverage.covered!==true)hold('X01_REACQUISITION_REQUIRED');
  coverageStatus='LOCALLY_COVERED';
  coveredByReserve=true;
 }
 const projectClone=safeClone(project);
 projectClone.polygon=clonePoints(nextPolygon);
 // Historical observation geometry, currentPois/edits/unknown metadata are
 // untouched. In particular, never store activity areas as project.polygon.
 return Object.freeze({
  status:'LAB_GEOMETRY_PLAN_READY',productionReady:false,project:projectClone,
  activityAreas:areas.map(a=>({id:a.id,points:clonePoints(a.points)})),
  primaryChanged,coverageStatus,coveredByReserve,
  projectId:expectedProjectId,handoffId:expectedHandoffId
 });
}
