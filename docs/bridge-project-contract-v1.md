# Campsite Bridge / Project Contract v1

Updated: 2026-09-21  
Scope: Next Bridge flow only  
Canonical repository: `Kaityo1221/Campsite-Design-Tool-JP`

## Purpose

Freeze the data contract used by all device entry points:

```
Bridge Payload
  -> Receiver Adapter
  -> campssiteProject.v1
  -> CREATIVE MODE
  -> Distance
  -> Pre-submit
```

The canonical storage key is **`campsiteProject.v1`**.  
`campssiteProject.v1` and other misspellings are invalid.

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
Bridge Payload -> Adapter -> campssiteProject.v1
```
