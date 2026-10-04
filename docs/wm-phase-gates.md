# Wayfarer Observe Flow phase gates

Updated: 2026-10-02
Branch: `feature/wm-wayfarer-observe-flow` · Draft PR #275

## WM-3C — LIVE PASS

Acceptance is based on the project owner's real-device screenshots and reported
results from the `wm3c-bridge-pc-test` artifact (ID `11212232381`, SHA-256
`b17b5b34e6361186174a87fd489124f26d21471ab806a5fb094d56ee3598115a`).

All six diagnostics passed: Relay接続 / Polygon受信 / GCS開始 / RESULT返却 /
Project保存 / Reference表示.

Observed counts: INTERIOR 37, REFERENCE_100 23, displayed Reference 23,
editable GUID duplicates suppressed 37.

Fixed product decisions:

- Creative Polygon is the source of truth; Wayfarer is the acquisition surface.
- Observation references do not enter `records` or `currentPois`.
- INTERIOR uses normal display; REFERENCE_100 is lighter.
- RESERVE_200 is retained internally and hidden.
- Do not draw 100m or 200m boundary lines (explicit owner decision).
- Field/Distance known red signatures reproduce on actual main.

This acceptance supersedes earlier WM-3C live-pending notes in PR #275.
The PR remains Draft; acceptance does not authorize a production release.

## Next roadmap phase: WM-4

Source: `wayfarer-observe-flow-spec-v1.md`, sections 20 and 22:
Project / Handoff backward-compatible extension precedes polygon editing (WM-5),
reference inspection/distance warnings (WM-6), and diff/merge (WM-7).

WM-3B-2D already introduced optional `wayfarerObservation`. WM-4 continues with
small subphases instead of creating a second schema or duplicating snapshots.

### WM-4A — observation retention through Creative lifecycle: local PASS

The RESULT receiver writes a freshly parsed Project to session storage, while
Creative's timer / pagehide / Next / Back callbacks retain the previously loaded
Project object. Saving that stale object could erase the accepted observation.

The feature Reference patch now wraps the existing Creative sync function:

- Read the stored Project immediately before sync.
- Require matching source, projectId and Bridge handoff identity.
- Carry the stored optional `wayfarerObservation` into the loaded object.
- Preserve observation removal instead of resurrecting an old snapshot.
- Stop detached callbacks after Project removal, replacement or unreadable storage.
- Keep editable arrays and the current polygon owned by the existing Creative sync.

The extension TEST bundle is generated from the same feature patch, so both entry
paths receive the fix. Production baseline `bridge-project-patch.js` and public
deployment are unchanged.

Gate:

1. Reproduce observation loss with the new lifecycle test before the fix.
2. Feature and packaged TEST lifecycle tests pass for timer, pagehide, Next,
   resume, replacement observation, missing observation and handoff isolation.
3. Existing Bridge architecture/Project recovery regressions pass.
4. Real Creative WebKit Reference gate passes across two autosave ticks.
5. Review the diff before marking WM-4A PASS.

All five local gates passed on 2026-10-02. The failure was reproduced before
the fix, both lifecycle paths passed afterward, `check:bridge-architecture` and
`check:bridge-next` passed, and the real Creative iPhone/WebKit Reference test
passed with its new two-autosave-tick assertions. Diff review found only the
feature sync wrapper, tests/CI wiring and contract/acceptance documentation.
Remote CI is checked separately after committing to PR #275.

### WM-4B — acquisition metadata / initial Handoff audit: PASS

Audit found one concrete contract gap: WM-3 already retained the polygon/zones and
completeness result, but the first legacy Bridge payload carried only its normal
POIs/reference data and did not transport the accepted observation snapshot.

The narrow implementation therefore:

- gives each observation an explicit `snapshotId` while retaining `observedAt`;
- retains acquisition bounds, cell/tile geometry diagnostics and explicit
  geometry/transport/source/completeness state;
- when a current accepted Wayfarer observation exists, the initial PC Bridge
  handoff reuses that exact polygon+200m zone snapshot instead of re-fetching the
  current viewport;
- carries the same optional `wayfarerObservation` through exporter -> Receiver
  Adapter -> `campsiteProject.v1`;
- initializes the Gateway polygon from that observation;
- attaches the observation to the Project only while Project polygon and
  acquisition polygon still match;
- never promotes `coverageComplete:false` because transport succeeded.

Gate before PASS:

1. WM-3 controller metadata regression passes.
2. Bridge exporter retains one observation snapshot without exposing diagnostics.
3. Receiver -> Adapter -> Project E2E retains snapshot identity/time, reserve
   zone, stable POI state and incomplete completeness.
4. A changed polygon rejects the stale observation.
5. Existing Bridge architecture/Next regressions pass.
6. Diff review confirms no WM-5/6/7 behavior, schemaVersion change, main merge or
   public release.

WM-4B PASS was fixed on 2026-10-02 after implementation, regression and diff review.

Evidence:

- production/test head: `71b6765f772d32d95cbd2cc3cc7f30cbfecd4a13`;
- Campsite Bridge PC Check #282: PASS, including WM-3 metadata, Bridge V1 export,
  PC route, existing architecture and syntax gates;
- Bridge Next Flow Check #217: PASS, including the strengthened three-device
  Receiver -> Adapter -> Project handoff assertions;
- Campsite Bridge Setup Check #195 and Distance Advice QA #151: PASS;
- the strengthened E2E explicitly verifies acquisition polygon, snapshot ID/time,
  GUID, POWERSPOT type, Active/Inactive state, REFERENCE_100/RESERVE_200,
  100m/200m distances, acquisition bounds and explicit completeness;
- `coverageComplete:false` remains false while transport can be true;
- stale observations are rejected when the current Project polygon differs;
- RESERVE_200 is carried only inside `wayfarerObservation`; it is excluded from
  normal Bridge POI channels so the Gateway cannot render the hidden reserve band;
- observation references/reserve remain outside `currentPois`;
- `campsiteProject.v1` / schemaVersion `1.0` remain unchanged.

During final review, the first strengthened E2E run (#215) failed only because
Node's strict deep comparison crossed a VM realm while values were identical.
That assertion was corrected. The same review then found and fixed a real
RESERVE_200 visibility leak in the initial handoff normal POI channel before PASS.

No WM-5/6/7 behavior was implemented. No merge to `main` and no production
publication was performed. PR #275 remains Draft.


## WM-5 — Campsite polygon editing

### WM-5A — reserve coverage evaluator: PASS

Scope is intentionally geometry-only. No Creative UI, no polygon mutation ownership
change, no local POI reclassification and no Wayfarer reacquisition button are
connected in this subphase.

Input contract:

- acquired polygon: `project.wayfarerObservation.polygon`;
- acquired buffer: `project.wayfarerObservation.acquisition.bufferMeters`;
- current polygon: latest Creative-owned `project.polygon`;
- required visible reference range: fixed 100m.

The evaluator answers whether `current polygon + 100m` is safely contained by the
previous acquisition reserve. It uses conservative edge densification and a safety
margin, preferring a false reacquisition request over a false "covered" result.
`coverageComplete` is reported but is never promoted and does not alter the pure
geometry result.

Gate before PASS:

1. unchanged and inward polygons are covered;
2. a polygon shifted 80m with a 200m acquisition buffer is covered;
3. a polygon shifted 120m is outside reserve;
4. smaller acquisition buffers reduce the available expansion budget;
5. missing/insufficient acquisition metadata fails closed;
6. huge/invalid geometry fails closed instead of creating unbounded work;
7. the evaluator is not wired into Creative UI or mutation flow;
8. existing Bridge architecture regressions and diff review pass.

WM-5B local reclassification and WM-5C reacquisition UX must not start until
WM-5A passes.

WM-5A PASS was fixed on 2026-10-02 at code/test head
`4396dbebcd76b22b03415bb6281b10bf758524c1`.

Evidence:

- Campsite Bridge PC Check #285: PASS; log includes
  `WM-5A reserve coverage evaluator: PASS`;
- Bridge Next Flow Check #220: PASS;
- unchanged/inward, 80m covered, 120m uncovered and reduced-buffer cases pass;
- missing buffer, insufficient buffer, sample-limit, self-intersection, zero-area
  and invalid polygons all fail closed;
- a repeated closing coordinate is normalized without changing the ring;
- `coverageComplete` is only reported and is never promoted or used to claim
  geometry completeness;
- diff review from the WM-4B PASS head contains only the pure coverage module,
  its test, CI wiring, package script and this gate document;
- the new module is not loaded by Creative and does not change UI, polygon
  mutations, local reclassification or Wayfarer reacquisition.

WM-5B/5C remain unimplemented at this PASS boundary.


### WM-5B-1 — local observation reclassification: PASS

Scope is still pure data derivation. This subphase does not load the module in
Creative, mutate `records`, replace the stored observation snapshot, or add the
Wayfarer reacquisition UI.

When WM-5A says the current polygon +100m is covered, the reclassifier derives a
current view from all retained snapshot POIs:

- inside current polygon -> INTERIOR;
- outside polygon but within 100m -> REFERENCE_100;
- all other retained POIs -> hidden RESERVE_200 remainder.

The stored acquisition polygon, snapshot identity/time and original
`wayfarerObservation.zones` remain unchanged. Derived RESERVE_200 is only the
hidden retained remainder; it does not claim that current polygon +200m was
freshly acquired.

Gate before PASS:

1. unchanged polygon preserves expected zone counts;
2. an 80m covered edit moves retained POIs across zone boundaries locally;
3. GUID/type/Active-Inactive state is preserved;
4. source observation stays byte-equivalent;
5. outside-reserve edits return reacquisition-required with no stale derived zones;
6. duplicate/invalid retained POIs are diagnosed without double classification;
7. module is not connected to Creative UI or `records`;
8. existing Bridge architecture regressions and diff review pass.

WM-5B-1 PASS was fixed on 2026-10-02.

Evidence:

- implementation/test head: `710bd1dc909b3808f13a3675f87d33086ea60cea`;
- acceptance/regression-cleanup head: `55a7c95e2122823f3b22a96067580ff99bff36a1`;
- Campsite Bridge PC Check #290: PASS, including
  `WM-5B-1 local observation reclassification: PASS`;
- Bridge Next Flow Check #225: PASS;
- Phase 5 Unified Renderer Release Gate #107: PASS;
- Campsite Bridge iPhone Check #158 and Setup Check #203: PASS;
- Distance Advice QA #159 and Distance Mission E2E #193: PASS;
- Field End-to-End #254, Field Mode Safety #311 and Field Prep Safety #277:
  PASS after bringing the feature branch's Field tests in line with the already
  adopted Creative Mode v2 interaction contract;
- diff review from the WM-5A PASS head to the WM-5B-1 implementation head contains
  only the pure reclassification module, its regression, package/CI wiring and
  this gate document;
- the source observation remains byte-equivalent; GUID/type/Active-Inactive state
  is preserved; outside-reserve edits return reacquisition-required without
  exposing stale derived zones;
- the WM-5B-1 module is still not loaded by Creative at this PASS boundary and
  does not write `records`, `currentPois`, the acquisition snapshot, or any UI.

The post-implementation CI cleanup did not change WM-5B-1 behavior. It updated
stale Field/Distance regression expectations and hardened asynchronous Distance
advice persistence so it merges into the latest Project instead of overwriting
newer Project state.

WM-5B-2 Creative Reference-layer integration may start only after this PASS.
WM-5C reacquisition UX remains out of scope.


### WM-5B-2A — Creative Reference local reclassification integration: PASS

Scope is Reference display integration only. Creative editable data remains authoritative
and unchanged.

The integration:

- loads the WM-5A reserve coverage evaluator and WM-5B-1 reclassifier into the
  Creative Bridge Project runtime;
- reads the active in-memory Creative polygon as the current geometry source;
- derives INTERIOR / REFERENCE_100 / hidden RESERVE_200 from the immutable
  acquisition snapshot;
- feeds only that derived view into the existing read-only Reference Adapter /
  Geometry / Scene path;
- includes current polygon + observation identity in the renderer signature so a
  polygon change immediately refreshes Reference display;
- fails closed outside the acquired reserve: stale Reference items are removed,
  while the stored acquisition snapshot is preserved for the later WM-5C
  reacquisition flow.

This subphase does not write `records`, `currentPois`, or
`wayfarerObservation`, and it does not add the `Wayfarerで再取得` UI.

Gate before PASS:

1. unchanged polygon keeps the accepted WM-3C Reference behavior;
2. a covered Creative polygon replacement locally moves retained POIs across
   INTERIOR / REFERENCE_100 / RESERVE_200 without Wayfarer access;
3. editable GUID suppression and read-only Reference rendering remain intact;
4. source observation stays byte-equivalent across polygon replacement and
   autosave;
5. outside-reserve geometry removes stale Reference display and reports
   reacquisition-required;
6. generated WM-3C TEST runtime contains the same coverage/reclassification path;
7. real Creative WebKit gate and Bridge architecture regressions pass;
8. diff review confirms no WM-5C UI, WM-6, WM-7, main merge or production release.

WM-5B-2A PASS was fixed on 2026-10-03 JST at code/test head
`d45fb3a1ae3f39b586760ba2fdee0b007322fafd`.

Evidence:

- Phase 5 Unified Renderer Release Gate #115: PASS;
- the real Creative iPhone/WebKit gate passed all five renderer tests, including
  the Wayfarer Reference case after deleting the original Creative polygon and
  creating a shifted replacement polygon;
- Campsite Bridge PC Check #298: PASS, covering the generated TEST runtime plus
  WM-3C / WM-4A / WM-5A / WM-5B-1 architecture regressions;
- Bridge Next Flow Check #233, Campsite Bridge iPhone Check #166, Setup Check
  #211, Distance Advice QA #167, Workflow Resume #206, Field End-to-End #262 and
  Field Prep Safety #285: PASS at this code/test head;
- covered polygon replacement reclassifies retained snapshot POIs locally and
  keeps Reference rendering read-only;
- the stored `wayfarerObservation` remains byte-equivalent across polygon
  replacement and subsequent Creative autosave ticks;
- outside-reserve geometry fails closed with `REACQUIRE_REQUIRED` and removes
  stale Reference display;
- editable `records` / `currentPois` remain Creative-owned and are not
  populated by Reference or reserve POIs;
- diff review from the WM-5B-1 PASS head contains only the Reference integration,
  TEST-runtime wiring, regression tests and this gate documentation;
- the intermediate Renderer reds were test-harness issues only: legacy signature
  availability, UI hit-target selection, lexical `map` access, Leaflet delete
  overlay targeting, and sub-meter Leaflet pixel rounding. No product behavior
  was weakened to make the gate pass.

PR #275 remains Draft and mergeable. No merge to `main`, no production
publication, no WM-5C reacquisition UI, and no WM-6 / WM-7 implementation.

WM-5C reacquisition UX may start only after this PASS.



### WM-5C-1 — reacquisition-required CTA + existing observation roundtrip: PASS

Scope is the minimum UI/action needed when WM-5A/5B determine that the current
Creative polygon +100m is outside the retained acquisition reserve.

No second transport or project schema is introduced. The existing Creative
Wayfarer observation relay is reused because it already:

- syncs the latest Creative-owned Project before sending;
- reads the current Project polygon;
- sends that polygon in `CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1`;
- causes Wayfarer to call observation `runPolygon(polygon)` directly;
- returns the RESULT to Creative and saves only the observation snapshot.

This subphase adds:

- a small Reference-state event when local coverage/reclassification state
  changes;
- conditional persistent CTA text `Wayfarerで再取得` when the Reference state is
  `REACQUIRE_REQUIRED`;
- the same reacquisition label on the existing observation action inside the
  Wayfarer connection overlay;
- automatic return to the normal `🔭 Wayfarer観察` label after a fresh matching
  observation is accepted.

Gate before PASS:

1. an outside-reserve Creative polygon removes stale Reference display and
   immediately exposes `Wayfarerで再取得`;
2. the CTA does not appear for covered polygons;
3. the existing observation relay sends the latest Creative polygon rather than
   the old acquisition polygon;
4. Wayfarer uses observation-only `runPolygon()`; no Wayfarer polygon editor is
   activated in the return path;
5. a successful RESULT replaces the observation snapshot, clears
   reacquisition-required state and restores the normal observation label;
6. editable Creative records remain unchanged through the roundtrip;
7. WM-3/4/5A/5B regressions and the real Creative WebKit gate pass;
8. diff review confirms no WM-6 distance-warning work, WM-7 diff/merge work,
   schema fork, main merge or production publication.

WM-5C-1 PASS was fixed on 2026-10-03 JST at code/test head
`53a14dd4fdf6fc518ea807f1c875be38eb9110bd`.

Evidence:

- Phase 5 Unified Renderer Release Gate #120: PASS;
- the real Creative iPhone/WebKit suite passed 6/6, including
  `WM-5C outside-reserve edit shows reacquisition CTA and sends latest Creative polygon`;
- Campsite Bridge PC Check #303: PASS;
- Bridge Next Flow #238, Campsite Bridge iPhone #171, Setup #216,
  Distance Advice #172, Workflow Resume #211, Field End-to-End #267 and
  Field Prep Safety #290: PASS at this code/test head;
- an outside-reserve polygon removes stale Reference markers and changes the
  persistent action plus the overlay action to `Wayfarerで再取得`;
- the existing observation relay sends the latest Creative-owned polygon in
  `CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1`;
- the Wayfarer return path remains observation-only and calls
  `CampsiteWayfarerObserveController.runPolygon(polygon)` directly;
- a fresh matching RESULT replaces only `wayfarerObservation`, clears
  reacquisition-required state and restores `🔭 Wayfarer観察`;
- editable Creative workspace records are unchanged across the reacquisition
  roundtrip;
- diff review from the WM-5B-2A PASS documentation head contains only the
  Reference-state notification, conditional reacquisition CTA, existing relay
  regression updates, browser regression and this gate documentation;
- the first PC red was a stale regression assertion pinned to Creative link
  version `0.3.0`; the first WM-5C browser red was test-relay simulation only.
  Both were corrected without adding a second transport or weakening product
  behavior.

PR #275 remains Draft. No merge to `main`, no production publication, no
parallel project schema, and no WM-6 / WM-7 implementation.

WM-5C is functionally complete for the section 10.2 return path at this gate.
WM-6 must not start until the project owner explicitly continues from this PASS.



## WM-6 — Creative reference POIs / distance warning

### WM-6A — exterior Reference inspection + 50m-only circle: PASS

This subphase is intentionally limited to the first half of specification sections
12 and 13. It does not implement the new-candidate distance-warning calculation yet.

Existing WM-3C / WM-5 behavior already provides:

- REFERENCE_100 lighter than interior;
- read-only Reference POIs outside editable `records/currentPois`;
- continuous Reference 50m circles;
- no Reference 40m / 30m circles;
- RESERVE_200 hidden.

WM-6A closes the remaining inspection gap:

- only exterior `REFERENCE_100` markers become tappable for inspection;
- inspection does not route through Creative record editing and therefore cannot
  move, delete, rename or type-change a Reference POI;
- one bottom information panel shows only title and POI type;
- coordinates are not displayed;
- `×` and map tap close the panel;
- the panel is a singleton and switching Reference POIs reuses it;
- the existing 50m-only Reference circle contract remains unchanged.

Gate before PASS:

1. REFERENCE_100 marker is interactive for inspection while `readOnly:true`;
2. INTERIOR observation-only fallback marker is not exposed as an exterior
   inspection target;
3. tapping an exterior Reference opens title + POI type only;
4. no coordinates are shown;
5. Reference inspection leaves Creative records byte-equivalent;
6. Reference Scene still emits only marker + 50m circle, never 40m / 30m;
7. RESERVE_200 stays absent from the Scene;
8. current Creative entry, Undo/Redo, 50m reason, caps, BFCache, move opacity and
   `rendererMode=legacy` regressions remain green;
9. WM-3C through WM-5C regressions remain green;
10. diff review confirms WM-6B distance-warning logic and WM-7 remain unimplemented.

WM-6A PASS was fixed on 2026-10-04 JST at final validation head
`27b57ff34102e801ea7e4cc0a99a1d51e467df5b`.

Evidence:

- implementation head: `7c90d0fcdcdf3e495a1c915cd1ba96c78c973070`;
- cache-tag regression alignment: `84ad74b87dc6f8dd786e0930058f74559b4257a5`;
- final WebKit gate stabilization: `27b57ff34102e801ea7e4cc0a99a1d51e467df5b`;
- Phase 5 Unified Renderer Release Gate #176: PASS;
- Campsite Bridge PC #360: PASS, including Reference Geometry + Scene,
  Reference Renderer and Creative Reference Integration regressions;
- Bridge Next #296, iPhone #178, Setup #223, Distance Advice #186,
  Distance Mission #222, Workflow Resume #218, Field E2E #281,
  Field Prep #303 and Field Mode Safety #342: PASS;
- REFERENCE_100 markers are tappable only for inspection while remaining
  `readOnly:true`; the observation-only INTERIOR fallback is not an exterior
  inspection target;
- the singleton panel shows title and POI type only and exposes no coordinates;
- closing by `×` and map click is covered by the real Creative WebKit test;
- inspection leaves editable Creative records unchanged;
- Reference Scene still emits only marker + 50m circle and no 40m/30m circles;
- RESERVE_200 remains hidden and absent from the Reference Scene;
- current production Creative entry, activity-range Undo/Redo, 50m reason,
  candidate caps, BFCache, move-opacity and `rendererMode=legacy` regressions
  remain green.

The first PC red was a stale WM-3C cache-tag assertion. The first WebKit red was
a test-only map-click coordinate hitting production UI; the test was changed to
dispatch the map-container click event without altering product behavior.

WM-6B distance warning may now start. WM-7 remains out of scope.



### WM-6B — Reference-aware 50m distance warning: PASS

Scope is warning-only. Reference POIs remain outside editable Creative state and
the existing 50m reason/signature workflow remains records-owned.

The implementation uses a separate pure distance engine over:

- active editable existing POIs;
- other active new candidates;
- visible exterior `REFERENCE_100` marker items from the derived Reference Scene.

It explicitly ignores observation-only INTERIOR fallbacks, hidden RESERVE_200,
Reference circles, deleted records and the currently selected/moving candidate.

Runtime behavior:

- while adding a candidate, the map center is continuously evaluated;
- while moving a candidate, the moving candidate is excluded and the map center
  is continuously evaluated;
- while a new candidate editor sheet is open, that candidate position is
  evaluated;
- delete / Undo / Redo / redraw schedules an immediate recalculation;
- Reference observation/reclassification refresh also schedules recalculation;
- only distances below 50m show the fixed warning;
- >=50m shows no WM warning;
- warning categories are explicit:
  - exterior Reference: `⚠ xx.xm / 設計範囲外の既存POIから50m未満です`;
  - editable existing: `⚠ xx.xm / 既存POI`;
  - other candidate: `⚠ xx.xm / 新規候補`;
- placement is never blocked by the warning.

Gate before PASS:

1. pure nearest-distance regression classifies EXISTING_POI / NEW_CANDIDATE /
   REFERENCE_100 and excludes the active candidate;
2. INTERIOR / RESERVE_200 / Reference circles / deleted records never
   participate;
3. pure distance evaluation does not mutate editable records or Reference Scene;
4. real Creative add mode shows the exterior Reference warning under 50m and
   leaves Confirm enabled;
5. moving the add center beyond 50m hides the warning;
6. selecting a candidate within 50m of an exterior Reference shows the same
   Reference warning and closing the sheet hides it;
7. warning display leaves editable records unchanged;
8. delete / Undo / Redo / redraw and Reference refresh are wired to immediate
   recalculation without placing Reference POIs in `records/currentPois`;
9. WM-6A inspection, WM-3C through WM-5C and current production Creative
   regressions remain green;
10. WM-7 remains unimplemented.

WM-6B PASS was fixed on 2026-10-04 JST at final validation head
`64fc55c2dabdf546f04045cb1860b8c7891418a8`.

Evidence:

- implementation head: `3d80b5a486832cefd550f3a67fc4105e07acff67`;
- distance-gate cleanup: `ed607b3d77c7adfb89f9dac2f8e001d8e44ad5a7`;
- VM scheduler hardening: `871b153cdb9e669e03fb53c49cc70b323fc2045c`;
- duplicate CI-path cleanup: `9cdbea9731b14dc3d1701fd8c1301dbadfef2ddb`;
- optional Creative-state guard: `7cc984be014c7857a03b7c1e4e724b65f3522245`;
- optional DOM guard / final validation head:
  `64fc55c2dabdf546f04045cb1860b8c7891418a8`;
- Campsite Bridge PC #367: PASS, including
  `WM-6B Reference-aware nearest distance: PASS` with no WM-6B
  ReferenceError/warning-refresh noise in the final log;
- Phase 5 Unified Renderer Release Gate #183: PASS, 15/15 real Creative
  iPhone/WebKit tests;
- the WebKit gate includes both WM-6B browser cases:
  - add mode warns for an exterior Reference POI while Confirm remains enabled;
  - selected candidate keeps the same Reference warning while editable records
    remain unchanged;
- Bridge Next #303, Campsite Bridge iPhone #185, Setup #230,
  Distance Advice #193, Distance Mission #229, Workflow Resume #225,
  Field End-to-End #288, Field Prep Safety #310 and Field Mode Safety #349:
  PASS;
- `REFERENCE_100` participates in nearest-distance warning only;
  INTERIOR fallback, RESERVE_200 and Reference circles do not;
- deleted records and the moving/selected candidate are excluded correctly;
- warnings are hidden at 50m or more and never block placement;
- redraw/delete/Undo/Redo and Reference refresh are connected to immediate
  recalculation without moving Reference POIs into `records/currentPois`;
- WM-6A inspection behavior and 50m-only Reference-circle behavior remain intact;
- production `main` was not changed and WM-7 was not implemented.

## WM-6 — PASS

WM-6 is complete at the code-validation head
`64fc55c2dabdf546f04045cb1860b8c7891418a8`.

Completed scope:

- WM-6A: exterior Reference inspection, singleton title/type panel, read-only
  interaction and Reference 50m-only circles;
- WM-6B: Reference-aware under-50m warning for add / move / selected candidate,
  with existing/new/reference source labeling and non-blocking placement.

The WM-6 implementation preserves the core ownership contract:
`records/currentPois` remain Creative-owned editable state, while
`wayfarerObservation` and Reference Scene data remain separate.

WM-7 re-observation / diff / disappearance / merge is the next roadmap phase and
must start from this accepted WM-6 boundary.



## WM-7 — Re-observation / diff / disappearance / merge

### WM-7A — 90-day refresh-age hint (implementation)

Scope is intentionally limited to specification section 15. Re-observation diff,
absence counting and Base/Local/Remote merge are not implemented in this subphase.

Behavior:

- the existing accepted `wayfarerObservation.observedAt` is evaluated against a
  fixed 90-day threshold;
- below 90 days the persistent action remains `🔭 Wayfarer観察`;
- at 90 days or more the same action shows `更新推奨`;
- no modal or overlay opens automatically;
- when WM-5C also requires reacquisition because the polygon is outside reserve,
  `Wayfarerで再取得` has visual/action priority over the age hint;
- a newly saved observation immediately clears the stale-age state;
- missing or invalid `observedAt` does not invent a stale claim;
- this adds no new Project schema field and does not rewrite the accepted
  observation snapshot.

Gate before PASS:

1. pure age evaluation is fresh at 89 days and stale at 90 days;
2. invalid/missing observation time does not show a stale hint;
3. real Creative shows `更新推奨` for a >90-day observation without auto-opening
   the Wayfarer overlay;
4. refreshing `observedAt` clears the hint immediately;
5. WM-5C `Wayfarerで再取得` remains higher priority when both conditions apply;
6. editable Creative records stay unchanged;
7. WM-3C through WM-6 and current production Creative regressions remain green;
8. diff/disappearance/merge behavior is still absent.

WM-7B re-observation diff must not start until WM-7A passes.
