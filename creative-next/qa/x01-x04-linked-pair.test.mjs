import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {webcrypto} from 'node:crypto';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createLinkedPairLab,reopenLinkedPairLab} from '../contracts/linked-project-kmz-lab.mjs';

const options={JSZip,DOMParser,cryptoProvider:webcrypto};
const ring=n=>Array.from({length:n},(_,i)=>[35.7+.002*Math.sin(i*2*Math.PI/n),139.8+.002*Math.cos(i*2*Math.PI/n)]);
function project(){
 const polygon=[[35.699,139.798],[35.704,139.798],[35.704,139.805]];
 return {
  schemaVersion:'1.0',projectId:'project-synthetic',source:'bridge',polygon,
  selectedPois:[{guid:'wayfarer-existing',title:'既存P',lat:35.7,lng:139.8}],
  currentPois:[
   {id:'current-existing',guid:'wayfarer-existing',role:'existing',gameEntity:'POKESTOP',gameStatus:'ACTIVE',title:'既存P',lat:35.7,lng:139.8},
   {id:'new-local-1',guid:'',role:'added',gameEntity:'GYM',gameStatus:'ACTIVE',title:'追加G',lat:35.701,lng:139.801}
  ],
  addedPois:[{id:'new-local-1',role:'added'}],deletedPois:[],edits:[],
  meta:{projectContract:'campsiteProject.v1',bridgeHandoffId:'handoff:synthetic'},
  wayfarerObservation:{
   snapshotId:'snapshot-synthetic',version:'0.1.0',observedAt:'2026-10-12T00:00:00Z',
   polygon:[[35.698,139.797],[35.703,139.797],[35.703,139.804]],
   acquisition:{coverageComplete:true,bufferMeters:200,coverageStatus:'complete',sourceComplete:true},
   zones:{
    interior:[{guid:'wayfarer-existing',lat:35.7,lng:139.8,poiKind:'POKESTOP',gameEntity:'POKESTOP',gameStatus:'ACTIVE'}],
    reference100:[{guid:'external',lat:35.7041,lng:139.801,poiKind:'GYM',gameEntity:'GYM',gameStatus:'ACTIVE'}],
    reserve200:[{guid:'reserve-inactive',lat:35.705,lng:139.801,poiKind:'POWERSPOT',gameEntity:'POWERSPOT',gameStatus:'INACTIVE',referenceKind:'INACTIVE_POWERSPOT'}]
   }
  },
  futureUnknownField:{preserve:['x',{deep:{y:1}}]}
 };
}
const activityAreas=()=>[{id:'area-alone',points:ring(31)},{id:'area-512',points:ring(512)}];
const records=()=>[
 {id:'kmz-existing',guid:'wayfarer-existing',role:'existing',kind:'pokestop',title:'既存P',memo:'元の状態',lat:35.7,lng:139.8},
 {id:'new-local-1',guid:null,poiId:null,role:'new',kind:'gym',title:'追加G',memo:'現地で追加',lat:35.701,lng:139.801}
];
async function fixture(){
 const areas=activityAreas();
 const {bytes}=await createFreshV1Kmz({records:records(),activityAreas:areas},{JSZip,DOMParser,XMLSerializer,documentName:'synthetic'});
 return {project:project(),activityAreas:areas,kmzBytes:bytes};
}
const args=x=>({...x,expectedProjectId:'project-synthetic',expectedHandoffId:'handoff:synthetic',...options});
const checkError=async (fn,code)=>assert.rejects(fn,e=>e?.code===code,`expected ${code}`);
test('LAB: project, original bytes, two independent activity polygons, and observation survive roundtrip',async()=>{
 const src=await fixture(),original=structuredClone({project:src.project,activityAreas:src.activityAreas});
 const originalBytes=new Uint8Array(src.kmzBytes);
 const pair=await createLinkedPairLab(args(src));
 assert.equal(pair.status,'LAB_PAIR_CREATED');assert.equal(pair.productionReady,false);
 const restored=await reopenLinkedPairLab(args({pair}));
 assert.equal(restored.status,'LAB_PAIR_VERIFIED');assert.equal(restored.productionReady,false);
 assert.deepEqual(restored.project,original.project);
 assert.deepEqual(restored.activityAreas,original.activityAreas);
 assert.deepEqual(restored.kmzBytes,originalBytes);
 assert.equal(restored.project.polygon.length,3);
 assert.equal(restored.activityAreas[0].points.length,31);
 assert.equal(restored.activityAreas[1].points.length,512);
 assert.equal(restored.project.wayfarerObservation.zones.reserve200[0].gameStatus,'INACTIVE');
 assert.equal(restored.project.wayfarerObservation.zones.reference100[0].guid,'external');
 assert.equal(restored.project.wayfarerObservation.acquisition.coverageComplete,true);
 assert.equal(restored.project.wayfarerObservation.polygon[0][0],35.698);
 assert.equal(pair.diagnostics.kmzPoiCount,2);
 assert.equal(pair.diagnostics.areaCount,2);
 assert.deepEqual(src.project,original.project,'must never write original Project');
 assert.deepEqual(src.activityAreas,original.activityAreas,'must never write original areas');
});
test('LAB: post-create source mutations do not rewrite created pair',async()=>{
 const src=await fixture(),pair=await createLinkedPairLab(args(src));
 src.project.polygon[0][0]=50;src.activityAreas[0].points[0][0]=50;src.kmzBytes[0]^=1;
 const restored=await reopenLinkedPairLab(args({pair}));
 assert.equal(restored.project.polygon[0][0],35.699);
 assert.notEqual(restored.activityAreas[0].points[0][0],50);
 assert.equal(restored.kmzBytes[0],0x50);
});
test('LAB: KMZ data tampering is detected before reopening',async()=>{
 const src=await fixture(),pair=await createLinkedPairLab(args(src));
 pair.kmzBytes[10]^=0x33;
 await checkError(()=>reopenLinkedPairLab(args({pair})),'PAIR_INTEGRITY_MISMATCH');
});
test('LAB: project sidecar tampering is detected',async()=>{
 const src=await fixture(),pair=await createLinkedPairLab(args(src));
 const forged={...pair,manifest:{...pair.manifest,projectJson:pair.manifest.projectJson.replace('project-synthetic','project-replaced')}};
 await checkError(()=>reopenLinkedPairLab(args({pair:forged})),'PAIR_INTEGRITY_MISMATCH');
});
test('LAB: activity sidecar tampering is detected',async()=>{
 const src=await fixture(),pair=await createLinkedPairLab(args(src));
 const forged={...pair,manifest:{...pair.manifest,activityAreasJson:'[]'}};
 await checkError(()=>reopenLinkedPairLab(args({pair:forged})),'PAIR_INTEGRITY_MISMATCH');
});
test('LAB: different handoff identity never reuses a prior paired archive',async()=>{
 const src=await fixture(),pair=await createLinkedPairLab(args(src));
 await checkError(()=>reopenLinkedPairLab({...args({pair}),expectedHandoffId:'handoff:other'}),'PAIR_HANDOFF_IDENTITY_MISMATCH');
});
test('LAB: incomplete observation is held, not upgraded',async()=>{
 const src=await fixture();src.project.wayfarerObservation.acquisition.coverageComplete=false;
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_PROJECT_PREFLIGHT_HOLD');
 assert.equal(src.project.wayfarerObservation.acquisition.coverageComplete,false);
});
test('LAB: missing historical observation must not be fabricated from KMZ',async()=>{
 const src=await fixture();delete src.project.wayfarerObservation;
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_PROJECT_PREFLIGHT_HOLD');
});
test('LAB: 31-vertex primary Wayfarer design polygon is held without truncation',async()=>{
 const src=await fixture();src.project.polygon=ring(31);
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_PROJECT_PREFLIGHT_HOLD');
 assert.equal(src.project.polygon.length,31);
});
test('LAB: activity areas supplied separately must match archived area IDs and geometry',async()=>{
 const src=await fixture();src.activityAreas[0].points[0][0]+=0.00001;
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_AREA_MISMATCH');
});
test('LAB: no silent loss of currentPois allowed when KMZ has fewer POIs',async()=>{
 const src=await fixture();src.project.currentPois.push({id:'missing',role:'added',gameEntity:'GYM',title:'not in KMZ',lat:35,lng:139});
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_POI_COUNT_MISMATCH');
});
test('LAB: identity and changed POI coordinates are compared, not matched by title',async()=>{
 const src=await fixture();src.project.currentPois[0].lat+=0.0001;
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_POI_MISMATCH');
});
test('LAB: PowerSpot status remains in Project, not incorrectly inferred from generic KMZ kind',async()=>{
 const src=await fixture(),pair=await createLinkedPairLab(args(src));
 const restored=await reopenLinkedPairLab(args({pair}));
 assert.equal(restored.project.wayfarerObservation.zones.reserve200[0].gameStatus,'INACTIVE');
 assert.equal(restored.project.wayfarerObservation.zones.reserve200[0].referenceKind,'INACTIVE_POWERSPOT');
});
test('LAB: generated bytes cannot silently become a legacy KML artifact',async()=>{
 const src=await fixture();src.kmzBytes=new TextEncoder().encode('<kml/>');
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_SOURCE_INVALID');
});
test('LAB: project JSON must not silently discard unknown runtime values',async()=>{
 const src=await fixture();src.project.futureUnknownField.bad=undefined;
 await checkError(()=>createLinkedPairLab(args(src)),'PAIR_JSON_UNSUPPORTED');
});
