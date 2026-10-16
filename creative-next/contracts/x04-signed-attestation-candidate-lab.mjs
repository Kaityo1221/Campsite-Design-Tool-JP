/*
 * X-04 disconnected signature candidate, LAB ONLY. Not a transport, signing
 * service, origin attestation, or authorization policy. No production writes.
 * Caller must inject an OUT-OF-BAND pinned public key. An untrusted ZIP must
 * never select its own trust key.
 */
import {inspectPortableReturnBundleLab} from './portable-return-bundle-lab.mjs';
import {createLinkedPairLab} from './linked-project-kmz-lab.mjs';

const KIND='campsite-x04-detached-signature-CANDIDATE-LAB';
const VERSION=0;
const MAX_TTL_MS=15*60*1000;
const SKEW_MS=2*60*1000;
const enc=new TextEncoder();
const fail=code=>{const e=new Error(code);e.code=code;throw e;};
const text=x=>typeof x==='string'&&x.trim()===x&&x.length>0&&x.length<=128;
const sha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hex=buf=>Array.from(new Uint8Array(buf),n=>n.toString(16).padStart(2,'0')).join('');
function unhex(x){
 if(typeof x!=='string'||!(/^[0-9a-f]{128}$/).test(x))fail('X04_SIGNATURE_ENCODING');
 return Uint8Array.from(x.match(/../g),v=>parseInt(v,16));
}
function origin(x){
 if(typeof x!=='string'||x.length>200||!x.startsWith('https://'))fail('X04_ORIGIN_REQUIRED');
 let url;try{url=new URL(x);}catch{fail('X04_ORIGIN_REQUIRED');}
 if(url.origin!==x||url.protocol!=='https:'||url.username||url.password)fail('X04_ORIGIN_REQUIRED');
 return x;
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const keys=['kind','version','algorithm','keyId','senderId','sourceOrigin','destinationOrigin',
 'audience','projectId','handoffId','snapshotId','sourceRevision','projectSha256',
 'activityAreasSha256','kmzSha256','bundleSha256','nonce','issuedAt','expiresAt'];
function claims(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||
  !same(Object.keys(x).sort(),[...keys].sort()))fail('X04_CLAIM_FIELDS');
 if(x.kind!==KIND||x.version!==VERSION||x.algorithm!=='ECDSA-P256-SHA256'||
  x.audience!=='campsite-distance-return-lab' ||
  ![x.keyId,x.senderId,x.projectId,x.handoffId,x.snapshotId].every(text)||
  !Number.isSafeInteger(x.sourceRevision)||x.sourceRevision<1||
  ![x.projectSha256,x.activityAreasSha256,x.kmzSha256,x.bundleSha256].every(sha)||
  typeof x.nonce!=='string'||!(/^[A-Za-z0-9_-]{22,128}$/).test(x.nonce))
  fail('X04_CLAIM_INVALID');
 origin(x.sourceOrigin);origin(x.destinationOrigin);
 const start=Date.parse(x.issuedAt),end=Date.parse(x.expiresAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||
  new Date(start).toISOString()!==x.issuedAt||
  new Date(end).toISOString()!==x.expiresAt||end<=start||end-start>MAX_TTL_MS)
  fail('X04_TIME_INVALID');
 return {start,end};
}
function signBytes(x){return enc.encode('Campsite-X04-detached-LAB-v0\n'+JSON.stringify(x));}
async function buildBound({bundleBytes,expectedProjectId,expectedHandoffId,JSZip,DOMParser,cryptoProvider}){
 const received=await inspectPortableReturnBundleLab({bytes:bundleBytes,
  expectedProjectId,expectedHandoffId,JSZip,DOMParser,cryptoProvider});
 const pair=await createLinkedPairLab({project:received.project,
  activityAreas:received.activityAreas,kmzBytes:received.kmzBytes,
  expectedProjectId,expectedHandoffId,JSZip,DOMParser,cryptoProvider});
 return {received,manifest:pair.manifest,
  bundleSha256:hex(await cryptoProvider.subtle.digest('SHA-256',bundleBytes))};
}
const permittedKey=(key,type)=>key&&key.type===type&&
 key.algorithm?.name==='ECDSA'&&key.algorithm?.namedCurve==='P-256'&&
 Array.isArray(key.usages)&&key.usages.includes(type==='private'?'sign':'verify');
const ecdsa={name:'ECDSA',hash:'SHA-256'};
/** Create a separate signed assertion, not a ZIP modification or public key. */
export async function signX04DetachedCandidateLab({bundleBytes,expectedProjectId,expectedHandoffId,
 sourceOrigin,destinationOrigin,keyId,senderId,nonce,issuedAt,expiresAt,
 privateKey,JSZip,DOMParser,cryptoProvider=globalThis.crypto}={}){
 if(!permittedKey(privateKey,'private'))fail('X04_LAB_SIGNING_KEY_REQUIRED');
 if(!(bundleBytes instanceof Uint8Array))fail('X04_BUNDLE_REQUIRED');
 const {received,manifest,bundleSha256}=await buildBound({bundleBytes,expectedProjectId,
  expectedHandoffId,JSZip,DOMParser,cryptoProvider});
 const statement={kind:KIND,version:VERSION,algorithm:'ECDSA-P256-SHA256',
  keyId,senderId,sourceOrigin,destinationOrigin,
  audience:'campsite-distance-return-lab',projectId:expectedProjectId,
  handoffId:expectedHandoffId,snapshotId:manifest.sourceSnapshotId,
  sourceRevision:received.revision,projectSha256:manifest.projectSha256,
  activityAreasSha256:manifest.activityAreasSha256,kmzSha256:manifest.kmzSha256,
  bundleSha256,nonce,issuedAt,expiresAt};
 claims(statement);
 const signatureHex=hex(await cryptoProvider.subtle.sign(ecdsa,privateKey,signBytes(statement)));
 return Object.freeze({status:'LAB_X04_DETACHED_SIGNATURE_CREATED',
  productionReady:false,writeAllowed:false,originAuthenticated:false,
  authorizedSender:false,statement:Object.freeze(statement),signatureHex});
}
/**
 * Match an independently pinned key, expected sender/destination, exact ZIP,
 * time window, and a caller-supplied replay deny set. This pure verifier does
 * not maintain a durable replay register nor establish real authenticated
 * sender authority, hence its result never authorizes live Project writes.
 */
export async function inspectX04DetachedCandidateLab({bundleBytes,attestation,
 expectedProjectId,expectedHandoffId,expectedSourceOrigin,expectedDestinationOrigin,
 pinnedKeyId,pinnedSenderId,pinnedPublicKey,previousNonces=[],nowMs=Date.now(),
 JSZip,DOMParser,cryptoProvider=globalThis.crypto}={}){
 if(!permittedKey(pinnedPublicKey,'public')||
   ![pinnedKeyId,pinnedSenderId,expectedProjectId,expectedHandoffId].every(text)||
   !Array.isArray(previousNonces)||previousNonces.some(x=>typeof x!=='string')||
   !Number.isSafeInteger(nowMs))fail('X04_VERIFIER_POLICY_REQUIRED');
 const statement=attestation?.statement,signature=unhex(attestation?.signatureHex);
 const {start,end}=claims(statement);
 if(statement.keyId!==pinnedKeyId||statement.senderId!==pinnedSenderId||
  statement.projectId!==expectedProjectId||statement.handoffId!==expectedHandoffId||
  statement.sourceOrigin!==origin(expectedSourceOrigin)||
  statement.destinationOrigin!==origin(expectedDestinationOrigin))fail('X04_POLICY_MISMATCH');
 if(nowMs>end||nowMs<start-SKEW_MS)fail('X04_EXPIRED_OR_NOT_YET_VALID');
 if(previousNonces.includes(statement.nonce))fail('X04_REPLAY_HOLD');
 const valid=await cryptoProvider.subtle.verify(ecdsa,pinnedPublicKey,signature,signBytes(statement));
 if(!valid)fail('X04_SIGNATURE_INVALID');
 if(!(bundleBytes instanceof Uint8Array))fail('X04_BUNDLE_REQUIRED');
 const {received,manifest,bundleSha256}=await buildBound({bundleBytes,expectedProjectId,
  expectedHandoffId,JSZip,DOMParser,cryptoProvider});
 if(statement.snapshotId!==manifest.sourceSnapshotId||statement.sourceRevision!==received.revision||
  statement.projectSha256!==manifest.projectSha256||
  statement.activityAreasSha256!==manifest.activityAreasSha256||
  statement.kmzSha256!==manifest.kmzSha256||statement.bundleSha256!==bundleSha256)
  fail('X04_SIGNED_CONTENT_MISMATCH');
 return Object.freeze({status:'LAB_X04_PINNED_KEY_VERIFIED_HOLD',
  signatureMatchesInjectedKey:true,claimsMatchProject:true,
  productionReady:false,writeAllowed:false,originAuthenticated:false,
  authorizedSender:false,replayProtectionDurable:false,
  requiresTrustRegistry:true,requiresApproval:true,
  sourceRevision:received.revision,nonce:statement.nonce,
  reason:'X04_TRUST_BINDING_AND_AUTHORIZATION_UNAPPROVED'});
}