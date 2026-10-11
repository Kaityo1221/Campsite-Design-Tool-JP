import assert from 'node:assert/strict';
import {installOriginalButtonsFixture} from '../integration/original-ui-buttons-fixture.mjs';
class FakeElement{
 constructor(id){this.id=id;this.dataset={};this.disabled=true;this.parentNode=null;this.handlers=[];this.attrs={};}
 cloneNode(){const n=new FakeElement(this.id);n.disabled=this.disabled;return n}
 removeAttribute(){}
 addEventListener(_,fn){this.handlers.push(fn)}
 removeEventListener(_,fn){this.handlers=this.handlers.filter(x=>x!==fn)}
 replaceWith(n){n.parentNode=this.parentNode;this.parentNode.nodes[this.id]=n}
 click(){if(this.disabled)return;for(const fn of this.handlers)fn({preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}})}
}
const nodes={undo:new FakeElement('undo'),redo:new FakeElement('redo')};
const parent={nodes};for(const el of Object.values(nodes))el.parentNode=parent;
let ready=false,undo=0,redo=0,redraw=0;
const session={state:()=>({hasActive:ready,recoveredFallback:false}),command(){},commandArea(){},
 undo:()=>{undo++;return {ok:true,changed:true}},redo:()=>{redo++;return {ok:true,changed:true}}};
const fixture=installOriginalButtonsFixture({getElementById:id=>nodes[id]},session,()=>redraw++);
parent.nodes.undo.click();assert.equal(undo,0);
ready=true;fixture.sync();parent.nodes.undo.click();parent.nodes.redo.click();
assert.equal(undo,1);assert.equal(redo,1);assert.equal(redraw,2);
fixture.dispose();parent.nodes.undo.click();assert.equal(undo,1);
console.log('PASS original UI fixture: disabled before editor, exclusive events, teardown');
