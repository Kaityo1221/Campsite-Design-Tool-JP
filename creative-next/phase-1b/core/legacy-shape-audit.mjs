/*
 * Creative Next: READ-ONLY compatibility report for already-staged legacy KMZ.
 * This module NEVER changes the importer eligibility, never infers ownership
 * from approximate centers, and never writes back to source or browser storage.
 * Report-only diagnostics MUST NOT be used as an import/convert authorization.
 */
const RADII=[30,40,50];
const METERS_PER_DEGREE=111320;
const LIMIT=20;
const asNumber=x=>typeof x==='number'?x:Number(x);
function pointCoordinates(p){
 if(p?.geometry!=='Point'||typeof p.coordinates!=='string')return null;
 const parts=p.coordinates.trim().split(',');
 if(parts.length<2||parts.length>3)return null;
 const lng=asNumber(parts[0]),lat=asNumber(parts[1]);
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
 return {lat,lng};
}
function dist(a,b){
 return Math.hypot((a.lng-b.lng)*METERS_PER_DEGREE*Math.cos(a.lat*Math.PI/180),
                   (a.lat-b.lat)*METERS_PER_DEGREE);
}
function circleRadius(p){
 if(p?.geometry!=='Polygon')return null;
 const m=/^([345]0)m サークル$/.exec(p.folder||'');
 if(!m)return null;
 const radius=Number(m[1]);
 if(!(new RegExp('^'+radius+'m\\s+\\d+$')).test(p.name||''))return null;
 return radius;
}
function safeAudit(stage){
 const audit=stage?.audit;
 return !!(Array.isArray(stage?.places)&&audit?.zipValid===true&&audit?.safeXml===true&&
  audit?.boundedExtraction===true&&audit?.safePaths===true&&
  audit?.unknownInformationPreserved===true&&audit?.allObjectsCount===stage.places.length&&
  audit?.kmlCount===1&&!stage.errors?.length);
}
export function auditLegacyShapeCompatibility(stage){
 const safe=safeAudit(stage);
 if(!safe)return Object.freeze({status:'UNINSPECTABLE',canConvert:false,issues:[{code:'SOURCE_NOT_AUDITED',count:1,samples:[]} ]});
 const places=stage.places;
 const summary={
  placemarks:places.length,pois:0,invalidPoiPositions:0,
  circleCandidates:0,verifiedCircleGeometry:0,unverifiedCircleGeometry:0,
  activityAreas:0,otherPolygons:0,otherObjects:0,
  circleByRadius:{30:0,40:0,50:0},
  ringsByLength:{},
  verifiedOwners:0,orphanVerifiedCircles:0,ambiguousVerifiedCircles:0,
  duplicatedVerifiedOwnerRadius:0
 };
 const examples=new Map();
 const record=(code,index)=>{
  let item=examples.get(code);
  if(!item){item={code,count:0,samples:[]};examples.set(code,item);}
  item.count++;
  if(item.samples.length<LIMIT)item.samples.push(index);
 };
 const pois=[];
 const circles=[];
 for(let i=0;i<places.length;i++){
  const p=places[i];
  if(p.geometry==='Point'){
   summary.pois++;
   const coordinate=pointCoordinates(p);
   if(coordinate)pois.push(coordinate);
   else{summary.invalidPoiPositions++;record('INVALID_POI_POSITION',i);}
   continue;
  }
  if(p.geometry!=='Polygon'){summary.otherObjects++;record('UNKNOWN_OBJECT',i);continue;}
  const radius=circleRadius(p);
  if(radius!==null){
   summary.circleCandidates++;summary.circleByRadius[radius]++;
   const length=Array.isArray(p.polygonGeometry?.points)?p.polygonGeometry.points.length:0;
   summary.ringsByLength[length]=(summary.ringsByLength[length]||0)+1;
   if(p.legacyShapeVerified===true&&p.legacyShape==='distance-circle'&&
      p.legacyCircle?.radius===radius&&Number.isFinite(p.legacyCircle?.center?.lat)&&
      Number.isFinite(p.legacyCircle?.center?.lng)){
     summary.verifiedCircleGeometry++;
     circles.push({index:i,radius,center:p.legacyCircle.center});
   }else{
     summary.unverifiedCircleGeometry++;
     record(length!==49?'CIRCLE_VERTEX_COUNT_HOLD':'CIRCLE_GEOMETRY_HOLD',i);
   }
  }else if(p.legacyShapeVerified===true&&p.legacyShape==='activity-area'){
   summary.activityAreas++;
  }else{
   summary.otherPolygons++;record('UNKNOWN_POLYGON',i);
  }
 }
 const owned=new Set();
 for(const c of circles){
  const matches=pois.map((poi,index)=>({index,d:dist(c.center,poi)})).filter(x=>x.d<0.2);
  if(matches.length===0){summary.orphanVerifiedCircles++;record('CIRCLE_OWNER_NOT_FOUND',c.index);}
  else if(matches.length!==1){summary.ambiguousVerifiedCircles++;record('CIRCLE_OWNER_AMBIGUOUS',c.index);}
  else{
   summary.verifiedOwners++;
   const key=matches[0].index+'/'+c.radius;
   if(owned.has(key)){summary.duplicatedVerifiedOwnerRadius++;record('CIRCLE_OWNER_RADIUS_DUPLICATE',c.index);}
   owned.add(key);
  }
 }
 // Even with no reported issues this audit NEVER authorizes conversion.
 const issues=[...examples.values()];
 return Object.freeze({status:'REPORT_ONLY',canConvert:false,summary,issues});
}
