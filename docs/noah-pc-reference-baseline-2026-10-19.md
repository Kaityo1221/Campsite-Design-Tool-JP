# Campsite Noah: PC Reference Baseline (2026-10-19)

Status: **FROZEN REFERENCE CANDIDATE / PR REVIEW ONLY** (not a public-release or device-completion approval)  
Source snapshot: **main@0e73b4984fc3719f1a4ee08c35854d8f76ff3397**, merged on **2026-10-18**, including PR #369 and PR #370.  
Owner of a change to the shared contract: **product owner approval + cross-device regression**.  
Scope: Wayfarer observation -> Bridge handoff -> Project -> Creative references and KMZ.  
Out of scope: platform-specific screen interaction, extension installation, Apple Shortcuts, live-device certification, Creative Next r31 production approval.

## 1. Reference hierarchy and boundaries

1. **This pinned PC snapshot is the reference implementation for shared behavior**, not a claim that all of its UI, bugs or unfinished features should be copied to mobile.
2. Existing project contract: docs/bridge-project-contract-v1.md. Frozen observation product intent: docs/wayfarer-observe-flow-spec-v1.md. If a mismatch is found, STOP and submit an explicit contract-change proposal instead of silently adjusting Android/iPhone or rewriting either existing contract.
3. iPhone Safari and Android Firefox may use different polygon input and transport mechanisms. The **same observation semantics, completeness gates, POI eligibility, receiver protocol, Project data ownership and reference-only protection** apply.
4. Do not mark the entire new flow production-ready on the basis of these static and synthetic regressions. No main, publicly distributed XPI/Shortcut, existing KMZ, user Project storage, approved r31 UI or other production code is changed by this baseline PR.

## 2. Frozen shared invariants

| ID | Common invariant | Source at pinned commit |
|---|---|---|
| R01 | One confirmed design polygon per Project, 3 to 30 vertices; self-intersection is invalid. PC uses map clicks, mobile may use a central crosshair. | bridge-pc/wayfarer-polygon-controller.js; docs/wayfarer-observe-flow-spec-v1.md |
| R02 | The polygon, not the visible viewport/zoom, determines acquisition bounds: polygon **plus 200m**, with tiles bounded at **500m**. | bridge-pc/wayfarer-acquisition-engine.js; bridge-pc/wm3-observe-controller.js |
| R03 | Geometry, transport, and source completeness are separately evaluated. Missing source verification cannot become coverageComplete=true by inference, HTTP 200 or JSON parse success alone. | bridge-pc/wayfarer-acquisition-engine.js |
| R04 | Zone assignment is INTERIOR, REFERENCE_100 (0 to +100m), RESERVE_200 (+100 to +200m), OUTSIDE. Only interior and 100m exterior are normally visible; reserve is retained and hidden. | bridge-pc/wayfarer-observation-zone.js |
| R05 | Relevant observed types are active PokéStop, Gym, PowerSpot and explicitly identified inactive PowerSpot. Unrelated NOT_IN_GAME Wayspots are excluded, not silently converted into active editable POIs. Stable GUID/poiId identity controls deduplication. | bridge-pc/wayfarer-observation-zone.js; bridge-pc/bridge-v1-exporter.js |
| R06 | Existing Receiver transport is CAMPSITE_BRIDGE_POI_V1, schemaVersion 1.2, with READY/ACK and a matching handshakeId; no platform-only protocol fork. | docs/bridge-pc-minimum-spec-v1.md; bridge-pc/bridge-v1-exporter.js |
| R07 | Project storage key is campsiteProject.v1, Project schema 1.0 with optional wayfarerObservation. The observation is a snapshot separate from editable currentPois/records. Handoff and project identities must match on restore/rework. | docs/bridge-project-contract-v1.md; js/bridge-next-flow.js |
| R08 | Inactive observations can be read in referencePois or wayfarerObservation.zones, deduplicated against active GUIDs; counting or exporting them must **not** promote them into editable records/currentPois. | js/bridge-observation-inactive.js; creative/wayfarer-reference-layer-patch.js |
| R09 | Inactive reference POIs from the visible interior and 100m reference zone export to a **separate read-only KMZ folder** with campsite-reference-only=true; RESERVE_200 does not export. A subsequent import skips tagged Placemarks as editable POIs. | creative/wayfarer-reference-layer-patch.js |
| R10 | If the current design polygon can no longer be covered by a saved observation, do not silently export stale observation references. Demand a fresh observation instead. | creative/wayfarer-reference-layer-patch.js |
| R11 | Turning 50m circles OFF hides circles on both editable and Wayfarer reference POIs. Markers, 40m/30m independent settings and distance warnings remain unaffected. | creative/wayfarer-reference-layer-patch.js; PR #369 |

### October 18 acceptance fixture (not expected counts in every real location)

- Synthetic input: **17 active POIs + 100 inactive Power Spots** in observation zones: 50 INTERIOR, 40 REFERENCE_100, 10 RESERVE_200.
- Receiver's inactive observed count: **100**. Visible inactive count: **90**. Hidden reserve count: **10**.
- With otherwise valid complete Project and no editable GUID collision, reference-only KMZ includes **90** inactive references, not 100. Reserve 10 stay out.
- Duplicate/invalid/reference-vs-active GUIDs must not inflate counts. References must not enter editable records/currentPois.
- This fixture is a regression test from PR #370, not a guarantee that all GCS data in a real session are complete.

### October 18 50m behavior

- 50m OFF must remove reference *circle-50* scene items while retaining reference markers; other circle radii are not controlled by this switch.
- PR #369 recorded Chrome synthetic real-browser 11/11 PASS. This is not a logged-in Wayfarer live-device proof.

## 3. Comparison contract for iPhone and Android

Both device-specific implementations must supply evidence for R01-R11. Record **PASS / FAIL / NOT TESTED** separately for each invariant, including input, output, test device/build, and artifact/CI evidence. Do not substitute source-code presence for a device PASS.

- iPhone: PC acquisition engine reuse is explored by I4-4, but real GCS response semantics and I4-5 normalization are **not yet verified**. iPhone current production Shortcut and isolated I4 test are distinct.
- Android: N4 PR #338 includes an unsigned 0.3.7 candidate aligned to PC geometry, acquisition and Observation/Receiver contracts. The published signed 0.3.5 remains distinct. Do **not** assume N4 is approved or device-tested.
- Creative Next r31 and linked Project+KMZ save remain Phase 1 HOLD and are not approved merely because the PC reference is pinned.

## 4. Known stop gates (do not hide them with a green baseline check)

- **X-01:** current creative/bridge-project-patch.js can derive project.polygon from the first Creative activity polygon. Design polygon and activity areas require explicit separate ownership before formal 3-tool release.
- **X-04:** campsiteProject.v1 and NEW_V1 KMZ are not interchangeable complete containers. Their approved lossless Project+KMZ persistence/restore contract is still pending.
- Live Wayfarer GCS verification, iPhone and Android real devices, re-observation 3-way diff, full cross-device transfer/reload and mainline Noah release are not certified by this baseline.
- The latest public PC reference snapshot includes PR #370; future PC implementation changes must not silently redefine mobile acceptance rules.

## 5. Evidence and enforcement

Baseline static guard: scripts/check-noah-pc-reference-baseline.mjs. Dedicated CI: .github/workflows/noah-pc-reference-baseline.yml.

Run existing behavioral regressions (unchanged): 
- scripts/check-pc-bridge-spec.mjs
- scripts/check-wayfarer-acquisition-engine.mjs
- scripts/check-wm3-observation-zone.mjs
- scripts/check-wm3-observe-controller.mjs
- scripts/check-bridge-v1-export.mjs
- scripts/check-bridge-observation-inactive.mjs
- scripts/check-wm5a-reserve-coverage.mjs
- scripts/check-wm5b-local-reclassification.mjs
- scripts/check-wm6b-reference-distance.mjs

A green CI verifies the documented code-level contract and these regressions, **not** authenticated GCS, production deploy, physical device equivalence, or end-to-end release readiness.

## 6. Change control

1. Keep the pinned 2026-10-18 commit and this revision immutable as historical evidence. To adopt a future PC reference, create a **new dated baseline revision**; do not rewrite the meaning of the old one.
2. Require an explicit PO review showing why the change is desirable, affected invariants R01-R11, any data migration or compatibility issues, and PC/iPhone/Android test impact.
3. Require the CI gate plus physical-device validation for changed platform paths. Failing or missing evidence is HOLD, never silent PASS.
4. This PR is documentation/QA only. **Do not merge or deploy it automatically**; review first. It introduces no admin switch or production route changes.
