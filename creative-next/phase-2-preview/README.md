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
