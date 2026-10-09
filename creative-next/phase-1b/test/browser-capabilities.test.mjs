import test from 'node:test';
import assert from 'node:assert/strict';
import {probePreviewEnvironment} from '../../phase-2-preview/browser-capabilities.mjs';
function nativeLike(){
 const calls=[];
 const storage={getItem(k){calls.push(k);return null},setItem(k){calls.push(k)}};
 const env={localStorage:storage,crypto:{subtle:{digest:async()=>new ArrayBuffer(32)},randomUUID:()=> 'uuid'},DOMParser:class {},XMLSerializer:class {},JSZip:{loadAsync:async()=>({})}};
 return {env,storage,calls};
}
test('complete capability check exposes native handles without accessing any storage keys',()=>{
 const {env,storage,calls}=nativeLike(),result=probePreviewEnvironment(env);
 assert.equal(result.storage,storage);assert.equal(result.canInspect,true);assert.equal(result.canSave,true);assert.equal(result.canExport,true);assert.equal(result.hasUUID,true);assert.deepEqual(calls,[]);assert.deepEqual(result.warnings,[]);
});
test('Safari localStorage security-error getter does not crash import readiness',()=>{
 const {env}=nativeLike();Object.defineProperty(env,'localStorage',{get(){throw new DOMException('Denied','SecurityError')}});
 const result=probePreviewEnvironment(env);
 assert.equal(result.storage,null);assert.equal(result.canSave,false);assert.equal(result.canInspect,true);
 assert.match(result.warnings.join(' '),/保存領域/);
});
test('storage without required native methods is unavailable without write probes',()=>{
 const {env}=nativeLike();env.localStorage={getItem(){return null}};
 const r=probePreviewEnvironment(env);assert.equal(r.canSave,false);assert.equal(r.storage,null);
});
test('crypto.digest absent disables unsafe import and export, no false success',()=>{
 const {env}=nativeLike();env.crypto={randomUUID:()=> 'uuid'};
 const r=probePreviewEnvironment(env);assert.equal(r.canInspect,false);assert.equal(r.canSave,false);assert.equal(r.canExport,false);
});
test('missing KMZ library blocks import/export and preserves save-readiness result',()=>{
 const {env}=nativeLike();env.JSZip=undefined;
 const r=probePreviewEnvironment(env);assert.equal(r.canInspect,false);assert.equal(r.canExport,false);assert.equal(r.canSave,true);
});
test('missing DOM Parser prevents trying malformed KML paths',()=>{
 const {env}=nativeLike();env.DOMParser=null;
 const r=probePreviewEnvironment(env);assert.equal(r.canInspect,false);assert.equal(r.canExport,false);
});
test('missing randomUUID is identified separately from existing KMZ inspection',()=>{
 const {env}=nativeLike();delete env.crypto.randomUUID;
 const r=probePreviewEnvironment(env);assert.equal(r.canInspect,true);assert.equal(r.hasUUID,false);
 assert.match(r.warnings.join(' '),/一意ID/);
});
test('diagnostics result is immutable and never accesses old Creative Mode save key',()=>{
 const {env,calls}=nativeLike();const r=probePreviewEnvironment(env);
 assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.warnings));
 assert.throws(()=>{r.canSave=false;},TypeError);assert.deepEqual(calls,[]);
});
