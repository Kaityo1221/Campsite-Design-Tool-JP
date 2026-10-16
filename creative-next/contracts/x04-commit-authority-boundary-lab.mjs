/*
 * X-04: value-only inspection of a proposed intake/authorization/CAS boundary.
 * LAB ONLY. This module deliberately does NOT validate server signatures,
 * authenticate actors, consume nonces, open a DB, or authorize writes.
 * An attacker can forge any caller-supplied evidence object; this function
 * never turns a structurally consistent claim into permission.
 */
const fail=code=>{const error=new Error(code);error.code=code;throw error;};
const validId=x=>typeof x==='string'&&x.length>=1&&x.length<=128&&x.trim()===x;
const validSha=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const validRevision=x=>Number.isSafeInteger(x)&&x>=1;
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const validObject=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const fingerprintKeys=['projectSha256','activityAreasSha256','kmzSha256'];
const sameFingerprint=(a,b)=>validObject(a)&&validObject(b)&&
 fingerprintKeys.every(k=>own(a,k)&&own(b,k)&&validSha(a[k])&&a[k]===b[k]);
function origin(x){
 if(typeof x!=='string'||x.length>200||!x.startsWith('https://'))fail('X04_BOUNDARY_ORIGIN_INVALID');
 let u;try{u=new URL(x);}catch{fail('X04_BOUNDARY_ORIGIN_INVALID');}
 if(u.origin!==x||u.protocol!=='https:'||u.username||u.password)
  fail('X04_BOUNDARY_ORIGIN_INVALID');
 return x;
}
function iso(x){
 if(typeof x!=='string')fail('X04_BOUNDARY_TIME_INVALID');
 const n=Date.parse(x);
 if(!Number.isFinite(n)||new Date(n).toISOString()!==x)fail('X04_BOUNDARY_TIME_INVALID');
 return n;
}
const equal=(x,y,code)=>{if(x!==y)fail(code);};
/**
 * This is an INERT draft interface, not a trusted authorization service.
 * `authorityClaim` and `storageClaim` are untrusted proposed receipt shapes.
 * No inputs, including `signatureInspection`, can produce writeAllowed=true.
 */
export function inspectX04CommitAuthorityBoundaryLab({
 request,signatureInspection=null,authorityClaim,storageClaim,nowMs=Date.now()
}={}){
 if(!validObject(request)||request.version!==0||
  !['SIGNED_ZIP_CANDIDATE','SERVER_TICKET_CANDIDATE'].includes(request.transport)||
  !['REEDIT','ROLLBACK'].includes(request.operation)||
  ![request.projectId,request.handoffId,request.snapshotId,request.nonce].every(validId)||
  !validSha(request.bundleSha256)||!validRevision(request.baseRevision)||
  !validRevision(request.sourceRevision)||!sameFingerprint(request.baseFingerprint,request.baseFingerprint))
  fail('X04_BOUNDARY_REQUEST_INVALID');
 if(request.baseRevision===Number.MAX_SAFE_INTEGER)fail('X04_BOUNDARY_REVISION_OVERFLOW');
 origin(request.destinationOrigin);
 const issued=iso(request.issuedAt),expires=iso(request.expiresAt);
 if(!Number.isSafeInteger(nowMs)||expires<=issued||expires-issued>15*60*1000||
  nowMs<issued-2*60*1000||nowMs>expires)fail('X04_BOUNDARY_TIME_INVALID');
 if(request.transport==='SIGNED_ZIP_CANDIDATE'){
  if(!validObject(signatureInspection)||
   signatureInspection.status!=='LAB_X04_PINNED_KEY_VERIFIED_HOLD'||
   signatureInspection.signatureMatchesInjectedKey!==true||
   signatureInspection.claimsMatchProject!==true||
   signatureInspection.authorizedSender!==false||
   signatureInspection.writeAllowed!==false||
   signatureInspection.productionReady!==false||
   signatureInspection.replayProtectionDurable!==false||
   signatureInspection.sourceRevision!==request.sourceRevision||
   signatureInspection.nonce!==request.nonce)
    fail('X04_BOUNDARY_SIGNATURE_EVIDENCE_HOLD');
 }else if(signatureInspection!==null){
  fail('X04_BOUNDARY_TRANSPORT_EVIDENCE_MISMATCH');
 }
 if(!validObject(authorityClaim)||authorityClaim.decision!=='ALLOW_CLAIM_ONLY'||
  !validId(authorityClaim.actorId)||!validId(authorityClaim.grantId))
  fail('X04_BOUNDARY_AUTHORITY_CLAIM_REQUIRED');
 for(const field of ['projectId','handoffId','destinationOrigin','operation'])
  equal(authorityClaim[field],request[field],'X04_BOUNDARY_SCOPE_MISMATCH');
 if(!validObject(storageClaim)||!validRevision(storageClaim.currentRevision)||
  !sameFingerprint(storageClaim.currentFingerprint,request.baseFingerprint))
  fail('X04_BOUNDARY_STORAGE_CLAIM_REQUIRED');
 equal(storageClaim.projectId,request.projectId,'X04_BOUNDARY_PROJECT_MISMATCH');
 equal(storageClaim.currentRevision,request.baseRevision,'X04_BOUNDARY_STALE_REVISION');
 if(storageClaim.nonceAlreadyUsed!==false)fail('X04_BOUNDARY_REPLAY_HOLD');
 // Both server-granted Project access and atomic replay/CAS need independent
 // trusted implementations. These untrusted snapshots are insufficient.
 return Object.freeze({
  status:'LAB_X04_AUTHORITY_AND_CAS_SHAPE_REVIEWED_HOLD',
  transportMode:request.transport,
  proposedRevision:request.baseRevision+1,
  projectId:request.projectId,
  operation:request.operation,
  productionReady:false,writeAllowed:false,committed:false,
  authenticatedActor:false,projectAccessAuthorized:false,
  trustedTransportValidatedByThisModule:false,
  durableReplayConsumed:false,atomicRevisionCASPerformed:false,
  auditLogPersisted:false,rollbackPerformed:false,
  requiresTrustedIdentityProvider:true,
  requiresServerProjectAuthorization:true,
  requiresDurableReplayRegistry:true,
  requiresAtomicRevisionTransaction:true,
  requiresTrustedAudit:true,
  reason:'X04_NO_SERVER_TRUST_OR_TRANSACTION_COMMIT'
 });
}
