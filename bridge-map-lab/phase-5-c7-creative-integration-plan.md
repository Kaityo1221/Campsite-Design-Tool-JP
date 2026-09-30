# Phase 5-C7 Creative Mode integration plan

## Purpose

Prepare the real Creative Mode connection without changing Creative Mode production behavior in Phase 5-C7.

The integration source of truth remains `records`.
`project.addedPois` remains a derived persistence format and is not edited by Candidate Store / Map Engine.

## Confirmed current behavior

Creative Mode edits `records` directly and mutation paths have side effects beyond coordinates:

- add: record creation, history, redraw, snapshot, guide/persistence updates
- move: `r.latlng` update plus history, redraw, snapshot, comment-review handling
- delete/undo/redo: `deleted` state plus history/redraw/snapshot
- Bridge save: `syncCampsiteProjectFromCreative(project)` walks `records` and derives `project.currentPois`, `project.addedPois`, `project.deletedPois`, and edits

Therefore Phase 5-C7 must not replace those mutation paths.

## Initial integration direction

```text
Existing Creative Mode UI
        |
        | direct mutation
        v
      records
        |
        | store.refresh()
        v
Candidate records adapter
        |
        v
Candidate snapshot
        |
        v
Candidate Geometry
        |
        v
Unified Scene
        |
        v
Keyed Renderer
        |
        v
Leaflet
```

The first Creative Mode integration is read-following, not mutation-owning.

## Candidate source rule

Only these `records[].layer` values are Candidate records:

- `new-pokestop`
- `new-gym`
- `new-power`

`existing-*` is never modified by Candidate Store.
`deleted:true` Candidate records are excluded from the new Map Engine but remain in `records`.
Invalid Candidate records are excluded with diagnostics and are not automatically repaired or removed.

## Phase 5-C7 hook points

### 1. Initialize

After Creative Mode `records` exists and the editor is ready:

1. Create records-backed Candidate refresh store with `() => records`.
2. Subscribe exactly once.
3. On subscription notification, rebuild Candidate Geometry and Unified Scene.
4. Pass the Scene to the existing keyed Renderer.
5. Keep a single unsubscribe / teardown handle.

### 2. Existing UI mutation hooks

For the first integration, keep existing mutation code unchanged and append `candidateStore.refresh()` after successful mutation completion.

Required refresh points:

- Candidate add completion
- Candidate move completion
- Candidate delete completion
- Candidate undo / redo when Candidate visibility or coordinates can change
- Project / KML / CSV / workspace restore that replaces or rebuilds `records`

Do not refresh while a draft marker is only being previewed.

### 3. Save / navigation

No change to `syncCampsiteProjectFromCreative(project)`.
No direct write to `project.addedPois` from Map Engine.
Existing save/navigation flow continues to derive Project data from `records`.

### 4. Lifecycle

Map close / editor teardown must:

1. unsubscribe Candidate Store listener
2. destroy Map Renderer
3. remove Map-only event listeners
4. discard Map-only references

It must not clear or rewrite `records`.

## Important ownership rule

Phase 5-C7 does **not** wire Candidate Store `add/remove/move` into existing Creative Mode controls.
The existing UI remains mutation owner until a later dedicated migration phase.

Reason: current controls also manage history, snapshot, comments, guides and persistence. Replacing them now would create regression risk outside Candidate Map scope.

The Store Core `add/remove/move` contract remains valid for future Map-owned editing, but production connection begins with `refresh()` coexistence.

## Renderer contract

Stable keys remain:

```text
existing marker:  marker:poi:<guid>
existing circle:  circle50:poi:<guid>
candidate marker: marker:candidate:<id>
candidate circle: circle50:candidate:<id>
```

A Candidate move must update the same Candidate Leaflet layers in place.
Existing POI layers must not be recreated by Candidate changes.

## Not in Phase 5-C7

- 50m violation judgment
- 40m / 30m Candidate circles
- S2
- live Bridge data changes
- `project.addedPois` schema changes
- Candidate auto-placement
- AI Candidate generation
- replacement of Creative Mode history / undo / redo
- production feature flag

## C7 readiness gate

C7 is ready to close when the LAB harness proves:

1. records-backed snapshot starts correctly
2. direct Candidate add is invisible before refresh
3. refresh adds exactly Candidate Marker + Circle
4. existing Leaflet IDs survive add
5. direct Candidate move + refresh updates Candidate in place
6. existing Leaflet IDs survive move
7. Candidate Leaflet IDs survive move
8. direct `deleted:true` + refresh removes only Candidate layers
9. existing Leaflet IDs survive removal
10. existing-* record changes do not enter Candidate pipeline
11. invalid Candidate is isolated without stopping valid Candidates
12. one refresh emits one change notification
13. subscriber drives one render pass per refresh
14. list remains copy-isolated
15. unsubscribe stops automatic render callback
16. Project persistence is not touched by the harness
17. no Creative Mode production file is changed in C7

After C7 PASS, prepare the actual Creative Mode insertion patch as the next gated phase. Do not silently advance into it.
