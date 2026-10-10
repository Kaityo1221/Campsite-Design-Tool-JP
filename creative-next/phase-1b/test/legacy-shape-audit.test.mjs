import test from 'node:test';
import assert from 'node:assert/strict';
import {auditLegacyShapeCompatibility} from '../core/legacy-shape-audit.mjs';

const makeStage=places=>({
 audit:{zipValid:true,boundedExtraction:true,safePaths:true,safeXml:true,kmlCount:1,
 allObjectsCount:places.length,unknownInformationPreserved:true},
 errors:[],places
});
function poi(lat,lng){return {geometry:'Point',coordinates:`${lng},${lat},0`};}
function circle(lat,lng,radius,length=49,verified=true){
 const center={lat,lng};
 const p={geometry:'Polygon',folder:`${radius}m サークル`,name:`${radius}m 1`,
  polygonGeometry:{points:Array.from({length},()=>[lng,lat])}};
 if(verified){p.legacyShape='distance-circle';p.legacyShapeVerified=true;p.legacyCircle={radius,center};}
 return p;
}
const has=(report,code)=>report.issues.find(x=>x.code===code);
test('211 distinct POIs with both 40m and 50m owner circles are diagnostically valid, never authorized for conversion',()=>{
 const places=[];
 for(let i=0;i<211;i++)places.push(poi(35.6+i*.001,139.8));
 for(let i=0;i<211;i++)places.push(circle(35.6+i*.001,139.8,40));
 for(let i=0;i<211;i++)places.push(circle(35.6+i*.001,139.8,50));
 const stage=makeStage(places),before=JSON.stringify(stage),r=auditLegacyShapeCompatibility(stage);
 assert.equal(JSON.stringify(stage),before);
 assert.equal(r.status,'REPORT_ONLY');assert.equal(r.canConvert,false);
 assert.equal(r.summary.pois,211);assert.equal(r.summary.circleCandidates,422);
 assert.equal(r.summary.circleByRadius[40],211);assert.equal(r.summary.circleByRadius[50],211);
 assert.equal(r.summary.verifiedOwners,422);assert.equal(r.summary.duplicatedVerifiedOwnerRadius,0);
 assert.equal(r.summary.ambiguousVerifiedCircles,0);assert.equal(r.issues.length,0);
});
test('real Hikarigaoka-shaped 211 POIs, 422 x 50m and 211 x 40m explicitly HOLD 211 repeated owner/radius pairs',()=>{
 const places=[];
 for(let i=0;i<211;i++)places.push(poi(35.6+i*.001,139.8));
 for(let i=0;i<211;i++)places.push(circle(35.6+i*.001,139.8,50));
 for(let i=0;i<211;i++)places.push(circle(35.6+i*.001,139.8,50)); // exact duplicate ring copies
 for(let i=0;i<211;i++)places.push(circle(35.6+i*.001,139.8,40));
 places.push({geometry:'Polygon',legacyShape:'activity-area',legacyShapeVerified:true});
 const stage=makeStage(places),before=JSON.stringify(stage);
 const r=auditLegacyShapeCompatibility(stage);
 assert.equal(JSON.stringify(stage),before);
 assert.equal(stage.places.length,845);
 assert.equal(r.status,'REPORT_ONLY');
 assert.equal(r.canConvert,false);
 assert.equal(r.summary.pois,211);
 assert.equal(r.summary.circleCandidates,633);
 assert.equal(r.summary.circleByRadius[50],422);
 assert.equal(r.summary.circleByRadius[40],211);
 assert.equal(r.summary.activityAreas,1);
 assert.equal(r.summary.verifiedCircleGeometry,633);
 assert.equal(r.summary.verifiedOwners,633);
 assert.equal(r.summary.orphanVerifiedCircles,0);
 assert.equal(r.summary.ambiguousVerifiedCircles,0);
 assert.equal(r.summary.duplicatedVerifiedOwnerRadius,211);
 assert.equal(has(r,'CIRCLE_OWNER_RADIUS_DUPLICATE').count,211);
});
test('187+187 circles with 46 coordinates are reported as unverified and not assigned owners',()=>{
 const places=[];
 for(let i=0;i<188;i++)places.push(poi(35.6+i*.001,139.8));
 for(let i=0;i<187;i++)places.push(circle(35.6+i*.001,139.8,30,46,false));
 for(let i=0;i<187;i++)places.push(circle(35.6+i*.001,139.8,40,46,false));
 const stage=makeStage(places),before=JSON.stringify(stage),r=auditLegacyShapeCompatibility(stage);
 assert.equal(JSON.stringify(stage),before);
 assert.equal(r.summary.pois,188);assert.equal(r.summary.circleCandidates,374);
 assert.equal(r.summary.ringsByLength[46],374);
 assert.equal(r.summary.unverifiedCircleGeometry,374);
 assert.equal(r.summary.verifiedOwners,0);
 assert.equal(has(r,'CIRCLE_VERTEX_COUNT_HOLD').count,374);
 assert.equal(r.canConvert,false);
});
test('orphan, ambiguous and repeated verified circle owners are separate reasons',()=>{
 const r=auditLegacyShapeCompatibility(makeStage([
  poi(35.61,139.81),poi(35.61,139.81),
  circle(35.61,139.81,40),
  circle(35.7,139.9,40),
  circle(35.61,139.81,50),
  poi(35.8,139.8),circle(35.8,139.8,40),circle(35.8,139.8,40)
 ]));
 assert.equal(r.summary.ambiguousVerifiedCircles,2);
 assert.equal(r.summary.orphanVerifiedCircles,1);
 assert.equal(r.summary.duplicatedVerifiedOwnerRadius,1);
 assert.equal(has(r,'CIRCLE_OWNER_AMBIGUOUS').count,2);
 assert.equal(has(r,'CIRCLE_OWNER_NOT_FOUND').count,1);
 assert.equal(has(r,'CIRCLE_OWNER_RADIUS_DUPLICATE').count,1);
});
test('unverified extraction or XML inspection never produces a convertible report',()=>{
 const s=makeStage([poi(35.6,139.8)]);s.audit.safeXml=false;
 const r=auditLegacyShapeCompatibility(s);
 assert.equal(r.status,'UNINSPECTABLE');assert.equal(r.canConvert,false);
 assert.equal(has(r,'SOURCE_NOT_AUDITED').count,1);
});
test('unknown polygon is surfaced and never dropped',()=>{
 const r=auditLegacyShapeCompatibility(makeStage([poi(35.6,139.8),{geometry:'Polygon',folder:'non-circle',name:'unknown'}]));
 assert.equal(r.summary.otherPolygons,1);
 assert.equal(has(r,'UNKNOWN_POLYGON').count,1);
});
