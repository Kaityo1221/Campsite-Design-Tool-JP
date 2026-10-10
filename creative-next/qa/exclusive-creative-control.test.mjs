import assert from 'node:assert/strict';
import {replaceWithExclusiveCreativeControl} from '../integration/exclusive-creative-control.mjs';
class Node {
 constructor(){this.dataset={};this.listeners=[];this.disabled=false;this.parentNode=null;this.attrs={};this.old=0}
 cloneNode(){const n=new Node();n.attrs={...this.attrs};return n}
 removeAttribute(k){delete this.attrs[k]}
 addEventListener(_event,fn){this.listeners.push(fn)}
 removeEventListener(_event,fn){this.listeners=this.listeners.filter(x=>x!==fn)}
 replaceWith(next){next.parentNode=this.parentNode;this.parentNode.child=next;this.parentNode=null}
 click(){const e={preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}};for(const fn of this.listeners)fn(e)}
}
const old=new Node(),host={child:old};old.parentNode=host;old.attrs.onclick='oldDanger()';old.addEventListener('click',()=>old.old++);
const actions=[];
const owned=replaceWithExclusiveCreativeControl({element:old,makeAction:()=>({type:'undo'}),dispatch:a=>actions.push(a)});
assert.equal(host.child,owned.element);assert.equal(old.parentNode,null);
assert.equal(owned.element.attrs.onclick,undefined);owned.element.click();owned.element.click();
assert.equal(old.old,0);assert.deepEqual(actions.map(x=>x.requestId),['isolated-1','isolated-2']);
owned.dispose();owned.element.click();assert.equal(actions.length,2);
assert.throws(()=>replaceWithExclusiveCreativeControl({element:old,dispatch:()=>{},makeAction:()=>({})}));
console.log('PASS: detached old direct listeners, visual clone, exclusive new dispatch, teardown');
