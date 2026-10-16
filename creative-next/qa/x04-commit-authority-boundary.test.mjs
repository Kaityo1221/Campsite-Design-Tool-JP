/* No real users, networks, DB, signing keys, or production storage. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectX04CommitAuthorityBoundaryLab as inspect}
 from '../contracts/x04-commit-authority-boundary-lab.mjs';
const hash=n=>String(n).repeat(64);
const fingerprint={projectSha256:hash('a'),activityAreasSha256:hash('b'),kmzSha256:hash('c')};
const now='2026-10-17T00:00:00.000Z';
const request={version:0,transport:'SIGNED_ZIP_CANDIDATE',operation:'REEDIT',
 projectId:'project-synthetic',handoffId:'handoff-synthetic',snapshotId:'snapshot-synthetic',
 nonce:'nonce-only-synthetic',bundleSha256:hash('d'),baseRevision:4,sourceRevision:3,
 baseFingerprint:fingerprint,destinationOrigin:'https://example.net',
 issuedAt:now,expiresAt:'2026-10-17T00:10:00.000Z'};
const signatureInspection={status:'LAB_X04_PINNED_KEY_VERIFIED_HOLD',
 signatureMatchesInjectedKey:true,claimsMatchProject:true,authorizedSender:false,
 productionReady:false,writeAllowed:false,replayProtectionDurable:false,
 sourceRevision:3,nonce:request.nonce};
const authorityClaim={decision:'ALLOW_CLAIM_ONLY',actorId:'synthetic-actor',grantId:'synthetic-grant',
 projectId:request.projectId,handoffId:request.handoffId,
 destinationOrigin:request.destinationOrigin,operation:request.operation};
const storageClaim={projectId:request.projectId,currentRevision:4,
 currentFingerprint:fingerprint,nonceAlreadyUsed:false};
const input=()=>({request:structuredClone(request),signatureInspection:structuredClone(signatureInspection),
 authorityClaim:structuredClone(authorityClaim),storageClaim:structuredClone(storageClaim),
 nowMs:Date.parse(now)});
const checkError=(change,code)=>{
 const x=input();change(x);assert.throws(()=>inspect(x),{code});
};
test('matching synthetic shapes remain HOLD, never grant authorization or writes',()=>{
 const x=input(),copy=structuredClone(x);
 const result=inspect(x);
 assert.equal(result.status,'LAB_X04_AUTHORITY_AND_CAS_SHAPE_REVIEWED_HOLD');
 assert.equal(result.proposedRevision,5);
 for(const k of ['productionReady','writeAllowed','committed','authenticatedActor',
  'projectAccessAuthorized','durableReplayConsumed','atomicRevisionCASPerformed','auditLogPersisted'])
  assert.equal(result[k],false,k);
 assert.deepEqual(x,copy);assert(Object.isFrozen(result));
});
test('even fabricated authority claim and fabricated signature cannot authorize a commit',()=>{
 const result=inspect(input());
 assert.equal(result.projectAccessAuthorized,false);
 assert.equal(result.trustedTransportValidatedByThisModule,false);
 assert.equal(result.requiresServerProjectAuthorization,true);
});
test('request/format validation fails closed',()=>{
 checkError(x=>x.request.version=1,'X04_BOUNDARY_REQUEST_INVALID');
 checkError(x=>x.request.transport='LIVE_PRODUCTION','X04_BOUNDARY_REQUEST_INVALID');
 checkError(x=>x.request.bundleSha256='bad','X04_BOUNDARY_REQUEST_INVALID');
 checkError(x=>x.request.baseFingerprint.projectSha256='bad','X04_BOUNDARY_REQUEST_INVALID');
 checkError(x=>x.request.baseRevision=Number.MAX_SAFE_INTEGER,'X04_BOUNDARY_REVISION_OVERFLOW');
 checkError(x=>x.request.destinationOrigin='http://example.net','X04_BOUNDARY_ORIGIN_INVALID');
 checkError(x=>x.request.destinationOrigin='https://example.net/path','X04_BOUNDARY_ORIGIN_INVALID');
 checkError(x=>x.request.expiresAt='2026-10-17T01:00:00.000Z','X04_BOUNDARY_TIME_INVALID');
 checkError(x=>x.nowMs=Date.parse('2026-10-18T00:00:00.000Z'),'X04_BOUNDARY_TIME_INVALID');
});
test('signed ZIP mechanics are explicitly distinct from sender authorization',()=>{
 checkError(x=>x.signatureInspection.authorizedSender=true,'X04_BOUNDARY_SIGNATURE_EVIDENCE_HOLD');
 checkError(x=>x.signatureInspection.sourceRevision=99,'X04_BOUNDARY_SIGNATURE_EVIDENCE_HOLD');
 checkError(x=>x.signatureInspection.nonce='different','X04_BOUNDARY_SIGNATURE_EVIDENCE_HOLD');
 checkError(x=>x.signatureInspection.replayProtectionDurable=true,'X04_BOUNDARY_SIGNATURE_EVIDENCE_HOLD');
 checkError(x=>x.signatureInspection=null,'X04_BOUNDARY_SIGNATURE_EVIDENCE_HOLD');
});
test('scope and owned Project boundaries reject mismatches',()=>{
 checkError(x=>x.authorityClaim=null,'X04_BOUNDARY_AUTHORITY_CLAIM_REQUIRED');
 checkError(x=>x.authorityClaim.decision='DENY','X04_BOUNDARY_AUTHORITY_CLAIM_REQUIRED');
 checkError(x=>x.authorityClaim.projectId='different','X04_BOUNDARY_SCOPE_MISMATCH');
 checkError(x=>x.authorityClaim.handoffId='different','X04_BOUNDARY_SCOPE_MISMATCH');
 checkError(x=>x.authorityClaim.destinationOrigin='https://other.net','X04_BOUNDARY_SCOPE_MISMATCH');
 checkError(x=>x.authorityClaim.operation='ROLLBACK','X04_BOUNDARY_SCOPE_MISMATCH');
});
test('revision/nonce preflight rejects stale and replayed transfers',()=>{
 checkError(x=>x.storageClaim.currentRevision=5,'X04_BOUNDARY_STALE_REVISION');
 checkError(x=>x.storageClaim.currentFingerprint.kmzSha256=hash('e'),'X04_BOUNDARY_STORAGE_CLAIM_REQUIRED');
 checkError(x=>x.storageClaim.projectId='different','X04_BOUNDARY_PROJECT_MISMATCH');
 checkError(x=>x.storageClaim.nonceAlreadyUsed=true,'X04_BOUNDARY_REPLAY_HOLD');
 checkError(x=>x.storageClaim.nonceAlreadyUsed=undefined,'X04_BOUNDARY_REPLAY_HOLD');
});
test('ticket alternative is only a candidate and is never self-attested',()=>{
 const x=input();x.request.transport='SERVER_TICKET_CANDIDATE';x.signatureInspection=null;
 const r=inspect(x);assert.equal(r.writeAllowed,false);
 assert.equal(r.authenticatedActor,false);
 checkError(x=>{x.request.transport='SERVER_TICKET_CANDIDATE'},'X04_BOUNDARY_TRANSPORT_EVIDENCE_MISMATCH');
});
test('ROLLBACK is a labeled intent only; never silently applies an older snapshot',()=>{
 const x=input();x.request.operation='ROLLBACK';x.authorityClaim.operation='ROLLBACK';
 const r=inspect(x);assert.equal(r.operation,'ROLLBACK');
 assert.equal(r.rollbackPerformed,false);
});
