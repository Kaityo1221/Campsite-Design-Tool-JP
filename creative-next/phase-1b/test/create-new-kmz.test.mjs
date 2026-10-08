import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../core/create-new-kmz.mjs';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {diagnoseKmzCandidate} from '../core/diagnose-kmz-candidate.mjs';
const opts={JSZip,DOMParser,XMLSerializer};
const item=(id,role='existing',extra={})=>({id,role,kind:'pokestop',title:'名称 '+id,lat:35.75,lng:139.9,memo:'🐑 & 代表',...extra});
const area={id:'boundary',points:[[35.5,139.5],[35.6,139.5],[35.6,139.6],[35.5,139.5]]};
const data=(records,activityAreas=[])=>({records,activityAreas});
const read=async bytes=>{const stage=await stageKmlInput(bytes,opts);return{stage,report:diagnoseKmzCandidate(stage)}};

test('fresh canonical records produce re-importable new-v1 KMZ',async()=>{
 const source=data([item('e'),item('n','new',{kind:'gym',guid:'bridge-id-1'})]);
 const out=await createFreshV1Kmz(source,opts),{stage,report}=await read(out.bytes);
 assert.equal(report.disposition,'READY');assert.equal(report.counts.existing,1);assert.equal(report.counts.newTotal,1);
 assert.equal(stage.places[1].description,'🐑 & 代表');
 assert.equal(stage.places[1].data.find(x=>x.name==='campsite.creative.guid').value,'bridge-id-1');
});
test('deleted POIs are not exported but canonical list is never changed',async()=>{
 const source=data([item('e'),{...item('x','new'),deleted:true}]);
 const bytes=(await createFreshV1Kmz(source,opts)).bytes;
 assert.equal((await read(bytes)).stage.places.length,1);assert.equal(source.records.length,2);
});
test('activity-area polygon is roundtripped alongside POIs',async()=>{
 const out=await createFreshV1Kmz(data([item('e')],[area]),opts),{stage,report}=await read(out.bytes);
 assert.equal(report.counts.activityAreas,1);assert.equal(stage.places[1].geometry,'Polygon');
 assert.equal(stage.places[1].data.find(x=>x.name==='campsite.creative.area-id').value,'boundary');
});
test('separate IDs keep distinct same-named and same-coordinates POIs',async()=>{
 const source=data([item('one','existing',{title:'同一名称'}),item('two','existing',{title:'同一名称'})]);const done=await createFreshV1Kmz(source,opts);
 const {stage,report}=await read(done.bytes);assert.equal(stage.places.length,2);
 assert.equal(report.disposition,'READY');assert.equal(report.issues.some(x=>x.code==='POSITION_DUPLICATE'),true);
 assert.equal(report.issues.some(x=>x.code==='NAME_DUPLICATE'),true);
});
test('invalid input, missing ID, duplicate ID, and existing 701 are rejected',async()=>{
 for(const a of [data([item('a'),item('a')]),data([item('')]),data([item('b','existing',{lat:100})]),
 data(Array.from({length:701},(_,i)=>item('p'+i)))])
 await assert.rejects(()=>createFreshV1Kmz(a,opts),e=>e.code==='CREATE_KMZ_INVALID');
});
test('new count above 25 is preserved and signaled as a warning',async()=>{
 const out=await createFreshV1Kmz(data(Array.from({length:26},(_,i)=>item('n'+i,'new'))),opts);
 assert.equal(out.verification.counts.newTotal,26);assert.equal(out.verification.disposition,'READY');
 assert.equal(out.verification.issues.some(x=>x.code==='NEW_LIMIT_EXCEEDED'),true);
});
test('reject source-derived/unknown attributes rather than silently dropping them',async()=>{
 for(const r of [item('s','existing',{sourceGeometry:{coordinates:'139.900,35.7500'}}),
    item('s','existing',{metadata:{unknown:'重要'}})])
 await assert.rejects(()=>createFreshV1Kmz(data([r]),opts),e=>e.code==='CREATE_KMZ_INVALID');
});
test('reject empty project until a separately defined empty-output contract exists',async()=>{
 await assert.rejects(()=>createFreshV1Kmz(data([]),opts),e=>e.code==='CREATE_KMZ_INVALID');
});
test('abort stops fresh export',async()=>{
 const ac=new AbortController();ac.abort();
 await assert.rejects(()=>createFreshV1Kmz(data([item('e')]),{...opts,signal:ac.signal}),e=>e.code==='CREATE_KMZ_INVALID');
});