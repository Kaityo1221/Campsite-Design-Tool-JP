# X-01/X-04: Project + KMZ linked pair rehearsal (LAB only)

**Date:** 2026-10-12 JST  
**Status:** isolated proposal, not adopted as a production serialization format.  
**Base:** PR #362 contract audit, branching from `db853eab21343b46ae951fae3c3def46d3efaf26`.  
**UI:** approved r31 remains unchanged.

## Purpose

The frozen Wayfarer contract treats `campsiteProject.v1` as the canonical project state, including the current design polygon, stable IDs and optional `wayfarerObservation` (historical observation polygon, full/partial acquisition, interior/reference/reserve POIs and Active/Inactive state). The Creative Next `NEW_V1` KMZ represents current Creative POIs and independent activity areas but does not safely encode the whole project.

We must not infer the primary design polygon from the first Creative activity area, or turn the current KMZ into a complete Wayfarer observation database.

## Isolated candidate A: explicitly linked Project + unchanged KMZ

The new `linked-project-kmz-lab.mjs` is an **in-memory prototype only**:

1. Take a separately supplied `campsiteProject.v1` object, Creative `activityAreas` list and verified `NEW_V1` KMZ bytes, plus the caller's **expected project ID and handoff ID**.
2. Fail closed on unsupported JSON values, missing/malformed observation, `coverageComplete !== true`, design polygon over 30 vertices, activity area over 512 vertices or over 64 areas, duplicate IDs, unverified KML/KMZ, any staged activity-area mismatch, or unmapped `currentPois` identity/type/coordinates.
3. Preserve **all project fields** in a separate JSON snapshot, including `wayfarerObservation.zones.reserve200`, PowerSpot Active/Inactive, provenance and unknown project fields. Preserve **all KMZ bytes verbatim** in an independent copy.
4. Compute SHA-256 of each exact JSON snapshot and KMZ byte copy. Bind an experimental `kind/version=0` manifest to the expected project/handoff and observation snapshot ID.
5. Reopen only with explicit matching caller project/handoff IDs and matching checksums; rerun full strict staging/diagnosis and all field-matching checks before reporting `LAB_PAIR_VERIFIED`.
6. Return `productionReady:false` for all successful results. No object is written to disk, browser storage, Session, a GitHub Page or the original KMZ by the module.

This proves a **possible zero-loss pairing transport**, NOT an automatic Project-to-KMZ field conversion and NOT a release-ready serial format. The manifest and its fields require PO review before any permanent use.

## What the proof does and does not cover

| Item | Outcome/limit |
|---|---|
| Primary `project.polygon` vs independent activity areas | Preserved separately; no first-area inference |
| Existing/new POIs | Strict one-to-one subset matching by stable GUID/ID, role, kind, title, coordinates; fail if different |
| Inactive PowerSpot and hidden reserve | Preserved in Project context rather than inferred from generic KMZ `kind=power` |
| Original KMZ | Byte-for-byte retained. ZIP/KML staging and NEW_V1 diagnosis before and after |
| Archived Project snapshot | JSON captured with unknown fields and checksummed; no key writes |
| Corruption, swapped pair, IDs, missing POIs | Fail closed |
| Browser save, IndexedDB, multi-tab race, user exports | **NOT IMPLEMENTED OR TESTED** by linked pair |
| Re-observation and Base/Local/Remote merge | **NOT IMPLEMENTED** |
| Existing r31 data if its Project metadata is absent | **HOLD**, no guessing |
| Full three-feature E2E and PC/Android/iOS actual parity | **NOT PASS** |
| Native PowerSpot metadata in NEW_V1 | Not added; preserved only in linked Project JSON |

## Open PO decisions

1. **X-01:** Is primary `project.polygon` always the single current design polygon while activity areas live independently? How should the primary be separately edited in UI?
2. **X-04:** Should project context be carried via an explicitly bound sidecar/project snapshot, or must a future KMZ envelope encode it? This LAB merely evaluates the former.
3. How will the linked pair survive real user file transfers, storage, revisions, isolated workflows, extra resources, and legacy compatibility?
4. How do we handle ambiguous or *partially* overlapping current Project and KMZ POI sets? This prototype rejects the case, rather than remapping by names or positions.

The next work after review is an independently versioned adapter contract with atomic, source-aware persistence/restore and full 3-feature E2E. Production `main`, old Creative Mode, confirmed r31 UI branch, old preview URLs, original KMZs and their save keys remain untouched. Phase 1 HOLD persists.
