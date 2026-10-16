# X-04 trust, authorization, replay and persistence boundary | candidate HOLD

**2026-10-17 JST | PR #368 Draft | Phase 1 HOLD | No production deployment or permission grant**

## Why this was added

X-04 detached ECDSA verification checks that the exact bytes and claims match a separately pinned public key, but it does **not** authenticate the real user, prove Project access, or atomically prevent reused transfers and stale writes. The isolated Distance receiver currently creates **new** LAB records only. Neither module can authorize replacement of an existing Campsite Project or real return editing.

## Added disconnected implementation

- `creative-next/contracts/x04-commit-authority-boundary-lab.mjs`: proposed version-0 **value-only** envelope and claim-shape validator, usable to compare candidate approaches before an approval. No `fetch`, auth SDK, DB, IndexedDB, journal, production Project, or runtime UI access.
- `creative-next/qa/x04-commit-authority-boundary.test.mjs`: synthetic negative tests for wrong Project/Handoff scope, source revision and nonce evidence, expired requests, unexpected destination, replay flags, stale compare-and-swap revision, malformed fingerprint, false signer-authorization assumptions, and ROLLBACK intent without mutation.
- The existing isolated r31 GitHub Actions workflow now checks syntax and runs these tests. No release or deploy step is added.

## Candidate interface (NOT a ratified wire format)

A request proposes version, transport mode, operation, Project ID, Handoff ID, Snapshot ID, destination origin, source and base revision, three part SHA-256 base fingerprint, ZIP hash, nonce, issuedAt and expiresAt. All of these are *claimed fields*, not trusted attributes. Two alternative transport names are accepted for review only: `SIGNED_ZIP_CANDIDATE` and `SERVER_TICKET_CANDIDATE`. This does not decide between X04-A and X04-B.

The signature inspection candidate is recognized by its `LAB_X04_PINNED_KEY_VERIFIED_HOLD` status and required false authorization flags. This module does **not** run cryptographic verification; it receives only a caller-provided snapshot of that result. A malicious caller can fabricate the object. The `authorityClaim` and `storageClaim` objects are also inherently untrusted. Structural consistency is no proof of permission, freshness or a durable replay registry.

Regardless of every input, the only successful output is `LAB_X04_AUTHORITY_AND_CAS_SHAPE_REVIEWED_HOLD` with `productionReady:false`, `writeAllowed:false`, `authenticatedActor:false`, `projectAccessAuthorized:false`, `durableReplayConsumed:false` and `atomicRevisionCASPerformed:false`. No revision is actually allocated; `proposedRevision` is a calculated proposal.

## Required production authority ports (unimplemented)

1. An approved identity source and session-bound actor identity. No client claim may name its own trusted user or signing key.
2. A server-side Project owner/collaborator authorization check with revocation, operation scope, destination and audit policy.
3. A trusted receipt verifier for the selected X04-A signed-ZIP model **or** X04-B one-time ticket model. No sender-provided public key lookup. Review encryption/retention requirements for private data before transferring real content.
4. A **single atomic DB transaction** to check current Project revision and fingerprint, check and consume a unique nonce, authorize the actor, append immutable revision and audit entry, and commit or fail entirely. Never split replay registry and Project CAS into independent best-effort writes.
5. A separately ratified rollback protocol that creates a fresh revision rather than destroying the current revision, with inspected provenance and proven recovery.
6. Versioned migration policy and X-01 mapping approval before a real Distance binding.

## Explicit non-goals and blockers

- NO implementation of a trusted backend, grant checks, cryptographic trust registry, real ZIP receiver, transactional storage, or audit persistence.
- NO changes to `js/bridge-distance-project.js`, approved r31 UI, `campsiteProject.v1`, existing production IndexedDB or Wayfarer runtime.
- NO invented official X-01 mapping or 40m/50m policy.
- No real user files, authentication tokens or permanent keys in tests.
- Chromium/WebKit CI passing only proves isolated regression, **never Phase 1 release**.

**Status: Phase 1 HOLD. X-01 and X-04 remain unapproved. PR #368 must remain Draft and unmerged.**
