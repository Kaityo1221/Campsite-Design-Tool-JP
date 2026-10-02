# Campsite Bridge / Project Contract v1

Updated: 2026-09-21  
Scope: Next Bridge flow only  
Canonical repository: `Kaityo1221/Campsite-Design-Tool-JP`

## Purpose

Freeze the data contract used by all device entry points:

```
Bridge Payload
  -> Receiver Adapter
  -> campsiteProject.v1
  -> CREATIVE MODE
  -> Distance
  -> Pre-submit
```

The canonical storage key is **`campsiteProject.v1`**.  
Any other spelling is invalid.

This contract does not change the normal CSV / KML / KMZ flow.

## 1. Bridge Payload

Protocol:

```
CAMPSITE_BRIDGE_POI_V1
```

Required top-level fields:

- `type`: `CAMPSITE_BRIDGE_POI_V1`
- `bridgeVersion`
- `schemaVersion`
- `handshakeId`
- `pois[]`

Optional / contextual fields:

- `bridgePlatform`
- `selectedBounds`
- `autoContinue`

Each POI is normalized to:

- `guid`
- `title`
- `lat`
- `lng`
- `gameEntity`: `POKESTOP | GYM | POWERSPOT`
- `gameStatus`: `ACTIVE | INACTIVE | UNKNOWN`
- `sponsored`
- `smr`
- `imageUrl`
- `description`
- `s2L14`
- `s2L17`
- `provenance[]`

Allowed provenance values:

- `WAYFARER_PASSIVE`
- `WFMM_CACHE`
- `BRIDGE_ENRICHMENT`

## 2. Receiver Adapter

Storage key:

```
campsiteBridgeAdapter.v0.3
```

Adapter fields:

- `version`
- `adaptedAt`
- `handoffId`
- `bridgePlatform`
- `sourceCount`
- `duplicateCount`
- `pois[]`

`handoffId` identifies one Bridge receive session.

Preferred form:

```
handshake:<handshakeId>
```

Fallback form for transitional/older cached Receiver data:

```
adapted:<adaptedAt>
```

The same handoff ID must survive Gateway -> Creative -> Gateway rework navigation.

## 3. Polygon Selection Snapshot

Selection storage prefix:

```
campsiteBridgeSelection.
```

The snapshot must contain:

- `version`
- `handoffId`
- `selectedAt`
- `sourceCount`
- `selectedCount`
- `polygon`
- `pois`

A Next-flow Project may only be created from a selection snapshot whose `handoffId` matches the current Adapter handoff.

## 4. Campsite Project

Canonical storage key:

```
campsiteProject.v1
```

Current schema:

```
schemaVersion = "1.0"
source = "bridge"
```

Required project state:

- `schemaVersion`
- `projectId`
- `source`
- `receivedAt`
- `createdAt`
- `sourcePois`
- `polygon`
- `selectedPois`
- `circleRadii`
- `edits`
- `currentPois`
- `addedPois`
- `deletedPois`
- `distanceResult`
- `meta`

Bridge metadata:

- `meta.sourceCount`
- `meta.selectedCount`
- `meta.bridgeSelectionVersion`
- `meta.bridgeAdapterVersion`
- `meta.bridgeHandoffId`
- `meta.bridgePlatform`
- `meta.projectContract = "campsiteProject.v1"`
- `meta.nextFlowVersion`

Default circle policy:

```
[50, 40, 30]
```

## 5. Existing / New POI state

Bridge-selected POIs enter Creative as existing POIs unless a saved Creative state says otherwise.

Creative persists:

- existing/new role
- PokéStop / Gym / PowerSpot entity
- moved coordinates
- renamed title
- description changes
- deleted state
- added POIs

The current design source of truth after Creative begins is `currentPois`, not the original `selectedPois`.

## 6. Previous Project isolation

When a new Next Bridge handoff starts:

- if no existing Bridge Project exists, continue normally;
- if the existing Project has the same `meta.bridgeHandoffId`, preserve it;
- if it has a different handoff ID, remove the stale Bridge Project before a new Project is built;
- a selection snapshot from another handoff must not be used.

This protects a new Bridge import from restoring POIs or polygon state from the previous import while preserving the Save/Rework and Back flows for the same import.

## 7. Device rule

iPhone, Android, and PC may collect POIs differently, but Receiver input must converge on this contract.

Do not create a PC-specific Project schema.

All three device paths must converge at:

```
Bridge Payload -> Adapter -> campsiteProject.v1
```


## 8. Standard flow and emergency fallback

As of 2026-09-21, the Project flow is the default Bridge path on iPhone, Android, and PC.

Standard:

```
Bridge -> Gateway -> Polygon -> campsiteProject.v1 -> CREATIVE MODE
```

The old virtual-CSV handoff remains available only for emergency recovery.

Fallback storage key:

```
campsiteBridgeLegacyFlow.v1
```

When the key is `1`, or `campsiteBridgeLegacy=1` / `campsiteBridgeNext=0` is supplied to the Gateway, the Next Project handler stays inactive and the existing legacy handoff is used.

Normal CSV / KML / KMZ entry remains outside this Bridge switch.

## 9. Optional Wayfarer observation (WM-4A)

The same `campsiteProject.v1` contract accepts optional top-level
`wayfarerObservation`; `schemaVersion` remains `1.0`. Older Projects without this
field remain valid. This is a stored remote observation, separate from editable
`sourcePois`, `selectedPois`, `currentPois`, added/deleted POIs and edits.

The existing observation stores:

- `version` and `observedAt`: snapshot version/time;
- `polygon`: geometry used for that acquisition, distinct from the current
  Creative-owned `project.polygon` after subsequent edits;
- `zones.interior`, `zones.reference100`, `zones.reserve200`: retained POIs with
  stable GUID/poiId and type/Active/Inactive state;
- counts and visible/retained totals;
- `acquisition.bufferMeters` and tile/transport/completeness diagnostics.

Do not upgrade an unverified or incomplete acquisition to complete during save,
restore or handoff. RESERVE_200 remains stored and hidden. No 100m/200m boundary
lines are drawn. Future diff/absence/merge state is reserved for later phases.

RESULT and Creative editing callbacks can hold different in-memory Project
objects. The feature observation integration must carry the latest stored
observation through the existing Creative timer, pagehide and navigation saves.
Only a matching `source`, `projectId` and `meta.bridgeHandoffId` may participate.
A detached callback must not overwrite a replaced/removed Project or import its
observation into another handoff. Observation removal must not be undone by a
stale callback.

See `wm-phase-gates.md` for acceptance evidence and subsequent WM-4 subphases.
