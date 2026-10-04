import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const coverageSource = fs.readFileSync('creative/runtime/map-engine/wayfarer-reserve-coverage.js','utf8');
const reclassSource = fs.readFileSync('creative/runtime/map-engine/wayfarer-local-reclassification.js','utf8');

const sandbox={window:{},console,Math,Number,String,Object,Array,JSON,Infinity,Set};
vm.createContext(sandbox);
vm.runInContext(coverageSource,sandbox);
vm.runInContext(reclassSource,sandbox);

const reclassify=sandbox.window.bridgeMapLab_reclassifyWayfarerObservation;
assert.equal(typeof reclassify,'function');

const LAT=35;
const LNG=139;
const METERS_PER_LAT=111319.49079327357;
const METERS_PER_LNG=METERS_PER_LAT*Math.cos(LAT*Math.PI/180);
const point=(x,y)=>[LAT+y/METERS_PER_LAT,LNG+x/METERS_PER_LNG];
const rect=(x0,y0,x1,y1)=>[point(x0,y0),point(x1,y0),point(x1,y1),point(x0,y1)];

function poi(guid,x,y,gameEntity='POKESTOP',gameStatus='ACTIVE',extra={}) {
  const [lat,lng]=point(x,y);
  return {guid,title:guid,lat,lng,gameEntity,gameStatus,poiKind:gameEntity,provenance:['WAYFARER_PASSIVE'],...extra};
}

const observation={
  snapshotId:'wm3:test-snapshot',
  observedAt:'2026-10-02T08:00:00.000Z',
  polygon:rect(0,0,200,200),
  acquisition:{bufferMeters:200,coverageComplete:false},
  zones:{
    interior:[
      poi('inside-a',100,100),
      poi('inside-inactive',120,120,'POWERSPOT','INACTIVE',{poiKind:'NOT_IN_GAME',referenceKind:'INACTIVE_POWERSPOT'})
    ],
    reference100:[
      poi('east-ref',250,100,'GYM','ACTIVE')
    ],
    reserve200:[
      poi('east-reserve',350,100,'POWERSPOT','ACTIVE'),
      poi('west-reserve',-150,100,'POKESTOP','ACTIVE')
    ]
  }
};
const before=JSON.stringify(observation);

const unchanged=reclassify(observation,rect(0,0,200,200));
assert.equal(unchanged.canUseLocal,true);
assert.equal(unchanged.counts.interior,2);
assert.equal(unchanged.counts.reference100,1);
assert.equal(unchanged.counts.reserve200,2);
assert.equal(unchanged.coverage.covered,true);
assert.equal(unchanged.coverage.acquisitionCoverageComplete,false);

const shifted=reclassify(observation,rect(80,0,280,200));
assert.equal(shifted.canUseLocal,true);
assert.equal(shifted.counts.interior,3,'east reference should move into INTERIOR');
assert.equal(shifted.counts.reference100,1,'east reserve should move into REFERENCE_100');
assert.equal(shifted.counts.reserve200,1,'far west retained POI stays hidden reserve');
assert.equal(shifted.zones.reference100[0].guid,'east-reserve');
assert.equal(shifted.zones.reference100[0].gameEntity,'POWERSPOT');
assert.equal(shifted.zones.reference100[0].gameStatus,'ACTIVE');
assert.equal(shifted.zones.reference100[0].observationZone,'REFERENCE_100');
const inactive=shifted.zones.interior.find(item=>item.guid==='inside-inactive');
assert.ok(inactive);
assert.equal(inactive.gameStatus,'INACTIVE');
assert.equal(inactive.referenceKind,'INACTIVE_POWERSPOT');
assert.equal(shifted.sourceSnapshotId,'wm3:test-snapshot');
assert.equal(JSON.stringify(observation),before,'source observation must remain byte-equivalent');

const outside=reclassify(observation,rect(120,0,320,200));
assert.equal(outside.canUseLocal,false);
assert.equal(outside.reason,'REACQUIRE_REQUIRED');
assert.equal(outside.coverage.covered,false);
assert.equal(outside.counts.total,0,'outside-reserve result must not expose stale derived zones');

const duplicateObservation=JSON.parse(JSON.stringify(observation));
duplicateObservation.zones.reserve200.push({...duplicateObservation.zones.interior[0]});
const duplicate=reclassify(duplicateObservation,rect(0,0,200,200));
assert.equal(duplicate.canUseLocal,true);
assert.equal(duplicate.counts.total,5,'duplicate GUID must not be classified twice');
assert.ok(duplicate.diagnostics.some(item=>item.code==='DUPLICATE_GUID'));

const invalidObservation={...observation,zones:{interior:[],reference100:[]}};
const invalid=reclassify(invalidObservation,rect(0,0,200,200));
assert.equal(invalid.canUseLocal,false);
assert.equal(invalid.reason,'INVALID_OBSERVATION_ZONES');

const badPolygon=reclassify(observation,[point(0,0),point(200,200),point(0,200),point(200,0)]);
assert.equal(badPolygon.canUseLocal,false);
assert.equal(badPolygon.reason,'REACQUIRE_REQUIRED');
assert.equal(badPolygon.coverage.reason,'INVALID_CURRENT_POLYGON');

console.log('WM-5B-1 local observation reclassification: PASS');
