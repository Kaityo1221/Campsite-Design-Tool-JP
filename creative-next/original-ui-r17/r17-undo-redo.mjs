import {installOriginalButtonsFixture} from '../integration/original-ui-buttons-fixture.mjs';
// r17 is an isolated event-only preview. No actual session/data or persistence.
let enabled=false;
const counters={undo:0,redo:0};
const session={
 state:()=>({hasActive:enabled,recoveredFallback:false}),
 command:()=>{throw Error('POI disabled')},commandArea:()=>{throw Error('Areas disabled')},
 undo:()=>{counters.undo++;return {ok:true,changed:true}},
 redo:()=>{counters.redo++;return {ok:true,changed:true}}
};
const fixture=installOriginalButtonsFixture(document,session,()=>{});
window.creativeR17={counters,enableForTest(){enabled=true;fixture.sync()},disable(){enabled=false;fixture.sync()}};
