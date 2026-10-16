# Original Campsite Distance screen and Leaflet: isolated browser UI integration LAB

**2026-10-15 JST** | **PR #368 Draft / Phase 1 HOLD** | no production or approved-r31 changes

## Scope

`creative-next/qa/campsite-distance-real-screen-browser.cjs` extracts the **actual unmodified** `<section id="distance">…</section>` markup from `index.html` (not a hand-designed imitation), loads the **original** `js/distance-core.js`, `distance-poi.js`, `distance-file.js`, `distance-render.js`, `distance-score.js`, `distance.js`, and `distance-map.js` as browser scripts, plus pinned actual Leaflet JS/CSS.

It then checks a **verified synthetic** Project+NEW_V1 archive with explicit activity areas through the portable receiver and strict staging before filling the sandboxed screen's `window._layerPoints` and `window._activityPolygons`. The test **calls genuine `runDistanceCheck()` and genuine `renderSimpleDistanceMap()`**, checks Leaflet marker/path instances and the original actual-result HTML, and captures counts. It does **not** invoke `js/bridge-distance-project.js` or write to `sessionStorage['campsiteProject.v1']`.

### Source-fidelity assertions

- Real `#distanceResult`, `#distanceMap` and check boxes are taken from the deployed app's `index.html` source.
- Three current synthetic editable POIs: 1 existing PokéStop, 1 new Gym and 1 new PowerSpot. The projected map should contain **3 Leaflet circle markers**, with 3 near-distance warning lines across all pairs (red under20, orange 20–30, yellow 30–50).
- Exactly one **31-vertex independent Creative activity area** becomes the Leaflet polygon; the separate **4-vertex Project design** and historical observation polygons must not be substituted or double-counted.
- The external reference100 Gym and inactive reserve200 PowerSpot remain in their immutable Wayfarer source zones. Neither appears as an editable marker or warning line. External reference calculations are already separately audited in the preceding read-only LAB; **do not silently change the real Campsite score**.
- Both mobile widths 390×844 and 393×852 are tested with actual Chromium rendering.
- No analytics, file uploads or production storage writes. Analytics calls are intercepted and counted; the upload file is forcibly `null` and unwritable; other upload calls throw; **all external network requests** except map tiles are aborted; map tile URLs are satisfied with a synthetic local 1×1 PNG. No real map/POI is transmitted.

### Boundary limitations

- The real HTML section and real JS/Leaflet **are executed in a self-contained test browser document**, not the full production Campsite page with its existing navigation, authentication, project persistence, Supabase or other plugins. The sandbox uses local stand-in CSS for surrounding layout. A source fragment E2E is not equivalent to a complete app integration.
- The test bypasses the unapproved real receiver by using the previously verified LAB portable pair and strictly staged input. This is a **controlled QA injection**, not an authorized application handoff route.
- Actual score and warning logic may run in the sandbox but are never authoritative or persisted. Real iPhone Safari, Android and the live site's submission flow have **not** been tested for this new connection.
- **UI copy discrepancy:** Production `index.html` distance explanation still includes “40m以上：距離上は余裕” and “30m以上40m未満” language, while current `js/distance.js` uses a **50m** warning threshold. Must be reviewed as a separate production copy/UI change after approval, not silently patched under this PR.
- The earlier legacy `js/bridge-distance-project.js` still falls back from an empty `currentPois` to `selectedPois` and overloads `_activityPolygons` with `project.polygon`. Nothing in this LAB makes that live receiver safe. Fix/approval required before real connection.

## Release gate

**Even if all browser checks pass**, they authorize only this dedicated isolated simulation. Requirements remain: PO X-01 independent polygon ownership and zero-area behavior, PO X-04 identity/authenticated cross-origin transfer, atomic confirmed project import with rollback, two-tab revision safety in the real Campsite receiver, score and reference policy, full navigation/Leaflet iPhone+Android real-device checks, and explicit production release approval.

PR stays Draft and unmerged; `main` and frozen approved r31 UI are preserved.
