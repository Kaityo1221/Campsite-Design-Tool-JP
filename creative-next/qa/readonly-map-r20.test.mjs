import assert from 'node:assert/strict';
import {projectCreativeNextState} from '../integration/creative-ui-read-follower.mjs';
const s=projectCreativeNextState({hasActive:true,records:[{id:'a',role:'existing',kind:'pokestop',lat:35.6,lng:139.8},{id:'b',role:'new',kind:'gym',lat:35.7,lng:139.9,deleted:true}],circles:[]});
assert.equal(s.records.length,1);assert.equal(s.records[0].id,'a');
console.log('PASS r20 core projection accepts real map fixture and filters deleted records');
