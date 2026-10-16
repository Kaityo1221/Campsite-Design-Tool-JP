# X-01 / X-04 approval candidates, not an approved contract

Date: 2026-10-17 JST. PR #368 Draft. Phase 1 HOLD.

## X-01: polygon ownership and Distance semantics

Established from real source:
- project.polygon: current user design/selection target, vertex count 3-30.
- project.wayfarerObservation.polygon: immutable historical Wayfarer acquisition footprint.
- Creative activityAreas[]: separately identified polygons, zero/one/many, each 3-512 vertices, including observed 31-vertex areas.
- The unchanged legacy bridge-distance-project.js currently assigns _activityPolygons = [project.polygon] and can repopulate empty currentPois from selectedPois. That behavior MUST NOT be reused blindly.

Candidate X01-A (recommended for review, NOT approved): keep all three channels typed and separate in a versioned Distance import, including the explicit empty activityAreas array. The design polygon is neither an activity area nor an acquisition polygon. Activity-area IDs are exact, unique, ordered, and never silently dropped or substituted. Distance should render independent areas only through a reviewed explicit mapping, not from the first polygon. Reference100 is read-only for alerts, reserve200 never promoted to an editable POI.

Alternatives requiring explicit product decision: X01-B reuse current design polygon for legacy _activityPolygons and display Creative activity areas in a separate layer (risks confusing UI naming); X01-C switch the old Distance polygon to Creative areas (breaks zero-area cases and existing interpretation). No alternative may erase area IDs, merge zones or restore deleted POIs. Decision fields: mapping purpose, zero-area presentation, one/many display, vertex limits, re-edit behavior, backward compatibility, 40m prose vs 50m calculation consistency. No decision has been recorded.

## X-04: authenticated cross-origin portable return

Existing v0 lab ZIP: two files, linked-pair.json and creative-new-v1.kmz, with SHA-256 and Project/Handoff identities, and explicit manual transfer. It is unsigned and unauthenticated. Equality of a hash inside the ZIP does not authenticate its author.

Candidate X04-A (review only): a **detached signed attestation** over exact ZIP bytes plus the canonical project/area/KMZ hashes, projectId, handoffId, snapshotId, source revision, intended destination origin/audience, claimed sender and signing key identifiers, nonce, issue and expiry time. Prototype uses WebCrypto ECDSA P-256/SHA-256 and limits validity to 15 minutes. The verification key MUST be supplied from an independently approved, trusted registry, never loaded from the ZIP or an unauthenticated sender response. Reject wrong audience, origin, ID, signature, key, time, nonce and different exact ZIP bytes. Keep the legacy v0 ZIP unchanged during exploration; do NOT turn its inspection into release permission.

Candidate X04-B: a trusted backend-generated one-time handoff ticket, verified by a backend with per-Project access control, nonce, retention and audit; offline/manual transfer may require different UX. Product/security owner should decide if offline handoff is necessary.

Remaining blockers for either candidate:
1. Approve identity provider, signer authorization, per-Project owner rules, origin and destination allowlist, key lifecycle/revocation, and no client-issued identity proof.
2. Design confidential handling and consent for real Wayfarer/member data; ZIP is neither encrypted nor a secret safe.
3. Create atomic server-side replay registry, durable version conflict handling, trusted audit, lost-key/expired-ticket support and proven rollback.
4. Approve full manifest versioning, expiry/clock skew, tamper behavior, threat model and device compatibility.
5. Test authorized Wayfarer/WM-7+WM-8 and iPhone/Android hardware with safe feature flag OFF.

The isolated detached-signature module produces status LAB_X04_PINNED_KEY_VERIFIED_HOLD and always sets productionReady:false, writeAllowed:false, originAuthenticated:false, authorizedSender:false. A signature from a locally generated test key proves cryptographic mechanics only. It never proves platform origin, signer employment/permission, or Project ownership. No trust registry or private key is bundled. Tests generate throwaway keys and synthetic Projects.

## Approval record, intentionally blank

X-01 decision and owner: NOT APPROVED
X-04 selected transport and owner: NOT APPROVED
Security review: NOT APPROVED
Production migration/import: NOT APPROVED
Phase 1: HOLD

Continue only in isolation until explicit approval. Do not merge #368 or alter main, approved r31, live legacy Distance or current production project key.
