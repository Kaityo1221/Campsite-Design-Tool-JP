# Creative Next | Phase 2 isolated activity-area vertex editor

Date: 2026-10-09 JST  
Repository: `Kaityo1221/Campsite-Design-Tool-JP`  
Development-only branch: `feature/creative-next-kmz-phase1b-20261009`

**Status: ISOLATED DEVELOPMENT; NOT PRODUCTION READY; DO NOT MERGE OR DEPLOY.**

## Implemented

- Added `phase-1b/core/activity-areas.mjs` to operate exclusively on audited KML `campsite.creative.object=activity-area` with unique `campsite.creative.area-id` metadata. Owned distance-circle Polygons never enter the activity-area editor.
- Explicit move/insert-after/delete controls for one activity-area vertex at a time, with a minimum of 3 unique points, maximum of 512 and rejection of self-intersection, degenerate/zero-area polygons, out-of-range coordinates and dateline ambiguity. Unknown geometry extensions, inner holes, altitude modes/meaningful altitudes, or unusual boundary structures refuse editing. The original KMZ is never overwritten.
- Phase 1-B `exportNewV1Kmz` takes optional `areaEdits` and modifies only the selected activity-area coordinate ring, keeping the same unique `area-id`; unedited Placemarks, distance-circle ownership/shape and ZIP attachments are preserved. Output is re-staged and diagnosed. Every edited area ring is checked numerically after re-import.
- Isolated editor session supports `commandArea` with explicit confirmation and a chronological Undo/Redo timeline shared with POI changes. Live state previews are deeply copied. Two-generation journal stores a validated snapshot of changed area vertices, and resume validates this snapshot against the source before applying.
- `phase-2-preview/index.html` offers activity-area and vertex selectors with numeric coordinates and move / insert / delete buttons. POI/circle/map display is unchanged, with area outlines re-rendered through the existing view. **No draggable Leaflet vertex handles yet.**

## Verification

| Test | Actual result |
|---|---|
| Isolated Node suite `node --test test/*.test.mjs` | **176 PASS / 0 FAIL** (previous 160 plus 16 area tests) |
| Private original Kasai KMZ integrity | Same SHA-256 `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162` before/after |
| Private Kasai vertex edit | 17 -> 18 vertices, Undo/Redo, KMZ export/re-import and draft resume PASS |
| Original Kasai counts | Existing 188 / new 25 / owned circles 213 / activity areas 1 unchanged |
| All 213 original distance-circle polygon coordinate strings | **Exact match** after activity editing |
| Existing Creative Mode key `next-lab-creative-v7` | Not read/written or changed |
| Chromium 390px simulated-origin QA | Area 17->18->17 / Undo / Redo / save / resume / KMZ export PASS; former add-kind and circle tests also PASS |
| Browser normal URL + real IndexedDB/localStorage/crypto + actual Leaflet tile network | **NOT PASS / NOT TESTED** (headless harness uses `set_content` and mock storage/crypto) |
| iPhone Safari | **NOT TESTED** |

## Residual risks and next work

1. Finish actual Leaflet tile display, region controls and area drag editing with no conflicting map gestures, and test natural UI screen layouts on real browser origins.
2. End-to-end browser storage/quota/reload/tab-conflict and interrupted-save recovery tests; two-generation localStorage journal is **not a real multi-key atomic transaction**.
3. Additional geometry cases and activity-area creation/deletion remain separate design/implementation work; unknown legacy formats remain HOLD.
4. Wayfarer source → edited KMZ → My Maps roundtrip remains unverified; Chromium/WebKit URL-backed and iPhone Safari acceptance and user authorization are required before production.

**Private user KMZ bytes, transformed KMZ files and save snapshots are intentionally excluded from GitHub and all downloadable code archives.** Changes remain under `creative-next/` on the isolated branch only.
