/*
 * X-01/X-04 isolated READ-ONLY contract preflight.
 * This is not a handoff adapter, a conversion implementation, or a release gate PASS.
 * Never write to Project, KMZ, Session, journal or production storage here.
 */
import {validateActivityPoints} from '../phase-1b/core/activity-areas.mjs';

const isObject=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
const pointArray=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;
const issue=(code,path)=>Object.freeze({code,path});

function checkPolygon(points,{min,max},issues,path){
 if(!Array.isArray(points)||points.length<min||points.length>max){
  issues.push(issue('VERTEX_COUNT',path));return false;
 }
 if(!points.every(pointArray)){issues.push(issue('INVALID_COORDINATE',path));return false;}
 try{validateActivityPoints(points);return true;}catch(e){issues.push(issue(e?.code||'INVALID_POLYGON',path));return false;}
}
function auditAreas(areas,issues){
 if(!Array.isArray(areas)){issues.push(issue('ACTIVITY_AREAS_REQUIRED','activityAreas'));return false;}
 let good=true;
 if(areas.length>64){issues.push(issue('ACTIVITY_AREA_COUNT','activityAreas'));good=false;}
 const seen=new Set();
 areas.forEach((area,index)=>{
  const path='activityAreas['+index+']';
  if(!isObject(area)||!text(area.id)||seen.has(area.id)){
   issues.push(issue('ACTIVITY_AREA_ID',path));good=false;
  } else seen.add(area.id);
  if(!checkPolygon(area?.points,{min:3,max:512},issues,path+'.points'))good=false;
 });
 return good;
}
function auditObservation(observation,issues){
 if(observation===undefined)return {present:false,complete:false,valid:true}; // Old v1.0 Projects remain valid.
 if(!isObject(observation)){issues.push(issue('OBSERVATION_INVALID','wayfarerObservation'));return {present:true,complete:false,valid:false};}
 let good=true;const required=['interior','reference100','reserve200'];
 if(!text(observation.snapshotId)||!text(observation.observedAt)){
  issues.push(issue('OBSERVATION_ID_OR_TIME','wayfarerObservation'));good=false;
 }
 if(!checkPolygon(observation.polygon,{min:3,max:30},issues,'wayfarerObservation.polygon'))good=false;
 const seen=new Set();
 for(const zone of required){
  const pois=observation.zones?.[zone];
  if(!Array.isArray(pois)){issues.push(issue('OBSERVATION_ZONE_REQUIRED','wayfarerObservation.zones.'+zone));good=false;continue;}
  for(const [index,p] of pois.entries()){
   const path='wayfarerObservation.zones.'+zone+'['+index+']';
   const identity=String(p?.guid||p?.poiId||'').trim();
   if(!identity||seen.has(identity)){issues.push(issue('OBSERVATION_ID_MISSING_OR_DUPLICATE',path));good=false;}
   else seen.add(identity);
   if(!p||!Number.isFinite(Number(p.lat??p.latitude))||!Number.isFinite(Number(p.lng??p.longitude))){
    issues.push(issue('OBSERVATION_COORDINATE',path));good=false;
   }
   const kind=String(p?.poiKind||'').toUpperCase();
   const status=String(p?.gameStatus||'').toUpperCase();
   const entity=String(p?.gameEntity||'').toUpperCase();
   const ref=String(p?.referenceKind||'').toUpperCase();
   const supported=(status==='ACTIVE'&&['POKESTOP','GYM','POWERSPOT'].includes(kind))||
    (status==='INACTIVE'&&entity==='POWERSPOT'&&ref==='INACTIVE_POWERSPOT');
   if(!supported){issues.push(issue('OBSERVATION_GAME_STATE',path));good=false;}
  }
 }
 const complete=observation.acquisition?.coverageComplete===true;
 if(!complete){issues.push(issue('COVERAGE_NOT_PROVEN','wayfarerObservation.acquisition.coverageComplete'));good=false;}
 return {present:true,complete,valid:good};
}
function auditStage(stage,issues){
 if(!stage){issues.push(issue('KMZ_STAGE_MISSING','kmzStage'));return false;}
 if(!Array.isArray(stage.errors)||stage.errors.length){
  issues.push(issue('KMZ_STAGE_ERRORS','kmzStage.errors'));return false;
 }
 const data=Array.isArray(stage.documentData)?stage.documentData:[];
 const values=k=>data.filter(d=>d?.name==='campsite.creative.'+k).map(d=>d.value);
 if(values('format').length!==1||values('format')[0]!=='creative-mode-next'||
    values('version').length!==1||values('version')[0]!=='1'){
  issues.push(issue('KMZ_NOT_NEW_V1','kmzStage.documentData'));return false;
 }
 // NEW_V1 stores POI, distance circles and activity areas. It has no
 // reviewed primary-project / Wayfarer-observation envelope.
 issues.push(issue('PROJECT_ENVELOPE_NOT_DEFINED','kmzStage.documentData'));
 return true;
}
export function auditX01X04({project,activityAreas=[],kmzStage=null}={}){
 const issues=[];
 let primaryValid=false;
 if(!isObject(project))issues.push(issue('PROJECT_REQUIRED','project'));
 else{
  if(project.schemaVersion!=='1.0'||project.source!=='bridge'||!text(project.projectId)||
     project.meta?.projectContract!=='campsiteProject.v1'||!text(project.meta?.bridgeHandoffId))
   issues.push(issue('PROJECT_IDENTITY_OR_SCHEMA','project'));
  primaryValid=checkPolygon(project.polygon,{min:3,max:30},issues,'project.polygon');
 }
 const areasValid=auditAreas(activityAreas,issues);
 const observed=auditObservation(project?.wayfarerObservation,issues);
 const kmzValid=auditStage(kmzStage,issues);
 const structureValid=primaryValid&&areasValid&&observed.valid&&
    !!project&&project.schemaVersion==='1.0'&&project.source==='bridge'&&
    text(project.projectId)&&project.meta?.projectContract==='campsiteProject.v1'&&
    text(project.meta?.bridgeHandoffId);
 return Object.freeze({
  status:'HOLD', // No approved, lossless Project<->NEW_V1 mapping exists.
  readOnly:true,
  structureValid,
  primaryPolygonValid:primaryValid,
  activityAreasValid:areasValid,
  observationPresent:observed.present,
  observationComplete:observed.complete,
  newV1Recognized:kmzValid,
  issues:Object.freeze(issues)
 });
}
