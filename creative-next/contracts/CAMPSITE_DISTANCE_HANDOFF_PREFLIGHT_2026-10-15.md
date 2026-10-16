# Campsite Distance handoff preflight, isolated READ-ONLY LAB

**2026-10-15 JST** | PR #368 Draft | Phase 1 HOLD | **No production runtime changes**

## Current real Campsite Distance code investigated

File `js/bridge-distance-project.js` is the real legacy Project → Distance source. It reads `sessionStorage['campsiteProject.v1']`, derives Distance layer groups from POIs, assigns Distance globals and writes results back into the Project. It is **not** safe to attach the Creative Next portable ZIP as an unreviewed direct import.

Two concrete cross-contract hazards were observed in source:

1. `buildLayerPoints()` chooses `currentPois` **only if nonempty** and otherwise falls back to `selectedPois`. A legitimate all-deleted Creative state might therefore resurrect originally selected POIs if reused without a strict adapter. The isolated `stageCurrentPoisLab()` never uses that fallback and explicitly holds it.
2. `populateDistanceUi()` currently assigns `window._activityPolygons = [project.polygon]`, treating the project's **design polygon** as a Distance activity polygon. In Creative Next, `project.polygon` is the sole Wayfarer/Campsite **design/acquisition target**, `wayfarerObservation.polygon` is the **historical acquisition** polygon, and `activityAreas[]` holds independent Creative activity polygons. The existing Distance binding must not claim that these are interchangeable. A nonempty independent activity area is flagged `DISTANCE_X01_ACTIVITY_AREA_MAPPING_HOLD`, never auto-merged or discarded.

Related hazards: legacy `entityOf` silently defaults unknown types to POKESTOP; `roleOf` guesses from `layer`; `toDistancePoint` coerces coordinates to numbers. The new staging rejects unsupported kind/role, missing stable IDs, duplicate identities or invalid coordinates before any legacy runtime mapping.

## New isolated staging path

`creative-next/contracts/campsite-distance-return-stage-lab.mjs` takes only a complete linked Project+NEW_V1 pair already verified by `inspectCampsiteReturnLab`. It returns a **typed, copied, immutable read-only preview** with:

- Distance layer groups matching `buildLayerPoints` for unambiguous POIs;
- exact `project.polygon` design vertices, historical `wayfarerObservation.polygon` acquisition vertices, independent `activityAreas`;
- current/added POI counts, preserved identity/Active-Inactive/provenance;
- `recomputeDistanceRequired:true`; old distance results are never declared current after a Creative edit.

Crucially, the result always states `productionReady:false`, `writeAllowed:false`, `legacyDistanceCommitAllowed:false`, `legacyActivityPolygonMapping:'UNAPPROVED'`. There is **no call** to `runDistanceCheck`, no mutation of `_layerPoints` or `_activityPolygons`, and no write to `campsiteProject.v1` or localStorage.

The separate `creative-next/qa/campsite-return-lab/` read-only UI now shows an additional **距離チェックへ渡す前の確認** section after an accepted same-origin row or portable-file ZIP. Both remain under a dedicated non-production protected preview. The UI is a diagnostic, not the actual Campsite Distance view.

## Tests

`creative-next/qa/campsite-distance-return-stage.test.mjs` instruments **functions from the unchanged real `js/bridge-distance-project.js` in a VM**, and checks layer-group equivalence on strict inputs, the legacy empty-`currentPois` fallback, the current real `_activityPolygons` mapping, loss-prevention input guards, and the independent 31-vertex Creative activity area remaining separate from a 4-vertex design polygon.

`creative-next/qa/three-function-r31-browser-lab.cjs` additionally checks that the read-only Distance preflight is present after both same-origin save→return and different-origin user-mediated ZIP import, while no recipient DB/production Project is created. Two mobile-size Chromium viewports (390×844, 393×852) and packed-preview artifacts are CI-gated. WebKit simulator and on-device iPhone/Android results must be called out separately.

## Gates before approving real Distance connection

- **PO X-01**: decide how independently owned Creative activity areas relate to the existing Distance activity polygon UI, including zero and many areas; never silently use the first polygon or substitute the design polygon.
- **PO X-04**: ratify versioned portable transfer and trusted cross-origin receipt, provenance/tombstones, inactive state, source correctness and security.
- Make legacy Distance import read a *verified*, explicit Project/area payload under a new reviewed route and a confirmation-gated staged transaction. Keep `campsiteProject.v1` rollback-safe, preserve user edits and prevent stale two-tab updates.
- Recompute actual distances only after a real user-confirmed import and comparison with existing Distance outputs. Test full save/reopen/rework, WebKit/Android real devices, and a manual rollback before release.
- Do not merge PR #368 or modify production/main/frozen r31 while any gate is unapproved.

**No implementation in this LAB constitutes production Project import approval.**

## X-01 / X-04 safety matrix after round-trip LAB (2026-10-16, unapproved)

A separate test-only matrix now verifies **zero, one, and two** independently identified Creative activity polygons against a separate design polygon and historical acquisition polygon. These three channels are kept byte-equivalent through NEW_V1 pair verification and read-only Distance staging. The existing Distance source still overloads `_activityPolygons` with the design polygon. In the unapproved adapter, **all three cardinalities remain blocked for live import**; counts 1 and 2 additionally report `DISTANCE_X01_ACTIVITY_AREA_MAPPING_HOLD`.

The manual portable ZIP intentionally carries no signature, sender secret, trusted certificate, signed-origin attestation, or server authentication. The contract now explicitly marks `transportAuthenticated:false` and `producerIdentityVerified:false`. Matching manifest SHA-256 checksums do not prove who assembled a ZIP or establish higher-trust provenance; do not treat matching Handoff ID as authentication. Formal X-04 must decide authorized principals and trusted origin binding before deployment.

**Release still HOLD:** no automatic polygon promotion, no real Distance call or Project save, no source trust upgrade, no format approval or migration. All experiments use synthesized data only.

## X-01/X-04 generation transition dry run, Phase 1 HOLD (2026-10-16 JST)

New isolated module `creative-next/contracts/x01-x04-transition-gate-lab.mjs` does **not** open storage or touch any real Distance UI. It emits a non-writable proposal only.

- X-01: require the operator to explicitly supply the complete, ordered list of activity-area IDs, including an explicit empty list if there are none. Omitted, duplicated or unrecognized IDs block the dry run. Preserve the design polygon and observation polygon in their own typed fields; never populate `_activityPolygons` or approve one/many area runtime mapping.
- X-04: verify the complete current canonical Project+KMZ pair, compare an expected revision and all three canonical SHA-256 fingerprints, and verify the proposed next pair. A stale writer or changed base content fails closed. A rollback preview additionally requires a separately verified older source revision and matching candidate hashes; **no storage mutation or rollback occurs**. New revisions are proposals only.
- Changes to the Wayfarer observation or the design polygon remain HOLD until WM-7 and X-01 are approved. The LAB transport remains unauthenticated, even after hashes match. A provisional successful review is **not** a commit authorization.
- New tests `creative-next/qa/x01-x04-generation-transition.test.mjs` run in CI beside the existing boundary matrix, with synthetic data only.

Formal X-01 area semantics, X-04 authorized sender / signed transfer, real multi-generation transactional persistence and rollback remain intentionally unimplemented. This adds executable safety gates, not an approved production contract.

## WebKit browser parity expansion (LAB only; 2026-10-16)

Run the same synthetic three-function browser flow using the macOS Playwright WebKit engine at 390×844 and 393×852, in addition to the existing separate r31 Project save UI test. It must verify the actual frozen r31 iframe, manual portable download into a distinct receiver origin, create-only consent, CAS conflict, readback, Project and NEW_V1 re-download, re-import, new POI edit and separate successor pair, original receipt protection. No live Wayfarer collector, physical iPhone Safari, Android or production runtime is implied. The expanded job remains within the same protected non-deployed preview in CI.
