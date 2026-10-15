/*
 * Staged Creative Next -> real Campsite Distance compatibility, READ ONLY LAB.
 * Not an approved runtime adapter: never set _layerPoints, _activityPolygons,
 * campsiteProject.v1, currentPois, JS journals, or invoke runDistanceCheck.
 */
import {inspectCampsiteReturnLab} from './campsite-return-receiver-lab.mjs';

const FORMAL=Object.freeze({
 existing:Object.freeze({POKESTOP:'既存 PokéStop',GYM:'既存 Gym',POWERSPOT:'既存 PowerSpot'}),
 added:Object.freeze({POKESTOP:'新規 PokéStop',GYM:'新規 Gym',POWERSPOT:'新規 PowerSpot'})
});
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const clone=x=>JSON.parse(JSON.stringify(x));
const validId=s=>typeof s==='string'&&s.trim().length>0&&s.length<=128;

export function stageCurrentPoisLab(project){
 // Existing bridge-distance-project.js falls back to selectedPois for an empty
 // currentPois. That resurrects deleted POIs. Never do this in the return path.
 if(!Array.isArray(project.currentPois))fail('DISTANCE_CURRENT_POIS_REQUIRED');
 if(project.currentPois.length===0&&project.selectedPois?.length>0)
  fail('DISTANCE_LEGACY_SELECTION_FALLBACK_HOLD');
 const groups={},identities=new Set();
 for(const poi of project.currentPois){
  if(!poi||!['existing','added'].includes(poi.role))fail('DISTANCE_ROLE_HOLD');
  const entity=String(poi.gameEntity||'').toUpperCase();
  if(!Object.hasOwn(FORMAL[poi.role],entity))fail('DISTANCE_ENTITY_HOLD');
  const guid=poi.role==='existing'?String(poi.guid||poi.poiId||'').trim():'';
  const id=poi.role==='added'?String(poi.id||'').trim():guid;
  if(!validId(id))fail('DISTANCE_POI_ID_REQUIRED');
  const identity=poi.role+':'+id;
  if(identities.has(identity))fail('DISTANCE_POI_DUPLICATE');
  identities.add(identity);
  if(typeof poi.lat!=='number'||typeof poi.lng!=='number'||
    !Number.isFinite(poi.lat)||!Number.isFinite(poi.lng)||
    Math.abs(poi.lat)>90||Math.abs(poi.lng)>180)fail('DISTANCE_COORD_HOLD');
  if(typeof poi.title!=='string'||!poi.title.trim())fail('DISTANCE_TITLE_HOLD');
  // Retain authoritative Project; this view is only a downstream preview.
  const point={
   id:String(poi.id||poi.guid||''),guid:String(poi.guid||''),
   name:poi.title,title:poi.title,lat:poi.lat,lng:poi.lng,
   gameEntity:entity,role:poi.role,
   description:String(poi.description||poi.memo||''),
   applicationComment:Object.hasOwn(poi,'applicationComment')
    ?String(poi.applicationComment||''):String(poi.description||poi.memo||''),
   gameStatus:String(poi.gameStatus||'UNKNOWN'),
   sponsored:poi.sponsored===true,
   smr:poi.smr===true?true:poi.smr===false?false:null,
   provenance:Array.isArray(poi.provenance)?clone(poi.provenance):[]
  };
  const layer=FORMAL[poi.role][entity];
  (groups[layer]||=[]).push(point);
 }
 return groups;
}
export async function inspectCampsiteDistanceReturnStageLab({
 project,activityAreas,kmzBytes,expectedProjectId,expectedHandoffId,
 JSZip,DOMParser,cryptoProvider=globalThis.crypto
}={}){
 const pair=await inspectCampsiteReturnLab({
  project,activityAreas,kmzBytes,expectedProjectId,expectedHandoffId,
  JSZip,DOMParser,cryptoProvider
 });
 const p=pair.project,groups=stageCurrentPoisLab(p);
 const poiCount=Object.values(groups).reduce((n,g)=>n+g.length,0);
 // The old distance runtime treats project.polygon as _activityPolygons.
 // An independent Creative area must never be silently replaced/ignored.
 const distinctActivityAreas=pair.activityAreas.length>0;
 const distanceInput=Object.freeze({
  groups:clone(groups),designPolygon:clone(p.polygon),
  acquisitionPolygon:clone(p.wayfarerObservation.polygon),
  activityAreas:clone(pair.activityAreas),
  // The legacy Distance UI currently sets _activityPolygons=[project.polygon].
  // No change to that legacy global or source is permitted by this preflight.
  legacyActivityPolygonMapping:'UNAPPROVED',
  sourceOfTruth:'campsiteProject.v1',
  recomputeDistanceRequired:true
 });
 return Object.freeze({
  status:'LAB_DISTANCE_INPUT_STAGED_READ_ONLY',productionReady:false,
  writeAllowed:false,legacyDistanceCommitAllowed:false,
  legacyActivityAreaConflict:distinctActivityAreas,
  reason:distinctActivityAreas?'DISTANCE_X01_ACTIVITY_AREA_MAPPING_HOLD':
   'DISTANCE_LIVE_IMPORT_NOT_APPROVED',
  summary:Object.freeze({
   projectId:p.projectId,handoffId:p.meta.bridgeHandoffId,
   currentPoiCount:poiCount,addedPoiCount:p.addedPois.length,
   designPolygonVertices:p.polygon.length,
   acquisitionPolygonVertices:p.wayfarerObservation.polygon.length,
   independentActivityAreaCount:pair.activityAreas.length,
   distanceResultMustBeRechecked:true
  }),
  distanceInput
 });
}
