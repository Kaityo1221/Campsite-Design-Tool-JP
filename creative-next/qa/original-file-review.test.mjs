import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {attachOriginalFileReview} from '../integration/original-file-review.mjs';
class Control {
 constructor(id){this.id=id;this.dataset={};this.disabled=true;this.parentNode=null;this.handlers=new Map();this.files=[];this.textContent='';}
 cloneNode(){const n=new Control(this.id);n.disabled=this.disabled;return n}
 removeAttribute(){}
 addEventListener(type,fn){this.handlers.set(type,[...(this.handlers.get(type)||[]),fn])}
 removeEventListener(type,fn){this.handlers.set(type,(this.handlers.get(type)||[]).filter(x=>x!==fn))}
 replaceWith(next){next.parentNode=this.parentNode;this.parentNode.nodes[this.id]=next;this.parentNode=null}
 async fire(type){if(this.disabled)return;for(const fn of this.handlers.get(type)||[])await fn({preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}})}
}
const ids=['entryFile','startButton','entryState','entryFileName','undo','redo'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Control(id)])),root={nodes};
for(const n of Object.values(nodes))n.parentNode=root;
let legacy=0;nodes.startButton.addEventListener('click',()=>legacy++);
const fresh={id:'e1',role:'existing',kind:'pokestop',title:'Test',memo:'original',lat:35.65,lng:139.8,deleted:false};
const kmz=(await createFreshV1Kmz({records:[fresh],activityAreas:[]},{JSZip,DOMParser,XMLSerializer})).bytes;
let approve=false;
const controller=attachOriginalFileReview({document:{getElementById:id=>nodes[id]},JSZip,DOMParser,XMLSerializer,confirmReview:()=>approve});
assert.equal(root.nodes.startButton.disabled,true);
root.nodes.entryFile.files=[{name:'test.kmz',arrayBuffer:async()=>kmz.buffer.slice(kmz.byteOffset,kmz.byteOffset+kmz.byteLength)}];
await root.nodes.entryFile.fire('change');
assert.equal(root.nodes.startButton.disabled,false);
assert.equal(controller.engine.state().hasActive,false);
await root.nodes.startButton.fire('click');
assert.equal(controller.engine.state().hasActive,false);
approve=true;
await root.nodes.startButton.fire('click');
assert.equal(controller.engine.state().hasActive,true);
assert.equal(legacy,0);
controller.dispose();
assert.equal(root.nodes.entryFile.disabled,true);
assert.equal(root.nodes.startButton.disabled,true);
console.log('PASS r19: actual KMZ review, refusal before consent, acceptance and zero original handler calls');
