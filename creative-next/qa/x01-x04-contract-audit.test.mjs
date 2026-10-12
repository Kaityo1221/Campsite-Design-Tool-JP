import test from 'node:test';
import assert from 'node:assert/strict';
import {auditX01X04} from '../contracts/audit-x01-x04.mjs';

const polygon=n=>Array.from({length:n},(_,i)=>[
 35+0.002*Math.sin(2*Math.PI*i/n),
 139+0.002*Math.cos(2*Math.PI*i/n)
]);
const item=(guid,lat=35,lng=139)=>({guid,lat,lng,poiKind:'POKESTOP',gameStatus:'ACTIVE',gameEntity:'POKESTOP'});
const area=(id,n=3)=>({id,points:polygon(n)});
const project=()=>({
 schemaVersion:'1.0',source:'bridge',projectId:'synthetic-project',
 meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:synthetic'},
 polygon:polygon(3),currentPois:[{guid:'source-poi',lat:35,lng:139}],
 wayfarerObservation:{
  version:'0.1.0',snapshotId:'wm3:synthetic',observedAt:'2026-10-12T01:00:00Z',
  polygon:polygon(3),acquisition:{coverageComplete:true,bufferMeters:200},
  zones:{interior:[item('inside')],reference100:[item('outer',35.01)],reserve200:[{guid:'backup',lat:35.012,lng:139,poiKind:'POWERSPOT',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]}
 }
});
const stage=()=>({errors:[],documentData:[{name:'campsite.creative.format',value:'creative-mode-next'},{name:'campsite.creative.version',value:'1'}],places:[]});
const inspect=(p=project(),areas=[area('area-a')],k=stage())=>auditX01X04({project:p,activityAreas:areas,kmzStage:k});
const codes=r=>r.issues.map(x=>x.code);

test('X-01: project polygon 3-30 and activity areas 3-512 remain separate',()=>{
 const p=project(),a=[area('area-1',31)];
 const original=JSON.stringify({p,a});
 const r=inspect(p,a);
 assert.equal(r.readOnly,true);assert.equal(r.structureValid,true);assert.equal(r.status,'HOLD');
 assert.equal(r.primaryPolygonValid,true);assert.equal(r.activityAreasValid,true);
 assert.deepEqual(codes(r),['PROJECT_ENVELOPE_NOT_DEFINED']);
 assert.equal(JSON.stringify({p,a}),original,'must not mutate any source');
});
test('X-01: primary project polygon with 31 vertices is held, not truncated',()=>{
 const p=project();p.polygon=polygon(31);const original=p.polygon.length;
 const r=inspect(p);
 assert.equal(r.primaryPolygonValid,false);assert.equal(r.status,'HOLD');
 assert(codes(r).includes('VERTEX_COUNT'));assert.equal(p.polygon.length,original);
});
test('X-01: activity polygon with 512 vertices is allowed independently',()=>{
 const r=inspect(project(),[area('area-512',512)]);
 assert.equal(r.activityAreasValid,true);
 assert.equal(r.primaryPolygonValid,true);
});
test('X-01: 513-vertex area is held, never sliced to 512',()=>{
 const p=area('area-too-long',513),r=inspect(project(),[p]);
 assert.equal(r.activityAreasValid,false);assert(codes(r).includes('VERTEX_COUNT'));assert.equal(p.points.length,513);
});
test('X-01: 64 activity areas pass preflight; 65 held',()=>{
 const a=Array.from({length:64},(_,i)=>area('area-'+i));
 assert.equal(inspect(project(),a).activityAreasValid,true);
 const r=inspect(project(),[...a,area('area-over')]);
 assert.equal(r.activityAreasValid,false);assert(codes(r).includes('ACTIVITY_AREA_COUNT'));
});
test('X-01: duplicated activity area ID blocks handoff',()=>{
 const r=inspect(project(),[area('same'),area('same')]);
 assert(codes(r).includes('ACTIVITY_AREA_ID'));
});
test('X-04: incomplete observation never upgraded to complete',()=>{
 const p=project();p.wayfarerObservation.acquisition.coverageComplete=false;
 const r=inspect(p);
 assert.equal(r.observationComplete,false);assert(codes(r).includes('COVERAGE_NOT_PROVEN'));assert.equal(p.wayfarerObservation.acquisition.coverageComplete,false);
});
test('X-04: ambiguous or duplicated Wayfarer GUID does not silently merge',()=>{
 const p=project();p.wayfarerObservation.zones.reference100[0].guid='inside';
 const r=inspect(p);
 assert(codes(r).includes('OBSERVATION_ID_MISSING_OR_DUPLICATE'));
});
test('X-04: Active/Inactive PowerSpot identity must survive preflight',()=>{
 const p=project();p.wayfarerObservation.zones.reserve200[0].referenceKind='';
 const r=inspect(p);
 assert(codes(r).includes('OBSERVATION_GAME_STATE'));
});
test('X-04: NEW_V1 document markers do not mean project-envelope parity',()=>{
 const r=inspect();
 assert.equal(r.newV1Recognized,true);assert.equal(r.status,'HOLD');
 assert(codes(r).includes('PROJECT_ENVELOPE_NOT_DEFINED'));
});
test('X-04: malformed/legacy-only metadata blocks NEW_V1 bridge',()=>{
 const k=stage();k.documentData=[];
 const r=inspect(project(),[],k);
 assert.equal(r.newV1Recognized,false);assert(codes(r).includes('KMZ_NOT_NEW_V1'));
});
test('X-04: old project with no Wayfarer observation is valid but cannot claim observed coverage',()=>{
 const p=project();delete p.wayfarerObservation;
 const r=inspect(p);
 assert.equal(r.structureValid,true);assert.equal(r.observationPresent,false);assert.equal(r.observationComplete,false);assert.equal(r.status,'HOLD');
});
test('X-04: project schema, handoff and identity must remain explicit',()=>{
 const p=project();p.meta.bridgeHandoffId='';
 const r=inspect(p);
 assert.equal(r.structureValid,false);assert(codes(r).includes('PROJECT_IDENTITY_OR_SCHEMA'));
});
