/* Optional opt-in private fixture test. Never committed with a fixture. */
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
import {convertLegacyKasaiKmz} from '../core/legacy-kasai-convert.mjs';
import {exportNewV1Kmz} from '../core/export-kmz.mjs';
const args=process.argv.slice(2);if(!args[0])throw Error('Usage: node test/verify-real-kasai.mjs <private-file.kmz> [aggregate-report.json]');
const sourcePath=args[0],input=readFileSync(sourcePath),deps={JSZip,DOMParser,XMLSerializer};
const sha=arr=>createHash('sha256').update(arr).digest('hex');
const sourceFingerprint=sha(input);
const original=await stageKmlInput(input,deps),prior=diagnoseKmzCandidate(original);
assert.deepEqual(original.errors,[]);assert.equal(prior.disposition,'HOLD');assert.equal(prior.profile,'LEGACY_CREATIVE_KASAI_CANDIDATE');
assert.deepEqual(prior.counts,{existing:188,newTotal:25,newByKind:{pokestop:12,gym:8,power:5},circles:213,activityAreas:1,unknown:0});
const result=await convertLegacyKasaiKmz(original,deps);
const converted=await stageKmlInput(result.bytes,deps);assert.equal(result.verification.disposition,'READY');assert.equal(result.canApply,false);
assert.equal(converted.places.length,427);
const get=(p,k)=>p.data.filter(d=>d.name==='campsite.creative.'+k).map(d=>d.value);
let sourcePois=0,newPois=0,shapes=0,originalText=0,memoBlank=0,coordinatesUnchanged=0,distinct=0,circleOwners=0;
const ids=new Set(),sourceById=new Map(),owners=new Set();
for(let i=0;i<original.places.length;i++){
 const a=original.places[i],b=converted.places[i];assert.equal(a.name,b.name);
 assert.equal(a.geometry,b.geometry);assert.deepEqual(a.folderPath,b.folderPath);
 assert.deepEqual(a.styleUrl,b.styleUrl);
 if(a.geometry==='Point'){
  sourcePois++;assert.equal(a.coordinates,b.coordinates);coordinatesUnchanged++;
  const id=get(b,'id')[0];assert.equal(ids.has(id),false);ids.add(id);
  assert.equal(get(b,'title')[0],a.name);
  if(a.description){originalText++;assert.equal(get(b,'legacy-description')[0],a.description);assert.equal(get(b,'memo')[0],'');memoBlank++;}
  const originalLayer=a.data.filter(d=>d.name==='nextlab-layer').map(d=>d.value);
  assert.deepEqual(b.data.filter(d=>d.name==='nextlab-layer').map(d=>d.value),originalLayer);
  sourceById.set(id,a);
 } else if(a.geometry==='Polygon'){
  shapes++;assert.equal(a.polygonGeometry.raw,b.polygonGeometry.raw);
  if(a.legacyShape==='distance-circle'){
   assert.equal(b.circleValid,true);
   assert.equal(get(b,'circle-radius')[0],'50');
   const id=get(b,'circle-owner-id')[0];assert.ok(ids.has(id));assert.equal(owners.has(id),false);owners.add(id);circleOwners++;
  }else{assert.equal(get(b,'object')[0],'activity-area')}
 }
}
assert.equal(sourcePois,213);assert.equal(coordinatesUnchanged,213);assert.equal(ids.size,213);assert.equal(originalText,213);assert.equal(memoBlank,213);assert.equal(shapes,214);assert.equal(circleOwners,213);assert.equal(owners.size,213);
const originalZip=await JSZip.loadAsync(input),convertedZip=await JSZip.loadAsync(result.bytes);
const oldPaths=Object.keys(originalZip.files).filter(p=>!originalZip.files[p].dir).sort();const newPaths=Object.keys(convertedZip.files).filter(p=>!convertedZip.files[p].dir).sort();assert.deepEqual(oldPaths,newPaths);
for(const p of oldPaths.filter(x=>!x.endsWith('.kml'))){assert.deepEqual(await originalZip.file(p).async('uint8array'),await convertedZip.file(p).async('uint8array'))}
const again=await exportNewV1Kmz(converted,deps),after=await stageKmlInput(again.bytes,deps);
assert.equal(again.verification.disposition,'READY');assert.equal(after.places.length,427);
for(let i=0;i<427;i++){
 const a=converted.places[i],b=after.places[i];
 assert.equal(a.geometry,b.geometry);assert.equal(a.name,b.name);
 if(a.geometry==='Point'){assert.equal(a.coordinates,b.coordinates);assert.deepEqual(get(a,'id'),get(b,'id'));assert.deepEqual(get(a,'memo'),get(b,'memo'));assert.deepEqual(get(a,'legacy-description'),get(b,'legacy-description'))}
 else assert.equal(a.polygonGeometry.raw,b.polygonGeometry.raw);
}
assert.equal(sha(input),sourceFingerprint);
const report={sourceSha256:sourceFingerprint,sourceSize:input.length,convertedBytes:result.bytes.length,roundtripBytes:again.bytes.length,
 profileBefore:prior.profile,dispositionBefore:prior.disposition,after:result.verification.disposition,canApply:false,
 sourceCounts:prior.counts,convertedCounts:result.verification.counts,pointNamesPreserved:sourcePois,coordinatesExactlyPreserved:coordinatesUnchanged,
 descriptionRawPreserved:originalText,generatedMemoBlanked:memoBlank,uniqueStablePoiIds:ids.size,circleOwnerMatches:circleOwners,
 polygonsRawUnchanged:shapes,attachedResourcesByteIdentical:oldPaths.filter(p=>!p.endsWith('.kml')).length,fullReexportVerified:true,
 privateFixtureNotAddedToPublicRepo:true,liveEditorImport:false};
if(args[1])writeFileSync(args[1],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
