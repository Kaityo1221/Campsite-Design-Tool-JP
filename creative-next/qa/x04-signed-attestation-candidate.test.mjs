/* X-04 v0 detached-signature exploratory security tests; only synthetic keys/POIs. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
import {createPortableReturnBundleLab} from '../contracts/portable-return-bundle-lab.mjs';
import {signX04DetachedCandidateLab,inspectX04DetachedCandidateLab}
 from '../contracts/x04-signed-attestation-candidate-lab.mjs';

const {project}=createRequire(import.meta.url)('./r31-project-save-lab-browser.cjs');
const deps={JSZip,DOMParser,cryptoProvider:webcrypto};
const sourceOrigin='https://lab-source.invalid',destinationOrigin='https://lab-destination.invalid';
const time=Date.parse('2026-10-16T12:00:00.000Z');
const nonce='TEST_ONLY_0123456789_ABCDEF';
const policy={expectedSourceOrigin:sourceOrigin,expectedDestinationOrigin:destinationOrigin,
 pinnedKeyId:'synthetic-key-one',pinnedSenderId:'synthetic-ci-user',nowMs:time+30000,...deps};
let fixture=null;
async function setup(){
 if(fixture)return fixture;
 const p=project(),{bytes}=await createFreshV1Kmz({records:[{id:'original-record',
  role:'existing',guid:'existing-guid',kind:'pokestop',title:'元のPOI',
  memo:'Original',lat:35.701,lng:139.801}],activityAreas:[]},
  {JSZip,DOMParser,XMLSerializer,documentName:'X04_SIGNATURE_SYNTHETIC'});
 const ids={expectedProjectId:p.projectId,expectedHandoffId:p.meta.bridgeHandoffId};
 const bundle=await createPortableReturnBundleLab({project:p,activityAreas:[],
  kmzBytes:new Uint8Array(bytes),revision:1,...ids,...deps});
 const keyPair=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},
  false,['sign','verify']);
 const values={bundleBytes:bundle.bytes,...ids,...deps};
 const attestation=await signX04DetachedCandidateLab({...values,
  sourceOrigin,destinationOrigin,keyId:policy.pinnedKeyId,
  senderId:policy.pinnedSenderId,nonce,
  issuedAt:new Date(time).toISOString(),expiresAt:new Date(time+5*60000).toISOString(),
  privateKey:keyPair.privateKey});
 fixture={p,ids,bundle,keyPair,values,attestation};return fixture;
}
const verify=async(x={})=>{
 const d=await setup();return inspectX04DetachedCandidateLab({
  ...d.values,attestation:d.attestation,...policy,pinnedPublicKey:d.keyPair.publicKey,...x
 });
};
test('X04 detached synthetic signature binds full verified Project+KMZ and stays HOLD',async()=>{
 const d=await setup(),got=await verify();
 assert.equal(d.attestation.productionReady,false);
 assert.equal(d.attestation.originAuthenticated,false);
 assert.equal(got.signatureMatchesInjectedKey,true);
 assert.equal(got.claimsMatchProject,true);
 assert.equal(got.originAuthenticated,false);
 assert.equal(got.authorizedSender,false);
 assert.equal(got.writeAllowed,false);
 assert.equal(got.requiresTrustRegistry,true);
 assert.equal(got.replayProtectionDurable,false);
 assert.equal(got.sourceRevision,1);
 assert.equal(got.nonce,nonce);
});
test('X04 detached denies unpinned signer and forged signed sender/origin',async()=>{
 const d=await setup();
 const attacker=await webcrypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 await assert.rejects(()=>verify({pinnedPublicKey:attacker.publicKey}),{code:'X04_SIGNATURE_INVALID'});
 await assert.rejects(()=>verify({expectedSourceOrigin:'https://attacker.invalid'}),{code:'X04_POLICY_MISMATCH'});
 await assert.rejects(()=>verify({pinnedSenderId:'unknown-user'}),{code:'X04_POLICY_MISMATCH'});
 await assert.rejects(()=>verify({expectedHandoffId:'wrong-handoff'}),{code:'X04_POLICY_MISMATCH'});
 const modified={...d.attestation,statement:{...d.attestation.statement,sourceOrigin:'https://attacker.invalid'}};
 await assert.rejects(()=>verify({attestation:modified,expectedSourceOrigin:'https://attacker.invalid'}),
  {code:'X04_SIGNATURE_INVALID'});
});
test('X04 detached denies expired, future and replayed signed claim without storage writes',async()=>{
 await assert.rejects(()=>verify({nowMs:time+10*60000}),{code:'X04_EXPIRED_OR_NOT_YET_VALID'});
 await assert.rejects(()=>verify({nowMs:time-3*60000}),{code:'X04_EXPIRED_OR_NOT_YET_VALID'});
 await assert.rejects(()=>verify({previousNonces:[nonce]}),{code:'X04_REPLAY_HOLD'});
 await assert.rejects(()=>verify({previousNonces:['other',nonce]}),{code:'X04_REPLAY_HOLD'});
 await assert.rejects(()=>verify({pinnedPublicKey:null}),{code:'X04_VERIFIER_POLICY_REQUIRED'});
});
test('X04 detached signed payload is exact ZIP-byte bound even with same decompressed data',async()=>{
 const d=await setup(),source=await JSZip.loadAsync(d.bundle.bytes);
 const differentBytes=await source.generateAsync({type:'uint8array',compression:'STORE'});
 assert.notDeepEqual(d.bundle.bytes,differentBytes);
 await assert.rejects(()=>verify({bundleBytes:differentBytes}),{code:'X04_SIGNED_CONTENT_MISMATCH'});
 const corrupted=Uint8Array.from(d.bundle.bytes);corrupted[corrupted.length-1]^=0x20;
 await assert.rejects(()=>verify({bundleBytes:corrupted}),error=>!!error.code);
});
test('X04 detached refuses invalid freshness window and unsafe origins',async()=>{
 const d=await setup();
 await assert.rejects(()=>signX04DetachedCandidateLab({...d.values,
  sourceOrigin,destinationOrigin,keyId:policy.pinnedKeyId,senderId:policy.pinnedSenderId,
  nonce,issuedAt:new Date(time).toISOString(),expiresAt:new Date(time+60*60000).toISOString(),
  privateKey:d.keyPair.privateKey}),{code:'X04_TIME_INVALID'});
 await assert.rejects(()=>signX04DetachedCandidateLab({...d.values,
  sourceOrigin:'http://lab-source.invalid',destinationOrigin,keyId:policy.pinnedKeyId,
  senderId:policy.pinnedSenderId,nonce,issuedAt:new Date(time).toISOString(),
  expiresAt:new Date(time+300000).toISOString(),privateKey:d.keyPair.privateKey}),
  {code:'X04_ORIGIN_REQUIRED'});
});