# Creative Next | Phase 2 activity-area membership (isolated checkpoint)

**2026-10-09 JST. NON-PRODUCTION: DO NOT MERGE / DEPLOY.**

Repository: `Kaityo1221/Campsite-Design-Tool-JP`, branch `feature/creative-next-kmz-phase1b-20261009`.

## Scope completed

- Added explicit `area-create` and `area-remove` commands to the isolated editor; edits require confirmation and are reversible in chronological Undo/Redo history alongside POI edits.
- Source-aware export can add a new activity-area Placemark (with immutable area ID and KML polygon) and completely remove an existing source area's Placemark without touching POIs, 30/40/50m distance circles, or unrelated ZIP attachments.
- A strict separation is maintained between activity area polygons and POI-owned distance-circle polygons.
- Create UI uses a numeric `lat,lng` per line form and cryptographic UUID; full drawing gestures on a real basemap are **not** claimed.
- Supports explicit zero-area exports and creating the first activity area. An area that has been removed from the current export is still present in the immutable original KMZ archived within the draft for Undo/recovery.
- Geometry self-intersection, degenerate polygons, repeated vertices, duplicate/impersonating IDs, unknown membership and unsupported source polygon structures reject safely. The preview uses a provisional maximum of 64 activity areas and a maximum of 512 vertices per area.

## Verification

- `node --test creative-next/phase-1b/test/*.test.mjs`: **195 passed, 0 failed** (184 previous + 11 activity membership tests).
- Private real Kasai source SHA-256: `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162` (source bytes never changed).
- **Six real-Kasai regression scripts PASS**, including 1 area -> 0 areas -> 1 new activity area while retaining 188 existing POIs, 25 new POIs and 213 circles. Undo, Redo, journal restore and non-KML asset byte comparison PASS; old `next-lab-creative-v7` unchanged.
- Simulated Chromium 390px DOM test: file preview -> explicit accept -> area creation -> deletion -> Undo -> Redo -> journal save PASS with isolated in-memory storage/crypto. This uses an in-page script bundle and canvas fallback, **not real native Leaflet**.
- Actual page navigation `data:`/URL was blocked in this execution environment by `net::ERR_BLOCKED_BY_ADMINISTRATOR`. Do **not** consider this a real-origin browser PASS.

## Pending gates

1. Native Leaflet + real basemap tiles, full map gesture UX (including graphical area draw), and browser URL-origin start.
2. Real native localStorage/crypto, multi-tab conflict, quota and sudden-close recovery across Chromium/WebKit (not mocked).
3. Full Phase 1-A/B/2 integrated UI regression and PO approval to start iPhone Safari tests.
4. PO acceptance of release only after Safari and public/legacy regression tests. `main` remains untouched.

**No private Kasai KMZ bytes are in the GitHub branch or the public source ZIP.**
