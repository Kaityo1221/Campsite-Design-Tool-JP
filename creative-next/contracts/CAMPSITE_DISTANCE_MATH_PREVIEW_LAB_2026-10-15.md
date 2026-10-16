# Campsite Distance actual-math comparison / read-only LAB

**Date:** 2026-10-15 JST  
**Branch:** `feature/creative-next-r31-confirmed-project-save-ui-20261012`, Draft PR #368  
**Release:** Phase 1 **HOLD**, production untouched, frozen r31 untouched.  
**Nature:** Genuine Distance **source logic** compared in a test VM. **Not** a real Campsite Distance UI handoff or approved score. Never upload actual member/Wayfarer data to this preview.

## Verified boundary / calculation under test

- A complete canonical `campsiteProject.v1` Project + NEW_V1 edit KMZ is cryptographically verified through the existing read-only receiver and strict Distance staging. Unknown/ambiguous POI, invalid identity, ambiguous activity polygon and incomplete acquisition remain HOLD.
- `creative-next/contracts/campsite-distance-math-preview-lab.mjs` computes a **diagnostic preview** using the exact WGS84-spherical radius `R=6,371,000m` and Haversine formula used by the unchanged `js/distance-core.js`. 50m is a **warning threshold**, never placement prohibition.
- Bands are <1m duplicate, <20m dense, 20–30m stay, 30–50m reference distance, exactly 50m or greater no warning.
- Cross-check with unchanged `js/distance.js` `runDistanceCheck`, exercised in a disposable VM with the real `getDistanceCheckMeters` and real layer filter. Mock DOM intercepts result, map, analytics and file upload side effects. **Never** execute this production script inside the public app during this QA.
- Project `polygon` (design) and `wayfarerObservation.polygon` (historic acquisition) remain distinct. `activityAreas[].points` are passed to the map-preview candidate **only** as activity polygons, preserving IDs and 31-vertex rings. The legacy live `populateDistanceUi` still uses `_activityPolygons=[project.polygon]`; this difference is not approved for release.
- Only editable `currentPois` pairs form the existing Distance warnings. `wayfarerObservation.zones.reference100` participates in a **separate, read-only** external reference warning pass; reserve200 remains hidden and never enters editable/layer groups.
- No `campsiteProject.v1` write; no distance-result persistence, analytics, KMZ upload, scored judgement, production Distance map, rework or pre-submit result is approved. Preview always reports `productionReady:false`, `writeAllowed:false`, `realDistanceResult:false`, `realDistanceScore:false`.

## Test cases

`creative-next/qa/campsite-distance-math-compat.test.mjs`:
1. Stage Project + NEW_V1 with one existing PokéStop, one new Gym, one new PowerSpot, one independent 31-vertex area; compare pair identities, 50m warnings and actual per-pair distances with real `runDistanceCheck`.
2. Ensure the actual Distance sandbox sees 31-vertex activity area, not the 4-vertex design polygon; keep historical acquisition separate.
3. Ensure read-only external reference contributes only to separate diagnostic warnings, not editable POIs. Never introduce reserve POIs.
4. Compare actual existing meter function and LAB calculation numerically at multiple coordinates.

`creative-next/qa/three-function-r31-browser-lab.cjs` checks the new count/band/reference UI appears after same-origin return and a different-origin user-selected ZIP transfer (both synthetic), including the allowlisted static preview package. The explicit message is **LAB計算プレビュー（本番判定ではありません）**.

## Real integration still gated

1. Owner acceptance for how zero/multiple **independent** activity areas should appear inside the actual Campsite Distance map and how design/acquisition polygons should be displayed, without silently merging channels.
2. Production receiver+transport format approval (X-04), confirmation-gated atomic import, rollback and protection of existing `campsiteProject.v1`.
3. Decide whether external Wayfarer Reference warnings are diagnostic-only vs included in scored Distance results. Existing legacy Distance score excludes reference100. Never quietly upgrade score semantics.
4. Actual browser DOM/Leaflet map & Distance end-to-end, event/analytics side effects controlled by genuine runtime, real iPhone/Android and WebKit parity.
5. Subsequent WM-7 diff/tombstones + WM-8 release gate. Until then Draft PR + HOLD.

**The comparison test must PASS in CI before any claim of mathematical parity.**
