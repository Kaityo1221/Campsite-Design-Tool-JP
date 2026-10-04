# Wayfarer Observe Flow Specification v1

Updated: 2026-10-01  
Status: FROZEN for WM-0  
Repository: `Kaityo1221/Campsite-Design-Tool-JP`  
Baseline: `main@53d941cfe85d72bff724c5f340efdd4abe03c613`  
Implementation branch: `feature/wm-wayfarer-observe-flow`

## 0. Purpose

This document freezes the product and architecture requirements for the new Wayfarer-to-Campsite flow.

The intended user flow is:

```text
範囲を決める
  -> 🔭 拠点内を観察
  -> 現在のPOIを確認
  -> Campsiteで設計する
```

This is not a simple Bridge transfer. The Wayfarer side is an observation step for the current Pokémon GO state of a campsite area, followed by design work in Campsite.

WM-0 changes documentation only. No runtime behavior is changed by this phase.

---

## 1. Baseline facts verified at WM-0

At the baseline commit:

- `bridge-pc/page-collector.js` fetches Wayfarer map data directly from:
  `/api/v1/vault/mapview/gcs`
- the GCS request uses `credentials: 'include'`
- the current collector derives its request rectangle from the currently displayed Google Map bounds and includes the current map zoom in its selection metadata
- `js/bridge-wayfarer-map-adapter.js` can resolve the Google Map from Wayfarer `app-wf-base-map`
- `campsiteProject.v1` is the canonical project storage contract
- the current project schema version is `1.0`
- after Creative begins, current project state is represented by `currentPois`, not the original `selectedPois`
- the existing Creative architecture already contains the records/refresh/geometry/scene/keyed-renderer path that the new flow must follow

These are implementation observations, not permission to skip WM-1 verification.

---

## 2. Core product ownership

### 2.1 Initial polygon ownership

The first design polygon is created on Wayfarer.

### 2.2 Ownership after first successful Campsite handoff

After the first successful handoff:

```text
Campsite側の最新ポリゴン = 正本
```

Wayfarer and Campsite must not become two editable masters.

When a project later returns to Wayfarer for reacquisition, Wayfarer receives the latest Campsite polygon and acts as an observation surface only. The polygon is not edited there during that return flow.

---

## 3. Wayfarer / WFMM rule

WFMM is not a required product dependency for the new flow.

However, this is a WM-1 verification target, not a WM-0 implementation fact.

Required WM-1 proof:

```text
Wayfarerログイン済み
  -> Wayfarer本体Map
  -> Campsite Bridge
  -> GCS直接取得
```

must work without relying on WFMM state, cache, rendering, or map ownership.

If Wayfarer itself changes and this cannot be guaranteed, WM-1 must STOP and report the dependency instead of silently reintroducing WFMM.

---

## 4. Polygon creation specification

### 4.1 Common rules

- one project has one polygon
- minimum 3 vertices
- maximum 30 vertices
- completion automatically connects the last vertex to the first
- self-intersection is prohibited
- when self-intersection exists, the intersecting edges must be indicated and completion must be disabled
- provide `1つ戻す`
- provide `最初からやり直す`
- full reset requires a confirmation dialog
- an unfinished polygon is stored locally
- after reload, if a draft exists, ask:
  `前回の作成途中があります。再開しますか？`
- the draft is not removed until successful Campsite handoff
- successful handoff must not close the Wayfarer page

### 4.2 Mobile interaction

Use the same interaction concept as current Creative Mode:

- fixed center crosshair
- user moves the map
- user presses `頂点を追加`

### 4.3 PC interaction

Do not use the fixed center crosshair.

Instruction:

`地図上をクリックして頂点を追加してください`

The clicked map coordinate becomes the vertex.

---

## 5. Acquisition geometry

The acquisition geometry has three zones.

```text
A. polygon interior
B. polygon exterior to +100 m
C. +100 m to +200 m reserve
```

Wayfarer acquisition target:

```text
polygon + 200 m
```

Creative normal visibility target:

```text
polygon interior + exterior 100 m
```

The 100-200 m reserve is retained for local reclassification after Campsite polygon edits but is normally hidden from the user.

The acquisition engine must derive the required coverage from the project polygon. It must not depend on the current Wayfarer viewport or zoom.

---

## 6. POI scope

Only Pokémon GO-related POIs participate in this flow:

- PokéStop
- Gym
- Active PowerSpot
- Inactive PowerSpot

`NOT_IN_GAME` Wayspots are excluded from the new design screen.

### 6.1 PowerSpot state

Wayfarer observation UI:

- Active PowerSpot and Inactive PowerSpot are separate states
- counts remain separate

Creative Mode:

- both render using the same purple diamond visual
- Active / Inactive state remains preserved in internal data

---

## 7. Observation action

The action label is unified for both initial and later acquisition:

`🔭 拠点内を観察`

It can be executed manually at any time when the current flow permits reacquisition.

After successful observation:

- original Wayfarer POI visuals are hidden for the observation result view
- Campsite Overlay becomes the visible POI layer

This hiding behavior belongs to WM-3, not WM-1.

---

## 8. Observation overlay

### 8.1 Visibility

- polygon interior POIs: normal opacity
- exterior 0-100 m reference POIs: lighter opacity
- reserve 100-200 m: hidden

### 8.2 Legend

Do not show the legend permanently.

Provide a `凡例` button that opens it.

### 8.3 POI information

Tapping a POI opens one bottom information panel.

Display:

- title
- POI type

Do not display coordinates.

Only one panel exists at a time.

Selecting another POI updates that panel.

Close by:

- `×`
- tapping the map

---

## 9. Observation counts

Counts must distinguish the design area from the additional 100 m reference ring.

### 設計範囲内

- PokéStop
- Gym
- Active PS
- Inactive PS

### 外周100mの追加参照分

- PokéStop
- Gym
- Active PS
- Inactive PS

The outer number means POIs outside the polygon that were added by the +100 m reference range. It is not a cumulative `polygon +100m` total.

If the usable Pokémon GO POI count is zero, the flow must not proceed to Campsite.

---

## 10. Campsite polygon editing

After first successful handoff, Campsite owns the current polygon.

Campsite may edit the polygon.

For every polygon edit, evaluate whether:

```text
new polygon + 100 m
```

is fully covered by the previously acquired reserve.

### 10.1 Covered by reserve

If fully covered:

- do not return to Wayfarer
- reclassify retained POIs locally into interior / +100 m / reserve
- preserve current Creative edits

### 10.2 Outside reserve

If not fully covered:

- show `Wayfarerで再取得`
- send the latest Campsite polygon to Wayfarer
- Wayfarer is observation-only on return
- no polygon editing occurs on Wayfarer in this return path

---

## 11. Creative Mode integration architecture

Do not create a new independent Creative Mode.

The production Creative Mode remains the architecture baseline.

Required ownership path:

```text
Existing Creative UI
  -> records
  -> refresh()
  -> Adapter
  -> Geometry
  -> Unified Scene
  -> keyed Renderer
  -> Leaflet
```

`records` remains the mutation source of truth.

Candidate Store / Map Engine must not take ownership of mutation.

The existing Creative operations remain authoritative:

- Add
- Move
- Delete
- Undo
- Redo
- Save
- other existing edit operations

Outer reference POIs must not be forced into editable `records` merely to render them.

Target direction:

```text
Reference Adapter / Reference Layer
  -> Unified Scene
```

---

## 12. Creative reference POI behavior

The polygon exterior 0-100 m POIs are visible in Creative.

They are:

- slightly lighter
- read-only
- tappable for inspection
- not movable
- not deletable
- not renameable

Reference POIs show only the 50 m circle continuously.

Existing editable POIs inside the design polygon retain current:

- 50 m
- 40 m
- 30 m

circle behavior.

---

## 13. Distance warning specification

When a new candidate is less than 50 m from:

- an existing editable POI
- an exterior reference POI
- another new candidate

show a warning.

Placement is not prohibited.

50 m is not an absolute placement ban, so the UI must not introduce stronger prohibition semantics for 40 m or 30 m.

Examples:

```text
⚠ 43.2m / 既存POI
⚠ 38.7m / 新規候補
```

If the nearest reason is an exterior reference POI, make that explicit, for example:

`設計範囲外の既存POIから50m未満です`

Rules:

- warning is fixed near the bottom of the screen
- show only when nearest applicable distance is below 50 m
- show while adding a candidate
- show while a candidate is selected
- recalculate continuously while the map is moved
- recalculate immediately after existing POI Move/Delete/Undo/Redo

---

## 14. Creative Mode TEST strategy

Production `creative/index.html` must not be used as the development playground for this flow.

Create a `Creative Mode TEST` page.

The TEST page must:

- load the same production Creative runtime
- add only the Wayfarer-flow-specific patch/module layer
- avoid a copied/forked Creative implementation

Primary test path:

```text
Wayfarer Map
  -> ポリゴン作成
  -> 🔭 拠点内を観察
  -> POI確認
  -> Campsiteへ進む
  -> Creative Mode TEST
```

When the public TEST page becomes available, provide its direct URL to the project owner.

Direct URL launch is useful for debugging, but the primary acceptance path remains the full Wayfarer-to-Creative flow.

Production Creative is not connected until later acceptance.

---

## 15. Refresh age

The observation result may become stale.

Initial product threshold:

```text
90 days
```

After 90 days:

- do not auto-open a modal
- show an update hint/badge on `🔭 拠点内を観察`

This threshold can be revisited after real-world operation, but WM-0 freezes 90 days as the initial implementation target.

---

## 16. Stable identity

Use stable Wayfarer identity:

```text
GUID / poiId
```

for POI identity.

Do not use coordinates as deletion identity.

Coordinate changes are a diff event on the same stable POI.

---

## 17. Re-observation diff

A later observation compares the latest complete remote snapshot with the previous Wayfarer base snapshot.

The user sees a batch old-to-new summary.

Examples:

```text
PokéStop 18 -> 20
Active PS 4 -> 2
○○広場 Inactive PS -> Active PS
□□記念碑 なし -> PokéStop
```

Diff categories include:

- new POI
- disappearance candidate
- Active / Inactive change
- PokéStop / Gym / PowerSpot type change
- coordinate change
- title change

Apply using one action:

`この内容で更新`

Do not force one-by-one confirmation for normal bulk changes.

---

## 18. Disappearance policy

One missing acquisition must not delete a POI.

Absence counting is allowed only when acquisition is both:

- successful
- complete

Policy:

### First consecutive complete-snapshot absence

State:

`未確認`

Creative keeps the POI.

### Second consecutive complete-snapshot absence

State:

`削除候補`

A failed or incomplete acquisition does not increment absence count.

This rule requires a completeness signal from the acquisition engine.

The exact property name may be `coverageComplete` or an equivalent explicit state, but an ambiguous successful HTTP response alone is insufficient.

---

## 19. Merge model

Wayfarer refresh must not overwrite Creative work.

Model:

```text
Base   = previous accepted Wayfarer snapshot
Local  = Creative edits
Remote = latest complete Wayfarer snapshot
```

Preserve Local:

- new candidates
- existing POI moves
- title edits
- deletions
- other Creative edits

Only fields changed by both Local and Remote for the same stable GUID require conflict review.

Non-conflicting Remote changes can be merged automatically into the accepted observation state.

---

## 20. Project contract direction

Do not introduce a parallel project schema.

Continue using:

`campsiteProject.v1`

WM-4 will extend the existing contract backward-compatibly.

The exact additive fields are not frozen by WM-0 because WM-1 to WM-3 may reveal acquisition metadata requirements.

At minimum the later extension must be able to preserve:

- current polygon
- Wayfarer base snapshot identity/time
- acquired coverage/reserve description
- interior/reference/reserve classification data or enough data to reproduce it
- acquisition completeness state
- POI stable identity
- Active/Inactive state
- refresh/diff metadata needed by WM-7

Current schema version remains `1.0` until WM-4 intentionally changes the contract.

---

## 21. WM-1 acquisition engine requirements

WM-1 is the next implementation phase and has priority over UI work.

### 21.1 Required questions

WM-1 must determine:

1. Can Wayfarer main map + GCS direct acquisition work with no WFMM dependency?
2. For the same polygon, does changing Wayfarer zoom leave the acquired GUID set unchanged?
3. Can polygon +200 m be acquired without silent omissions?
4. Does GCS impose result count, cell, bounds, density, or other practical limits?
5. If one request is insufficient, can the acquisition area be partitioned and merged by GUID?
6. Can the engine explicitly state whether requested coverage is complete?

### 21.2 Required properties

The target acquisition engine must:

- accept project geometry rather than current display bounds as its logical input
- create one or more GCS acquisition requests from the required coverage
- deduplicate merged output by stable GUID
- preserve POI classification through the existing Parser / Classifier boundary
- expose acquisition diagnostics
- expose explicit complete/incomplete coverage state
- make viewport zoom irrelevant to the logical result set

### 21.3 STOP conditions

WM-1 must STOP before WM-2 if any of the following remains unresolved:

- WFMM is actually required but the dependency has not been accepted
- the same test polygon produces unexplained GUID-set changes solely from Wayfarer zoom
- acquisition can silently truncate results
- split acquisition cannot reliably reconstruct requested coverage
- completeness cannot be distinguished from partial success

---

## 22. Implementation phases

```text
WM-0  Specification freeze
WM-1  POI acquisition engine
WM-2  Wayfarer polygon UI
WM-3  🔭 拠点内を観察 / overlay / zone classification
WM-4  Project / Handoff backward-compatible extension
WM-5  Campsite polygon editing
WM-6  Creative reference POIs / distance warning
WM-7  Re-observation / diff / disappearance / merge
WM-8  Device regression / public release
```

The phase rule is:

```text
implement
  -> test
  -> diff review
  -> PASS
  -> next phase
```

Do not skip a phase gate.

---

## 23. Branch and release policy

- do not merge `bridge-map-lab` directly into `main`
- use a dedicated feature branch created from current `main`
- production Creative Mode should remain unchanged until TEST integration is ready
- WM-0 is documentation-only
- each later phase must keep its diff as narrow as practical
- no phase may advance itself after failing its acceptance gate

Current dedicated branch:

`feature/wm-wayfarer-observe-flow`

---

## 24. WM-0 acceptance

WM-0 passes when all are true:

- this specification is committed on the dedicated feature branch
- no production runtime file changed
- no Creative runtime file changed
- no project schema changed
- no behavior changed
- WM-1 unknowns are explicitly marked as verification targets rather than assumptions
- the branch diff from baseline contains documentation only

After WM-0 PASS, proceed to WM-1 acquisition-engine investigation before any polygon UI implementation.
