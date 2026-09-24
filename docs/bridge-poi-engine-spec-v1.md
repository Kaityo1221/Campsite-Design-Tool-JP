# Campsite Bridge POI Engine Specification v1

Updated: 2026-09-25  
Status: FROZEN for initial implementation  
Repository: `Kaityo1221/Campsite-Design-Tool-JP`

## 1. Purpose

Campsite Bridge POI Engine is the normalization/classification layer between Wayfarer Map data and the existing Campsite Bridge payload.

Its job is intentionally narrow:

```text
Wayfarer Map data
  -> Parser
  -> POI classification
  -> map display model
  -> Bridge V1 export adapter
  -> CAMPSITE_BRIDGE_POI_V1
```

The Engine must not contain campsite design evaluation, placement recommendations, ranking, scoring, or distance-policy logic.

## 2. Security boundary

The Wayfarer-side runtime is treated as a public/untrusted execution environment.

Allowed responsibilities:

- read POI data available to the current authenticated Wayfarer Map session;
- minimally normalize POI fields;
- classify Pokémon GO game entity state from the source game-object metadata;
- deduplicate by stable POI identifier;
- prepare map-display state;
- adapt supported POIs to the existing Bridge V1 contract.

Not allowed on the Wayfarer side:

- Campsite internal placement logic;
- 50 m / 40 m / 30 m design policy decisions;
- candidate scoring or ranking;
- recommendation logic;
- unpublished CA operating rules;
- exposing confidential decision tables.

No Wayfarer cookie, token, or credential is persisted by the Engine.

## 3. Input source

Initial source:

```text
/api/v1/vault/mapview/gcs
```

The Engine accepts raw POI objects returned from the Wayfarer Map session.

Expected source fields may include:

- `poiId` / `guid` / `id`
- `title` / `name` / `poiName`
- `latE6` / `lngE6`
- `lat` / `lng`
- `gmo[]`
- image / description fields when available
- sponsorship / SMR metadata when available

The parser must tolerate absent optional fields.

## 4. Parser output

A valid parsed POI must have:

- `guid`
- `title`
- `lat`
- `lng`
- normalized source metadata needed for classification

Coordinate rules:

```text
-90 <= lat <= 90
-180 <= lng <= 180
```

Invalid POIs are rejected before classification.

A POI is invalid when any of the following is true:

- source object is not an object;
- stable identifier is empty;
- latitude or longitude is not finite;
- coordinates are outside the valid range.

Optional metadata may be preserved when available:

- `sponsored`
- `smr`
- `imageUrl`
- `description`
- `s2L14`
- `s2L17`

## 5. Engine classification

Internal Engine classification field:

```text
poiKind
```

Allowed v1 values:

```text
POKESTOP
GYM
POWERSPOT
NOT_IN_GAME
UNKNOWN
```

`UNKNOWN` is diagnostic-only and must not be exported through Bridge V1.

### 5.1 Pokémon GO source object

For v1, a source `gmo[]` item is considered a supported Pokémon GO game object when:

- `status` is `ACTIVE`;
- `entity` normalizes to `POKESTOP`, `GYM`, or `POWERSPOT`;
- `gameBrand` is `HOLOHOLO` or is absent/empty.

The empty-brand allowance is retained for compatibility with source responses that omit `gameBrand`.

### 5.2 Entity priority

If a single POI unexpectedly contains multiple supported active entities, use this deterministic priority:

```text
GYM
POKESTOP
POWERSPOT
```

This preserves the current Bridge PC behavior.

### 5.3 NOT_IN_GAME

A valid Wayfarer POI becomes:

```text
poiKind = NOT_IN_GAME
```

when it contains no supported active Pokémon GO game object.

This includes POIs whose available game objects are inactive, unsupported, or belong only to another game brand.

`NOT_IN_GAME` means only "not represented by a supported active Pokémon GO entity in the current source data". It must not be treated as a permanent eligibility judgment.

### 5.4 UNKNOWN

`UNKNOWN` is reserved for a valid POI whose source structure is present but cannot be classified safely because the relevant game-object metadata is malformed or ambiguous.

UNKNOWN must remain visible in diagnostics and must never be silently converted to another entity.

## 6. Internal Engine POI shape

Minimum normalized internal shape:

```js
{
  guid: string,
  title: string,
  lat: number,
  lng: number,
  poiKind: 'POKESTOP' | 'GYM' | 'POWERSPOT' | 'NOT_IN_GAME' | 'UNKNOWN',
  gameStatus: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN',
  sponsored: boolean,
  smr: boolean | null,
  imageUrl: string,
  description: string,
  s2L14: string,
  s2L17: string,
  provenance: ['WAYFARER_PASSIVE'],
  reasonCode: string
}
```

`reasonCode` is diagnostic state only. It must describe source classification, not Campsite design logic.

Initial reason codes:

```text
ACTIVE_GYM
ACTIVE_POKESTOP
ACTIVE_POWERSPOT
NO_ACTIVE_SUPPORTED_GAME_OBJECT
AMBIGUOUS_GAME_OBJECT
```

## 7. Deduplication

The canonical v1 deduplication key is `guid`.

Rules:

1. invalid POIs are rejected first;
2. valid POIs are normalized;
3. duplicate GUIDs collapse to one POI;
4. later source data for the same GUID may replace earlier source data within the same collection snapshot;
5. duplicate count is retained in diagnostics.

Coordinate-only deduplication is not used in v1.

## 8. Map display contract

The Engine exposes all valid classified POIs to the Bridge map-display layer, including `NOT_IN_GAME` and `UNKNOWN`.

Required display categories:

- PokéStop
- Gym
- Power Spot
- Not in Game
- Unknown / diagnostic

The exact visual color/icon implementation is separate from this specification, but the category must be preserved without reclassification by the renderer.

Rendering must use the normalized `lat` / `lng` without coordinate offsets.

## 9. Bridge V1 export compatibility

The existing public Bridge protocol remains:

```text
CAMPSITE_BRIDGE_POI_V1
```

The POI Engine must not introduce a new Receiver protocol in v1.

The current Receiver contract accepts only:

```text
POKESTOP
GYM
POWERSPOT
```

Therefore the v1 export adapter maps:

| Engine `poiKind` | Bridge `gameEntity` | Bridge `gameStatus` | Export |
| --- | --- | --- | --- |
| `POKESTOP` | `POKESTOP` | `ACTIVE` | yes |
| `GYM` | `GYM` | `ACTIVE` | yes |
| `POWERSPOT` | `POWERSPOT` | `ACTIVE` | yes |
| `NOT_IN_GAME` | n/a | `INACTIVE` conceptually | no |
| `UNKNOWN` | n/a | `UNKNOWN` | no |

`NOT_IN_GAME` and `UNKNOWN` remain available to local display/diagnostics but are excluded from `CAMPSITE_BRIDGE_POI_V1.pois[]` until the shared Receiver contract is intentionally versioned.

Do not send an invented `gameEntity` value such as `NOT_IN_GAME` through Bridge V1.

## 10. Bridge POI export shape

Exported POIs continue to use the existing fields:

```js
{
  guid,
  title,
  lat,
  lng,
  gameEntity,
  gameStatus,
  sponsored,
  smr,
  imageUrl,
  description,
  s2L14,
  s2L17,
  provenance
}
```

Required provenance for direct Wayfarer acquisition:

```text
WAYFARER_PASSIVE
```

The POI Engine must not change `campsiteProject.v1`, Receiver Adapter storage, Gateway selection storage, or the standard Bridge handshake.

## 11. Diagnostics

One collection run should produce diagnostics separately from the public Bridge POI payload.

Minimum counters:

```text
sourceCount
validCount
invalidCount
duplicateCount
pokestopCount
gymCount
powerspotCount
notInGameCount
unknownCount
exportCount
```

The diagnostics object is local development/operational state and is not required by `CAMPSITE_BRIDGE_POI_V1`.

No confidential Campsite evaluation data may be included in diagnostics exposed on the Wayfarer page.

## 12. Determinism

For the same normalized source snapshot, the Engine must produce the same:

- accepted/rejected POI set;
- `poiKind`;
- reason code;
- deduplicated output;
- Bridge-export set.

Classification must not depend on map animation timing, DOM marker color, or third-party script rendering.

## 13. WFMM coexistence

WFMM may be present, but the Engine classification source of truth is the normalized Wayfarer source data, not WFMM marker appearance.

Rules:

- do not alter WFMM settings or storage;
- do not require WFMM to classify POIs;
- if WFMM is installed, avoid duplicate visual overlays where the existing Bridge coexistence behavior already suppresses them;
- Bridge acquisition/export must continue to work without WFMM.

## 14. Non-goals for POI Engine v1

The following are explicitly outside v1:

- Campsite candidate quality evaluation;
- 50 m / 40 m / 30 m spacing decisions;
- S2 eligibility decisions;
- POI recommendation/ranking;
- AI learning;
- Supabase/R2 persistence of Wayfarer session data;
- changing `CAMPSITE_BRIDGE_POI_V1`;
- changing `campsiteProject.v1`;
- Chrome Web Store publication;
- replacing WFMM.

## 15. Initial test matrix

Parser/classifier implementation must cover at least:

1. active HOLOHOLO PokéStop -> `POKESTOP`;
2. active HOLOHOLO Gym -> `GYM`;
3. active HOLOHOLO Power Spot -> `POWERSPOT`;
4. absent `gameBrand` with supported active entity -> corresponding active entity;
5. valid Wayfarer POI with no `gmo` -> `NOT_IN_GAME`;
6. only inactive supported game objects -> `NOT_IN_GAME`;
7. only non-HOLOHOLO game objects -> `NOT_IN_GAME`;
8. multiple supported active entities -> priority `GYM > POKESTOP > POWERSPOT`;
9. duplicate GUID -> one normalized POI plus duplicate diagnostic count;
10. invalid latitude/longitude -> rejected;
11. empty GUID -> rejected;
12. malformed/ambiguous game-object metadata -> `UNKNOWN` where classification cannot be made safely;
13. `NOT_IN_GAME` / `UNKNOWN` -> not included in Bridge V1 export;
14. exported active POIs -> accepted by the existing Receiver contract.

## 16. Definition of done for specification task 1

Task 1 is complete when these decisions are frozen:

- input source and parser boundary;
- normalized internal POI shape;
- entity classification rules;
- NOT_IN_GAME behavior;
- deduplication key;
- diagnostics boundary;
- Bridge V1 compatibility behavior;
- security/non-goal boundary;
- initial test matrix.

Implementation task 2 must follow this document unless this spec is deliberately revised first.
