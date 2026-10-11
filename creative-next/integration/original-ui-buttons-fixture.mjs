import {replaceWithExclusiveCreativeControl} from '../integration/exclusive-creative-control.mjs';
import {createCreativeNextCommandBoundary} from '../integration/creative-next-command-boundary.mjs';
// Inert fixture: original HTML/CSS loaded from production patch chain; no production scripts.
export function installOriginalButtonsFixture(doc, session, refresh){
 const controls=['undo','redo'].map(id=>doc.getElementById(id));
 if(controls.some(x=>!x))throw new Error('ORIGINAL_UI_CONTROL_MISSING');
 const dispatch=createCreativeNextCommandBoundary({session,refresh,confirmAction:()=>true});
 const installed=controls.map((element,i)=>replaceWithExclusiveCreativeControl({
  element,dispatch:action=>dispatch.dispatch(action),makeAction:()=>({type:i===0?'undo':'redo'})
 }));
 const sync=()=>{const state=session.state();for(const x of installed)x.element.disabled=!(state.hasActive&&!state.recoveredFallback)};
 sync();
 return {sync,dispose:()=>{dispatch.stop();for(const x of installed)x.dispose()}};
}
