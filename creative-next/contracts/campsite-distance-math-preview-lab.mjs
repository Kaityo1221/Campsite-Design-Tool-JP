/*
 * READ-ONLY preview of CampSite Distance's 50m POI checks.
 * The distance formula/bands are pinned by regression against unchanged
 * js/distance-core.js + js/distance.js in a VM test, NOT a production fork.
 * Creative activity areas are distinct from project/Wayfarer polygons.
 * Existing external Wayfarer references are read-only diagnostic sources.
 * The visible score, submission verdict, upload and Project persistence are
 * NOT produced here and require approval of the real Distance handoff.
 */
const hold=code=>{const e=new Error(code);e.code=code;throw e;};
const clone=x=>JSON.parse(JSON.stringify(x));
const EARTH_RADIUS=6371000;
export function distanceMetersLab(a,b){
 const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180;
 const dLat=(b.lat-a.lat)*Math.PI/180,dLng=(b.lng-a.lng)*Math.PI/180;
 const q=Math.sin(dLat/2)**2+
  Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
 return EARTH_RADIUS*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
const band=d=>d<1?'duplicate':d<20?'dense':d<30?'stay':d<50?'reference-distance':null;
function canonicalPoints(stage){
 if(stage?.status!=='LAB_DISTANCE_INPUT_STAGED_READ_ONLY'||stage.productionReady!==false||
    stage.legacyDistanceCommitAllowed!==false||stage.writeAllowed!==false)
  hold('DISTANCE_STAGE_REQUIRED');
 const groups=stage.distanceInput?.groups;
 if(!groups||typeof groups!=='object'||Array.isArray(groups))hold('DISTANCE_GROUPS_INVALID');
 const points=[];
 for(const [layer,list] of Object.entries(groups)){
  if(!Array.isArray(list))hold('DISTANCE_GROUPS_INVALID');
  for(const p of list){
   if(typeof p.lat!=='number'||typeof p.lng!=='number'||
     !Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!p.id)
     hold('DISTANCE_PREVIEW_POI_INVALID');
   points.push({id:p.id,guid:p.guid||'',lat:p.lat,lng:p.lng,
    layer,role:p.role,gameEntity:p.gameEntity});
  }
 }
 return points;
}
export function previewDistanceCalculationLab(stage,{referencePois=[]}={}){
 const points=canonicalPoints(stage);
 const areas=stage.distanceInput.activityAreas;
 if(!Array.isArray(areas)||areas.length>64)hold('DISTANCE_AREA_LIST_INVALID');
 const seenAreas=new Set(),polygons=areas.map(a=>{
  if(typeof a?.id!=='string'||!a.id||seenAreas.has(a.id)||
     !Array.isArray(a.points)||a.points.length<3||a.points.length>512)
   hold('DISTANCE_AREA_INVALID');
  seenAreas.add(a.id);
  return a.points.map(p=>{
   if(!Array.isArray(p)||p.length!==2||p.some(x=>typeof x!=='number'||!Number.isFinite(x))||
      Math.abs(p[0])>90||Math.abs(p[1])>180)
    hold('DISTANCE_AREA_INVALID');
   return [...p];
  });
 });
 const warnings=[],externalReferenceWarnings=[];
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  const dist=distanceMetersLab(points[i],points[j]),kind=band(dist);
  if(kind)warnings.push({
   a:points[i].id,b:points[j].id,
   meters:dist,kind,
   bothExisting:points[i].role==='existing'&&points[j].role==='existing'
  });
 }
 // Only source-zoned references qualify. Do not invent GUID, status or zone.
 const refIDs=new Set(),refs=referencePois.map(r=>{
  const id=String(r?.guid||r?.poiId||'').trim();
  if(!id||refIDs.has(id)||typeof r.lat!=='number'||typeof r.lng!=='number'||
     !Number.isFinite(r.lat)||!Number.isFinite(r.lng))hold('DISTANCE_REFERENCE_INVALID');
  refIDs.add(id);return {id,lat:r.lat,lng:r.lng,role:'reference'};
 });
 for(const p of points)for(const r of refs){
  if(p.guid&&p.guid===r.id)hold('DISTANCE_REFERENCE_EDITABLE_LEAK');
  const dist=distanceMetersLab(p,r),kind=band(dist);
  if(kind)externalReferenceWarnings.push({a:p.id,b:r.id,meters:dist,kind,
   referenceReadOnly:true});
 }
 warnings.sort((a,b)=>a.meters-b.meters);
 externalReferenceWarnings.sort((a,b)=>a.meters-b.meters);
 return Object.freeze({
  status:'LAB_DISTANCE_MATH_PREVIEW',productionReady:false,writeAllowed:false,
  realDistanceResult:false,realDistanceScore:false,
  warnings:clone(warnings),externalReferenceWarnings:clone(externalReferenceWarnings),
  mapPreview:Object.freeze({
   activityPolygons:clone(polygons),activityAreaIds:areas.map(a=>a.id),
   designPolygon:clone(stage.distanceInput.designPolygon),
   acquisitionPolygon:clone(stage.distanceInput.acquisitionPolygon),
   currentPoiCount:points.length,referenceCount:refs.length
  }),
  summary:Object.freeze({
   checkedPoiPairs:points.length*(points.length-1)/2,
   under50: warnings.length,
   duplicate: warnings.filter(w=>w.kind==='duplicate').length,
   dense: warnings.filter(w=>w.meters<20).length,
   stay: warnings.filter(w=>w.meters>=20&&w.meters<30).length,
   light: warnings.filter(w=>w.meters>=30&&w.meters<50).length,
   externalReferenceUnder50:externalReferenceWarnings.length,
   independentActivityAreas:polygons.length,
   realCampsiteDistanceNotYetRun:true
  })
 });
}
