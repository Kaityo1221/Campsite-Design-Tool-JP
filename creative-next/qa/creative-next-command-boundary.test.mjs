import assert from 'node:assert/strict';
import {createCreativeNextCommandBoundary} from '../integration/creative-next-command-boundary.mjs';
let n=0,refresh=0,confirm=true,active=true,readonly=false;
const session={
 state:()=>({hasActive:active,recoveredFallback:readonly}),
 command(v,o){assert.deepEqual(o,{confirmed:true});n++;return {ok:true,changed:true}},
 commandArea(v,o){assert.deepEqual(o,{confirmed:true});n++;return {ok:true,changed:true}},
 undo(){n++;return {ok:true,changed:true}},
 redo(){n++;return {ok:true,changed:true}}
};
const c=createCreativeNextCommandBoundary({session,refresh:()=>refresh++,confirmAction:()=>confirm});
assert.equal(c.dispatch({type:'save',requestId:'1'}).status,'HOLD');
assert.equal(c.dispatch({type:'poi'}).reason,'REQUEST_ID_REQUIRED');
confirm=false;assert.equal(c.dispatch({type:'poi',payload:{type:'add'},requestId:'2'}).status,'CANCELLED');
assert.equal(n,0);confirm=true;
for(const t of ['poi','area','undo','redo'])assert.equal(c.dispatch({type:t,payload:{type:'test'},requestId:t}).status,'APPLIED');
assert.equal(n,4);assert.equal(refresh,4);
readonly=true;assert.equal(c.dispatch({type:'undo',requestId:'5'}).reason,'READ_ONLY_OR_NO_EDITOR');
readonly=false;active=false;assert.equal(c.dispatch({type:'redo',requestId:'6'}).status,'HOLD');
active=true;
const bad=createCreativeNextCommandBoundary({session:{
 ...session,command(){throw Object.assign(new Error('protected'),{code:'SOURCE_LOCKED'})}
},refresh:()=>refresh++,confirmAction:()=>true});
assert.equal(bad.dispatch({type:'poi',requestId:'7'}).reason,'SOURCE_LOCKED');
assert.equal(refresh,4);
let nested;
const reentrant=createCreativeNextCommandBoundary({session,refresh:()=>{},confirmAction:()=>{nested=reentrant.dispatch({type:'poi',requestId:'nested'});return true}});
assert.equal(reentrant.dispatch({type:'poi',requestId:'outer'}).status,'APPLIED');
assert.equal(nested.reason,'IN_FLIGHT');
c.stop();assert.equal(c.dispatch({type:'poi',requestId:'8'}).status,'STOPPED');
console.log('PASS: explicit isolated command routing, confirmation, readonly guard, no save routing, reentrant refusal, errors and stop');
