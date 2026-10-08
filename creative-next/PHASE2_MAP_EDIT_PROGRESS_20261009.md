# Creative Next | Phase 2 isolated map controls and safe map-edit proposals

Date: 2026-10-09 JST  
Repo: `Kaityo1221/Campsite-Design-Tool-JP`  
Branch: `feature/creative-next-kmz-phase1b-20261009`

**ISOLATED DEVELOPMENT ONLY. NOT PRODUCTION READY. DO NOT MERGE OR DEPLOY.**

## Completed in this iteration

- Independent **POI / owned distance circles / activity areas** layer-visibility controls. Hiding a layer only affects display, not canonical data, KMZ output, journal or Undo/Redo. Keyed Leaflet layer updates still reuse the same keys.
- **Map-click coordinate proposal** for new POI addition or new POI editing. The map fills the coordinate inputs; no POI or owned circle is changed until the user submits the edit/add form. Existing POI positions remain immutable.
- **Selected activity-area vertex handles** on the Leaflet preview. Clicking selects the numeric vertex; dragging proposes a coordinate update, requires an explicit browser confirmation, then passes through `commandArea` geometry validation and history. A rejected/cancelled proposal re-renders the original position.
- Editing handles disabled on read-only fallback recovery. Map controls preserve the canvas position-only fallback if Leaflet is not loaded. An additional map-fit control was added.
- No direct changes to imported source bytes; all work stays on the isolated UI and test files.

## Verified

| Item | Actual result |
|---|---|
| Original Phase 1-B isolated Node suite | 176/176 PASS baseline |
| New isolated Node suite | **184 PASS / 0 FAIL** (+4 renderer and +4 journal tests) |
| Private original Kasai KMZ regression | Five real-file scripts PASS when explicitly supplied the original KMZ path |
| Chromium 390px simulated-origin UI | Map layers, proposed coordinate cancellation, vertex drag confirm/reject/Undo PASS |
| Chromium 390px legacy preview regressions | Existing activity-area, source-aware POI add/kind and dependent-circle flows PASS |
| Phase 1-A original package | No code changes in this iteration |
| Legacy `next-lab-creative-v7` | Not touched; mock sentinel preserved |
| Chromium/WebKit normal browser URL | **NOT PASS / NOT TESTED** |
| Actual Leaflet library + OSM tile rendering over network | **NOT TESTED**; browser QA uses a fake Leaflet event provider |
| iPhone Safari real device | **NOT TESTED** |

## Follow-up gates

1. Actual Leaflet rendering, hit testing, mobile gestures and normal-URL browser workflows with real storage and cryptography.
2. Area whole-object creation/deletion requires separate source-preserving export/roundtrip support. Current controls edit vertices only.
3. Browser quota, multi-tab and sudden-close recovery test matrix beyond Node mock checks. LocalStorage slot/pointer operations are not an atomic multi-key transaction.
4. Final end-to-end Phase 1-B and Phase 2 acceptance, WebKit and iPhone Safari user authorization, then separate approval for public release.

Original private Kasai KMZ bytes and converted archives **must not be committed to this repository**.
