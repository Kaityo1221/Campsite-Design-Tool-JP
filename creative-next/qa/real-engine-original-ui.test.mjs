import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createRealEngineOriginalUI} from '../integration/real-engine-original-ui.mjs';
class Node{
 constructor(id){this.id=id;this.dataset={};this.disabled=true;this.parentNode=null;this.listeners=[];this.className='bottom-bar-button';}
 cloneNode(){const el=new Node(this.id);el.disabled=this.disabled;el.className=this.className;return el}
 removeAttribute(){}
 addEventListener(_,cb){this.listeners.push(cb)}
 removeEventListener(_,cb){this.listeners=this.listeners.filter(x=>x!==cb)}
 replaceWith(el){el.parentNode=this.parentNode;this.parentNode.nodes[this.id]=el;this.parentNode=null}
 click(){if(this.disabled)return;for(const cb of this.listeners)cb({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}})}
}
const nodes={undo:new Node('undo'),redo:new Node('redo')},root={nodes};
for(const el of Object.values(nodes))el.parentNode=root;
const oldCalls={undo:0,redo:0};for(const id of ['undo','redo'])nodes[id].addEventListener('click',()=>oldCalls[id]++);
const factory=createRealEngineOriginalUI({document:{getElementById:id=>nodes[id]},JSZip,DOMParser,XMLSerializer,onRefresh:()=>{}});
const {engine}=factory;
assert.equal(engine.state().hasActive,false);
root.nodes.undo.click();assert.deepEqual(oldCalls,{undo:0,redo:0});
const example={id:'src-1',role:'existing',kind:'pokestop',title:'元POI',memo:'初期',lat:35.64203,lng:139.855563,deleted:false};
const bytes=(await createFreshV1Kmz({records:[example],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes;
const prepared=await factory.prepare(bytes);
assert.equal(prepared.status,'REVIEW');
assert.equal(root.nodes.undo.disabled,true);
assert.equal(factory.accept({confirmed:false}).applied,false);
assert.equal(factory.accept({confirmed:true}).applied,true);
assert.equal(root.nodes.undo.disabled,false);
assert.equal(factory.edit({type:'edit',id:'src-1',patch:{memo:'変更'}},{confirmed:true}).changed,true);
assert.equal(engine.state().records[0].memo,'変更');
root.nodes.undo.click();
assert.equal(engine.state().records[0].memo,'初期');
root.nodes.redo.click();
assert.equal(engine.state().records[0].memo,'変更');
assert.deepEqual(engine.state().history,{undo:1,redo:0});
assert.deepEqual(oldCalls,{undo:0,redo:0});
factory.dispose();
assert.equal(root.nodes.undo.disabled,true);
assert.equal(engine.state().records[0].memo,'変更');
console.log('PASS: real KMZ prepared and approved, edit -> DOM Undo -> DOM Redo, no old handlers, no storage');
