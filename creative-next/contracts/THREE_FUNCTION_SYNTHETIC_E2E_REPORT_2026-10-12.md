# Three-function synthetic E2E rehearsal, 2026-10-12

**State:** ISOLATED LAB PASS FOR SYNTHETIC MODULE CHAIN. **NOT** browser/UI, real Wayfarer, device or production three-feature E2E PASS.  
**Branch:** `feature/creative-next-three-function-synthetic-e2e-20261012`, based on PR #363 proof-of-concept.  
**CI:** GitHub Actions run [38209110535](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38209110535), SUCCESS.  
**Gate:** Phase 1 HOLD.

## What was actually executed

The new `creative-next/qa/three-function-synthetic-e2e.test.mjs` performs the following with synthesized locations and POIs; it imports **real repository runtime modules** rather than copying their logic:

1. `scripts/wm3b2d-pseudo-harness.mjs` runs the installed Creative ⇄ Wayfarer relay/observation controller code and a simulated GCS collector, then writes the observation to a **fake Project sessionStorage** (not a user's browser).
2. The WM3 observation-zone classifier creates `interior`, `reference100`, `reserve200` and explicitly complete acquisition metadata. A real Bridge `bridge-pc/bridge-v1-exporter.js` `makePayload()` exports the observation and the interior POI.
3. Creative's real `wayfarer-observation-adapter.js` suppresses the already-editable interior GUID, shows the outside 0–100m reference as **read-only**, and holds the 100–200m reserve separately and invisibly.
4. A **test-prepared** Creative record snapshot (not a live UI editing session) is written to a valid `NEW_V1` KMZ by `createFreshV1Kmz()`. The source/Project identity and existing/new POIs are supplied explicitly by the test. No automatic Wayfarer→Creative mapping is claimed.
5. `createLinkedPairLab()` and `reopenLinkedPairLab()` validate a separately supplied complete Project and the untouched KMZ, hashes, handoff IDs, known current POI matching, independent activity areas, and preserved unknown metadata.
6. The real `wayfarer-local-reclassification.js` and `wayfarer-reserve-coverage.js` evaluate small primary-polygon changes without overwriting the historical acquisition; beyond-reserve changes return `REFERENCE_OUT_OF_COVERAGE`.
7. Negative cases reject incomplete acquisitions, swapped snapshot identities, duplicate GUIDs and the invalid attempt to substitute a 31-vertex Creative activity polygon for a max-30 Wayfarer primary polygon.

**Evidence:** 8/8 new module-chain tests, 28/28 existing X-01/X-04 contract/pair tests, 45/45 existing fresh KMZ/activity area regressions, plus WM3 zone + WM3B pseudo relay/Project save + WM4A 2 lifecycle variants + WM5A/WM5B validations all PASS.

## Proven invariants in this LAB only

- `project.polygon` (4-vertex primary) is **distinct from** Creative's 31-vertex additional activity area.
- The Project's existing/edit state, `selectedPois/currentPois`, unknown additive metadata, `wayfarerObservation.polygon` and `acquisition.coverageComplete` survive in-memory pairing byte-equivalently.
- Original `NEW_V1` KMZ byte array stays unchanged; all archive inputs pass canonical staging and diagnosis before pairing.
- Outer reference and reserve GUIDs never become `currentPois` or editable Creative records.
- Changed reference geometry within the verified covered region can be reclassified locally; beyond coverage must request reacquisition.
- The experimental pair is always `productionReady:false`, has no persistence effects and cannot authorize release.

## Boundaries that this test DOES NOT cross

| Gate | Current result | Next proof needed |
|---|---|---|
| Wayfarer real login, GCS collector, zoom-independent +200m completeness | NOT TESTED: collector simulated | WM-1 real live controlled verification |
| New polygon creation and receiver into `campsiteProject.v1` | PARTIAL: Project already present in simulated sessionStorage; Bridge exporter real, receiver UI not executed | WM2/WM4 full UI-driven handoff, no intermediate mock |
| Creative Next actual editor actions and unified scene | NOT TESTED: test snapshot fabricated, not entered through r31 UI | Isolated r31 UI/single Session with user-confirmed import/edit |
| Main project polygon vs activity areas on Creative save | **OPEN HAZARD:** `creative/bridge-project-patch.js` currently picks first `polygons` entry for `project.polygon` | Separate explicit design-polygon channel before real integration |
| KMZ as project transfer format | NOT APPROVED: only paired Project JSON + existing `NEW_V1` KMZ | PO decision on versioned sidecar vs KML envelope; persistence/recovery |
| Re-observation Base/Local/Remote and 2-snapshot disappearance | NOT TESTED: referenced WM7 diff scripts exist, but their runtime modules were not found in this tested branch | Source availability and controlled 3-way diff E2E |
| PC / Android / iPhone real operation | NOT TESTED | Device-specific tests after integration |
| old Creative/Production main and save keys | UNTOUCHED | Explicit later release approval, rollback plan |

## Implementation rules for next stage

1. Do not mutate the r31 approved UI, production Creative, Wayfarer runtime, or existing Project storage in an uncontrolled integration.
2. Complete X-01's **explicit design polygon vs area** ownership and safe separate in-memory representation. The current first-area extraction hazard is an integration blocker.
3. Define and ratify X-04's sidecar/linked-project vs embedded-project envelope choice; the present LAB implementation is a candidate, not a decision.
4. Add a truly isolated 3-screen browser harness that exercises actual Wayfarer→Bridge receiver→Creative Next Session→Project/Campsite return; then extend to re-observation conflict resolution.
5. Retain incomplete/ambiguous input HOLD, original KMZ provenance, external reference read-only protection, and no automatic source overwrite.

No Phase 1 gate changed as a result of this report.
