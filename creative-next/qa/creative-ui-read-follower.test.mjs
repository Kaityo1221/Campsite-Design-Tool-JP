import assert from 'node:assert/strict';
import {projectCreativeNextState,createCreativeNextReadFollower} from '../integration/creative-ui-read-follower.mjs';
const engineState={hasActive:true,recoveredFallback:false,records:[
{id:'a',title:'Existing',kind:'pokestop',role:'existing',lat:35.65,lng:139.8,deleted:false},
{id:'b',title:'New',kind:'gym',role:'new',lat:35.66,lng:139.9,deleted:false},
{id:'deleted',title:'Hidden',kind:'power',role:'new',lat:35.6,lng:139.9,deleted:true},
{id:'bad',title:'Invalid',kind:'gym',role:'existing',lat:Infinity,lng:0}],
circles:[{ownerId:'b',lat:35.66,lng:139.9,radius:50}],areas:[],history:{undo:2,redo:0}};
let calls=0,projection=null;
const session={state:()=>engineState};
const follower=createCreativeNextReadFollower(session,{render:s=>{projection=s;calls++}});
follower.refresh();
assert.equal(calls,1);assert.equal(projection.records.length,2);
assert.deepEqual(projection.records[0].latlng,[35.65,139.8]);
assert.equal(projection.records[0].source,true);
assert.equal(projection.circles[0].radius,50);
assert.equal(Object.isFrozen(projection.records),true);
assert.equal(Object.isFrozen(projection.records[0]),true);
engineState.records.push({id:'c',title:'Later',kind:'power',role:'new',lat:35.7,lng:139.7});
follower.refresh();assert.equal(projection.records.length,3);assert.equal(calls,2);
engineState.recoveredFallback=true;follower.refresh();assert.equal(projection.readonly,true);
follower.unsubscribe();assert.equal(follower.refresh(),null);assert.equal(calls,3);
assert.equal(engineState.records.length,5);
assert.throws(()=>createCreativeNextReadFollower({}, {render:()=>{}}));
assert.equal(projectCreativeNextState({records:[{id:'x',kind:'unsupported',lat:1,lng:2}]}).records.length,0);
console.log('PASS: Creative Map UI read-follower projection, delta refresh, invalid rejection, readonly and unsubscribe');
