import {replaceWithExclusiveCreativeControl} from '../../integration/exclusive-creative-control.mjs';
import {createCreativeNextCommandBoundary} from '../../integration/creative-next-command-boundary.mjs';
// Isolated browser E2E ONLY: leave original visual class, inline style and position unchanged.
const oldUndo=document.getElementById('undo');
const oldRedo=document.getElementById('redo');
if(!oldUndo||!oldRedo)throw Error('Original controls absent');
const counts={legacy:0,newUndo:0,newRedo:0};
for(const el of [oldUndo,oldRedo])el.addEventListener('click',()=>counts.legacy++);
const session={state:()=>({hasActive:true,recoveredFallback:false}),command:()=>{throw Error('unexpected POI')},commandArea:()=>{throw Error('unexpected area')},
undo:()=>{counts.newUndo++;return {ok:true,changed:true}},redo:()=>{counts.newRedo++;return {ok:true,changed:true}}};
const boundary=createCreativeNextCommandBoundary({session,refresh:()=>{},confirmAction:()=>true});
const undo=replaceWithExclusiveCreativeControl({element:oldUndo,dispatch:a=>boundary.dispatch(a),makeAction:()=>({type:'undo'})});
const redo=replaceWithExclusiveCreativeControl({element:oldRedo,dispatch:a=>boundary.dispatch(a),makeAction:()=>({type:'redo'})});
undo.element.disabled=false;redo.element.disabled=false;
window.__creativeE2E={counts,undo,redo};
