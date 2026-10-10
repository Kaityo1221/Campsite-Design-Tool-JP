import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {convertLegacyKasaiKmz} from '../core/legacy-kasai-convert.mjs';
import {auditLegacyShapeCompatibility} from '../core/legacy-shape-audit.mjs';

const deps={JSZip,DOMParser,XMLSerializer};
const NS='http://www.opengis.net/kml/2.2';
function ring(lat,lng,radius,reverse=false){
 const values=[],la=lat*Math.PI/180,lo=lng*Math.PI/180,d=radius/6378137;
 for(let i=0;i<=48;i++){
  const b=(reverse?-1:1)*2*Math.PI*i/48;
  const y=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(b));
  const x=lo+Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(y));
  values.push(`${(x*180/Math.PI).toFixed(7)},${(y*180/Math.PI).toFixed(7)},0`);
 }
 return values;
}
function document(circles){
 return `<?xml version="1.0" encoding="utf-8"?>
 <kml xmlns="${NS}"><Document><name>old circles</name>
 <Folder><name>既存 PokéStop</name><Placemark><name>known POI</name>
 <description>説明: POKESTOP&amp;lt;br&amp;gt;nextlab-layer: existing-pokestop</description>
 <ExtendedData><Data name="nextlab-layer"><value>existing-pokestop</value></Data></ExtendedData>
 <styleUrl>#creative-existing-pokestop</styleUrl>
 <Point><coordinates>139.8000000,35.7000000,0</coordinates></Point>
 </Placemark></Folder><Folder><name>50m サークル</name>
 ${circles.map((c,i)=>`<Placemark><name>50m ${i+1}</name>
 <Polygon><outerBoundaryIs><LinearRing><coordinates>${c.join(' ')}</coordinates></LinearRing></outerBoundaryIs></Polygon>
 </Placemark>`).join('')}
 </Folder></Document></kml>`;
}
async function staged(rings){
 const zip=new JSZip();zip.file('doc.kml',document(rings));
 return stageKmlInput(await zip.generateAsync({type:'uint8array'}),deps);
}
test('clockwise and counterclockwise legacy rings both verify as 48-segment circles',async()=>{
 for(const reverse of [false,true]){
  const stage=await staged([ring(35.7,139.8,50,reverse)]);
  assert.deepEqual(stage.errors,[]);
  const c=stage.places[1];
  assert.equal(c.legacyShapeVerified,true);
  assert.equal(c.legacyShape,'distance-circle');
  assert.equal(c.legacyCircle.radius,50);
  assert.equal(c.legacyCircle.winding,reverse?'counterclockwise':'clockwise');
  assert.equal(diagnoseKmzCandidate(stage).disposition,'HOLD');
  const audit=auditLegacyShapeCompatibility(stage);
  assert.equal(audit.summary.verifiedCircleGeometry,1);
  assert.equal(audit.summary.verifiedOwners,1);
  assert.equal(audit.canConvert,false); // Report-only, even for clean source
  const result=await convertLegacyKasaiKmz(stage,deps);
  assert.equal(result.verification.disposition,'READY');
  assert.equal(result.canApply,false); // User must still confirm in an isolated preview
 }
});
test('ownerless counterclockwise circle is verified geometry but converter still HOLDS',async()=>{
 const input=await staged([ring(35.7,139.8,50,true),ring(35.701,139.802,50,true)]);
 const report=auditLegacyShapeCompatibility(input);
 assert.equal(report.summary.circleCandidates,2);
 assert.equal(report.summary.verifiedCircleGeometry,2);
 assert.equal(report.summary.orphanVerifiedCircles,1);
 assert.equal(report.summary.verifiedOwners,1);
 assert.equal(report.canConvert,false);
 await assert.rejects(()=>convertLegacyKasaiKmz(input,deps),e=>e.code==='LEGACY_CIRCLE_AMBIGUOUS');
});
test('scrambled circle vertex order is not accepted after winding compatibility change',async()=>{
 const pts=ring(35.7,139.8,50,true);
 [pts[8],pts[28]]=[pts[28],pts[8]];
 const stage=await staged([pts]);
 assert.notEqual(stage.places[1].legacyShapeVerified,true);
 assert.equal(diagnoseKmzCandidate(stage).disposition,'HOLD');
 const audit=auditLegacyShapeCompatibility(stage);
 assert.equal(audit.summary.unverifiedCircleGeometry,1);
 assert.equal(audit.summary.verifiedCircleGeometry,0);
 await assert.rejects(()=>convertLegacyKasaiKmz(stage,deps),e=>e.code==='LEGACY_UNSAFE');
});
