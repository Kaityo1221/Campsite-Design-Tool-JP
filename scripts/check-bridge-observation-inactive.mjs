import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/bridge-observation-inactive.js', 'utf8');
const sandbox = { window:{} };
vm.runInNewContext(source, sandbox, {filename:'js/bridge-observation-inactive.js'});
const collect = sandbox.window.CampsiteBridgeInactiveObservation.collect;

const active = Array.from({length:17},(_,i)=>({
  guid:'active-'+i,gameEntity:'POWERSPOT',gameStatus:'ACTIVE',lat:35+i/10000,lng:139
}));
const inactive = Array.from({length:100},(_,i)=>({
  guid:'inactive-'+i,poiKind:'NOT_IN_GAME',referenceKind:'INACTIVE_POWERSPOT',
  gameEntity:'POWERSPOT',gameStatus:'INACTIVE',lat:35+i/10000,lng:139.01,
  title:'Inactive '+i
}));
const payload = {
  pois:active,referencePois:[],
  wayfarerObservation:{zones:{
    interior:inactive.slice(0,50),
    reference100:inactive.slice(50,90),
    reserve200:inactive.slice(90)
  }}
};
const actual = collect(payload);
assert.equal(actual.count,100);
assert.equal(actual.visibleCount,90);
assert.equal(actual.reserveCount,10);
assert.equal(new Set(actual.entries.map(p=>p.guid)).size,100);
assert.ok(actual.entries.every(p=>p.readOnly===true));
assert.equal(JSON.stringify(payload).includes('"selectedPois"'), false, 'Observation must remain outside editable selection');

const altered=JSON.parse(JSON.stringify(payload));
altered.referencePois=[inactive[0],inactive[50]];
altered.wayfarerObservation.zones.reference100.push(inactive[0],{
  ...inactive[1],guid:'active-1'
},{
  ...inactive[2],guid:'invalid-lat',lat:999
},{
  ...inactive[3],guid:'not-in-game',referenceKind:'NOT_IN_GAME'
});
assert.equal(collect(altered).count,100,'Dedup and invalid reference states must not inflate counts');
assert.equal(collect({pois:active,referencePois:[],wayfarerObservation:null}).count,0);
assert.equal(collect({pois:active,referencePois:inactive.slice(0,4)}).count,4);

const receiver=fs.readFileSync('bridge-receiver.html','utf8');
const gateway=fs.readFileSync('bridge-gateway.html','utf8');
const summary=fs.readFileSync('js/bridge-entry.js','utf8');
assert.match(receiver,/bridge-observation-inactive\.js\?v=1/);
assert.match(gateway,/bridge-observation-inactive\.js\?v=1/);
assert.match(receiver,/observedInactive\?\.count/);
assert.match(summary,/CampsiteBridgeInactiveObservation\?\.collect/);
console.log('Observation inactive 17 active + 100 inactive receiving counters: PASS');
