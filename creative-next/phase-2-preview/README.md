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

### 2026-10-09 isolated map-edit update (NON-PRODUCTION)

- Leaflet preview layers now have independent POI, 50m owned-circle and activity-area visibility checkboxes. Hiding layers changes rendering only, never staged geometry or draft data.
- Selecting an **existing** POI never enables map position entry. For a **new** POI, the map-tap mode copies a proposed coordinate into the editor; the actual store changes only after confirming the add/edit form.
- When Leaflet provides markers, the selected area's numbered vertex handles can be dragged. A browser confirmation and the source geometry validator both gate the change. Cancellation/validation failure re-renders the original point. Numeric inputs remain available as a fallback.
- The canvas fallback keeps layer toggles and manual numeric edits but does not claim interactive Leaflet map placement. Leaflet tile loading, browser-origin storage and Safari remain unverified.
- No new activity-area creation/deletion in this step. Unknown and unusual geometries remain HOLD.

## Oct 9: explicit activity-area creation and complete deletion (isolation only)

- A separate "＋ 活動範囲を新規作成" editor accepts 3–512 numeric `lat,lng` vertices (one per line). It validates a non-self-intersecting polygon before the confirmed edit. The editor creates a distinct, immutable `area-<UUID>` ID and does not treat distance-circle polygons as activity areas.
- "活動範囲を丸ごと削除" requires confirmation. It removes only the selected activity area from a generated KMZ; the source archive remains in an isolated journal for explicit Undo and user-approved recovery. The POI count and distance circles must remain unchanged.
- Undo/Redo applies creation and deletion in the same chronological sequence as POI edits and vertex changes. Source area IDs cannot be reused for an unrelated new area. Preview limits new+existing activity areas to 64 (provisional safety bound, not an iPhone file-size limit).
- The source-aware KMZ exporter rejects source area deletion if geometry contains unverified structure, holes, special altitude, or ambiguous ownership. All output is re-imported and diagnosed before bytes are returned.
- 195 Node tests pass (including 11 new membership tests); six private real-Kasai regression scripts pass. Simulated Chromium 390px UI (local in-memory storage/crypto) passes. Native Leaflet tiles, actual HTTP-origin storage, ordinary Chromium/WebKit page navigation and iPhone Safari are **not verified**.
- Nothing here changes public `main` or old Creative Mode. Do not merge or deploy without subsequent full gate review.

## Oct 9: browser startup guard and truthful map readiness (isolated only)

- An isolated, read-only capability probe now handles browsers whose `localStorage`
  *getter* throws `SecurityError` (notably Safari restriction modes). It never
  reads or writes a legacy storage key. Import/export are disabled when the
  required Web Crypto/JSZip/XML facilities are absent; Save/Resume are disabled
  when browser storage is inaccessible. The UI explains which capabilities are
  absent rather than presenting an apparently usable save button.
- Leaflet 1.9.4 CSS/JS are pinned by published SHA-256 Subresource Integrity
  values. The external CDN and OpenStreetMap tiles **still need a network**;
  this is not a self-hosted/offline Leaflet deployment. The tile-status label
  distinguishes loading, loaded, and failed tiles; only an actual tile `load`
  event may be labeled loaded.
- `qa/real_origin_chromium.py` is provided to run a genuine HTTP-localhost,
  native-browser, native-WebCrypto, native-localStorage smoke test with an
  explicitly supplied *private* KMZ. Its browser context is ephemeral, and
  its fixture is never copied into public files. **In the current managed
  environment Chromium navigation is blocked by `ERR_BLOCKED_BY_ADMINISTRATOR`**;
  the runner correctly reports BLOCKED, not PASS.
- Node: 205/205 (previous 195 + 8 capability + 2 map tile-status tests); real
  private Kasai six regression scripts PASS. Not a substitute for actual
  Chromium/WebKit/Safari URL-origin testing or PO device-test authorization.
