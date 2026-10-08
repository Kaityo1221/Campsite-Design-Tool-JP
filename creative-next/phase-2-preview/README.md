# Creative Next: non-production isolated map/editor preview

**Do not merge, deploy, link from production, or treat as public Creative Mode.**

This preview connects an audited Kasai-style KMZ candidate to the approved Phase 1-A POI store and guarded Phase 1-B exporter / two-generation save journal. A file must first pass exhaustive staging and explicit replace confirmation. No legacy storage keys are read or modified.

## Map

The page attempts to load **Leaflet 1.9.4** from the same unpkg distribution already used by legacy Creative Mode, with OpenStreetMap tiles. The optional `leaflet-map-view.mjs` adapter performs keyed updates for POIs, owned 30/40/50m circles and activity areas. If Leaflet cannot load, a no-network canvas fallback displays POIs, actual distance-circle outlines and activity-area boundaries. The canvas is not a geographic basemap.

These map integrations are for a **private, unapproved preview**. Node mocks validate the keyed layer behavior; the CDN/tiles and native network-origin browser workflow have **not** passed real-device tests.

## Preview operations

- Inspect any KMZ completely before committing a candidate into the isolated editor. Any ambiguous or unsafe content HOLD/REJECT with zero application.
- Edit title/memo; Undo/Redo; source-preserving KMZ export and manual draft save/resume.
- Move only **new** POIs. All verified circles owned by the POI move with it; existing POI coordinates remain immutable.
- Delete a POI and its owned circles together in KMZ export, while retaining deleted POI tombstones and the immutable source in preview journal so Undo can restore them. Unrelated circles and activity areas stay untouched.
- Unsupported legacy kind changes, POI insertion, polygon edits and unknown coordinates/altitudes continue to HOLD.

## Run locally (not from a phone until authorized)

From repository root, serve on an isolated local port and visit `/creative-next/phase-2-preview/index.html`. The preview does not modify or link to any production entrypoint.

```sh
python -m http.server 8000
node --test creative-next/phase-1b/test/*.test.mjs
node creative-next/phase-1b/test/verify-real-kasai-circle-edit.mjs /private/original-kasai.kmz
```

The private Kasai fixture must **never** be committed or included in a public ZIP. See `creative-next/PHASE2_CIRCLE_MAP_PROGRESS_20261009.md` for verified counts, test limits and remaining gates.

## Oct 9 update: user-confirmed additions and kind edits (test-only)

The historical HOLD statements above for *POI insertion* and *all legacy kind changes* are superseded. The isolated preview now offers `＋ 新規POIを追加` with title, memo, type and numeric coordinates. New entries receive a 50m circle, follow Undo/Redo and snapshot save/resume, and are rejected at the total 25 or per-kind 12/8/5 limit. Source-bearing old KMZ kind changes move the POI to the correct folder and update its legacy `nextlab-layer` and existing `#creative-*` icon **only when the source can prove the target folder/icon exists**. Unsafe changes remain blocked. The real Kasai sample passed isolated conversion and editing, and Chromium 390px simulated-origin UI operation passed. **Activity-area editing, live Leaflet tiles, real-origin persistence and iPhone Safari acceptance remain pending.** See `creative-next/PHASE2_ADD_KIND_PROGRESS_20261009.md`.

## Oct 9: activity-area vertex editing (isolated only)

Activity areas with verified `campsite.creative.object=activity-area` and unique `area-id` are editable via numeric latitude/longitude vertex move, insert-after and delete controls. Source distance-circle Polygons are **never editable activity areas**. Polygon must remain simple, closed on export, three or more distinct vertices, with no dateline crossing, self-intersection, or unsupported altitude/hole structure. All editor operations share chronological Undo/Redo with POI edits; draft save/resume and new KMZ export revalidate and preserve original attachments. **Leaflet draggable vertex handles and live iPhone editing are still pending.**
