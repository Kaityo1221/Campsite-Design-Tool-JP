# Campsite Bridge POI Engine Specification v1.1

Updated: 2026-09-26  
Status: FROZEN for v1.1 implementation alignment  
Repository: `Kaityo1221/Campsite-Design-Tool-JP`

> File path remains `bridge-poi-engine-spec-v1.md` for existing CI/watch compatibility. This document supersedes the initial v1 behavior where `NOT_IN_GAME` was treated as a visible map category and inactive Power Spots were not modeled separately.

## 1. Purpose

Campsite Bridge POI Engine is the normalization/classification layer between Wayfarer Map data and Campsite Bridge.

The product flow is:

```text
Wayfarer Map data
  -> Parser
  -> POI Classifier
  -> Reference layer
  -> Map display model
  -> Bridge V1 adapter
  -> CAMPSITE_BRIDGE_POI_V1
  -> Receiver
  -> Creative Mode
```

The Engine is intentionally narrow. It identifies what a Wayfarer POI currently represents for Pokémon GO and preserves selected reference information required by Campsite.

The Engine must not contain:

- 50 m / 40 m / 30 m distance-policy decisions;
- campsite candidate evaluation;
- candidate ranking/scoring;
- recommendation logic;
- S2 placement eligibility decisions;
- unpublished CA operating rules.

Distance evaluation belongs to Campsite after Bridge handoff.

## 2. Core ownership rule

A POI must be classified exactly once.

Responsibility is divided as follows:

| Layer | Owns | Must not own |
| --- | --- | --- |
| Parser | source validation, field normalization, coordinate normalization, source game-object normalization, GUID dedupe | `poiKind`, `referenceKind`, active/inactive business classification |
| POI Classifier | `poiKind`, `gameEntity`, `gameStatus`, `reasonCode`, `referenceKind`, Bridge eligibility | rendering decisions, distance policy |
| Reference layer | splits classified output into `pois[]`, `referencePois[]`, diagnostics-only records | reclassification from raw GMO data |
| Map display model | visibility and visual category derived from already-classified state | source interpretation or GMO reclassification |
| Bridge V1 adapter | backward-compatible payload serialization | source classification |
| Receiver | validation, storage, active/reference separation, Campsite adapter conversion | Wayfarer source reclassification |
| Creative Mode | selection-range use, distance checks, candidate design | Wayfarer GMO interpretation |

Parser and renderer must never independently decide that a POI is a Gym, PokéStop, Power Spot, Not in Game, or inactive Power Spot.

## 3. Security boundary

The Wayfarer-side runtime is treated as a public/untrusted execution environment.

Allowed responsibilities:

- read POI data available to the authenticated Wayfarer Map session;
- normalize source fields;
- classify Pokémon GO game entity state from source game-object metadata;
- deduplicate by stable POI identifier;
- prepare non-confidential display/reference state;
- adapt supported output to Bridge V1.

Not allowed on the Wayfarer side:

- Campsite internal placement logic;
- 50 m / 40 m / 30 m design policy decisions;
- candidate scoring/ranking;
- recommendation logic;
- confidential decision tables.

No Wayfarer cookie, token, or credential is persisted by the Engine.

## 4. Input source

Initial source:

```text
/api/v1/vault/mapview/gcs
```

Expected source fields may include:

- `poiId` / `guid` / `id`
- `title` / `name` / `poiName`
- `latE6` / `lngE6`
- `lat` / `lng`
- `gmo[]`
- image / description fields
- sponsorship / SMR metadata

Optional fields may be absent.

## 5. Parser contract

### 5.1 Parser responsibility

The Parser performs syntax/shape normalization only.

A valid parsed POI must have:

- `guid`
- `title`
- `lat`
- `lng`
- normalized `sourceGameObjects[]`
- source metadata needed by the Classifier

Coordinate rules:

```text
-90 <= lat <= 90
-180 <= lng <= 180
```

A source POI is rejected before classification when:

- source object is not an object;
- stable identifier is empty;
- latitude or longitude is not finite;
- coordinates are outside the valid range.

### 5.2 Parser must not classify

The Parser must not produce a final `poiKind` or `referenceKind`.

It may normalize source GMO values such as:

```js
{
  entity: 'POKESTOP' | 'GYM' | 'POWERSPOT' | '',
  rawEntity: string,
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN',
  gameBrand: string,
  malformed: boolean
}
```

The current implementation may temporarily expose legacy fields such as `classification`, `gameEntity`, or `gameStatus` during migration, but downstream v1.1 code must treat the Classifier result as the only authoritative classification.

### 5.3 Parser deduplication

Canonical dedupe key:

```text
guid
```

Rules:

1. invalid POIs are rejected first;
2. valid POIs are normalized;
3. duplicate GUIDs collapse to one parsed record;
4. later source data for the same GUID may replace earlier source data within the same collection snapshot;
5. duplicate count is retained in diagnostics.

Coordinate-only deduplication is not used.

## 6. Classifier contract

### 6.1 Supported active Pokémon GO object

A source GMO item is a supported active Pokémon GO game object when:

- `status === ACTIVE`;
- normalized entity is `POKESTOP`, `GYM`, or `POWERSPOT`;
- `gameBrand` is `HOLOHOLO` or absent/empty.

Empty brand remains supported for source compatibility.

### 6.2 Active entity priority

When a single GUID unexpectedly contains multiple supported active entities, choose deterministically:

```text
GYM
POKESTOP
POWERSPOT
```

Once an active entity is selected, that GUID is an active POI and must not also appear in `referencePois[]`.

### 6.3 `poiKind`

Authoritative internal `poiKind` values remain:

```text
POKESTOP
GYM
POWERSPOT
NOT_IN_GAME
UNKNOWN
```

`INACTIVE_POWERSPOT` is not a new `poiKind`. It is a reference subtype represented by `referenceKind`.

### 6.4 `referenceKind`

v1.1 introduces an authoritative optional reference field:

```text
referenceKind = null | NOT_IN_GAME | INACTIVE_POWERSPOT
```

Rules:

#### Active PokéStop / Gym / Power Spot

```text
poiKind        = POKESTOP | GYM | POWERSPOT
gameEntity     = same as poiKind
gameStatus     = ACTIVE
referenceKind  = null
bridgeEligible = true
referenceEligible = false
```

#### Inactive Power Spot

When there is no supported active entity for the GUID, but source metadata contains a supported HOLOHOLO-or-empty-brand Power Spot with `status === INACTIVE`:

```text
poiKind        = NOT_IN_GAME
gameEntity     = POWERSPOT
gameStatus     = INACTIVE
referenceKind  = INACTIVE_POWERSPOT
bridgeEligible = false
referenceEligible = true
```

This record is preserved because a Power Spot may become active again and is therefore relevant to later Campsite distance review.

#### Other valid Not in Game POI

When no supported active entity exists and the record is otherwise safely classifiable, and it is not an inactive Power Spot:

```text
poiKind        = NOT_IN_GAME
gameEntity     = null unless a non-active entity is intentionally preserved for diagnostics
gameStatus     = INACTIVE or UNKNOWN as supported by source metadata
referenceKind  = NOT_IN_GAME
bridgeEligible = false
referenceEligible = true
```

`NOT_IN_GAME` means only:

> not represented by a supported active Pokémon GO entity in the current source snapshot.

It is not a permanent eligibility judgment.

#### Unknown

Malformed or ambiguous relevant game-object metadata becomes:

```text
poiKind        = UNKNOWN
gameEntity     = null
gameStatus     = UNKNOWN
referenceKind  = null
bridgeEligible = false
referenceEligible = false
```

`UNKNOWN` is diagnostics-only and must never be silently converted to `NOT_IN_GAME`.

### 6.5 Inactive priority details

Inactive Power Spot reference detection runs only after active-entity selection.

Therefore:

- active Gym + inactive Power Spot on same GUID -> active Gym only;
- active PokéStop + inactive Power Spot -> active PokéStop only;
- active Power Spot + inactive Power Spot -> active Power Spot only;
- inactive Power Spot with no supported active entity -> `INACTIVE_POWERSPOT` reference.

This prevents one GUID from appearing in both active and reference channels.

## 7. Internal classified POI shape

Minimum v1.1 classified shape:

```js
{
  guid: string,
  title: string,
  lat: number,
  lng: number,
  poiKind: 'POKESTOP' | 'GYM' | 'POWERSPOT' | 'NOT_IN_GAME' | 'UNKNOWN',
  gameEntity: 'POKESTOP' | 'GYM' | 'POWERSPOT' | null,
  gameStatus: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN',
  referenceKind: null | 'NOT_IN_GAME' | 'INACTIVE_POWERSPOT',
  bridgeEligible: boolean,
  referenceEligible: boolean,
  sponsored: boolean,
  smr: boolean | null,
  imageUrl: string,
  description: string,
  s2L14: string,
  s2L17: string,
  provenance: ['WAYFARER_PASSIVE'],
  reasonCode: string,
  sourceGameObjects: Array
}
```

`reasonCode` is diagnostic source state only. It must not encode Campsite placement policy.

Recommended v1.1 reason codes:

```text
ACTIVE_GYM
ACTIVE_POKESTOP
ACTIVE_POWERSPOT
INACTIVE_POWERSPOT_REFERENCE
NO_ACTIVE_SUPPORTED_GAME_OBJECT
AMBIGUOUS_GAME_OBJECT
```

## 8. Reference layer

The Reference layer receives already-classified Engine records and creates delivery channels without inspecting raw GMO data again.

Output channels:

```js
{
  activePois: [...],
  referencePois: [...],
  diagnosticsOnly: [...]
}
```

Rules:

| Classifier result | Channel |
| --- | --- |
| active `POKESTOP` / `GYM` / `POWERSPOT` | `activePois` |
| `referenceKind === INACTIVE_POWERSPOT` | `referencePois` |
| `referenceKind === NOT_IN_GAME` | `referencePois` |
| `poiKind === UNKNOWN` | `diagnosticsOnly` |

A GUID must appear in at most one channel.

## 9. Map display contract

v1.1 map display policy is product-defined as follows:

| State | Wayfarer/Bridge map visibility | Visual |
| --- | --- | --- |
| PokéStop ACTIVE | visible | blue circle |
| Gym ACTIVE | visible | red hexagon |
| Power Spot ACTIVE | visible | purple diamond |
| Inactive Power Spot reference | visible | light-pink diamond |
| Not in Game reference | hidden | none |
| Unknown | hidden except diagnostics | none |
| Candidate | Creative Mode only | orange |

The renderer must consume classified/reference state. It must not interpret GMO source data.

Rendering uses normalized `lat` / `lng` without coordinate offsets.

## 10. Distance-review boundary

Distance policy is not part of POI Engine classification.

After Bridge handoff, Campsite distance review considers:

- active PokéStop;
- active Gym;
- active Power Spot;
- inactive Power Spot reference.

It does not consider:

- `NOT_IN_GAME` reference;
- `UNKNOWN` diagnostic records.

Inactive Power Spots remain relevant because they may reappear as active Power Spots.

No 50 m / 40 m / 30 m calculation is allowed inside Parser, Classifier, Reference layer, or Bridge V1 exporter.

## 11. Bridge V1 compatibility

The public protocol type remains unchanged:

```text
CAMPSITE_BRIDGE_POI_V1
```

No new top-level protocol type is introduced by POI Engine v1.1.

### 11.1 Required active channel

`pois[]` remains the existing active-POI contract and contains only:

```text
POKESTOP ACTIVE
GYM ACTIVE
POWERSPOT ACTIVE
```

Do not place `NOT_IN_GAME`, `UNKNOWN`, or inactive records in `pois[]`.

### 11.2 Optional reference extension

v1.1 formalizes the already-supported Receiver extension:

```js
referencePois?: ReferencePoi[]
```

Absence of `referencePois` must continue to behave as an empty array, preserving backward compatibility with earlier Bridge V1 senders.

Reference shape:

```js
{
  guid: string,
  title: string,
  lat: number,
  lng: number,
  referenceKind: 'NOT_IN_GAME' | 'INACTIVE_POWERSPOT',
  gameEntity: 'POWERSPOT' | 'POKESTOP' | 'GYM' | '',
  gameStatus: 'INACTIVE' | 'UNKNOWN',
  imageUrl: string,
  description: string,
  provenance: string[]
}
```

For `INACTIVE_POWERSPOT`, preferred values are:

```text
gameEntity = POWERSPOT
gameStatus = INACTIVE
```

### 11.3 Export mapping

| Engine state | `pois[]` | `referencePois[]` | diagnostics only |
| --- | --- | --- | --- |
| Active PokéStop | yes | no | no |
| Active Gym | yes | no | no |
| Active Power Spot | yes | no | no |
| Inactive Power Spot | no | yes | no |
| Not in Game | no | yes | no |
| Unknown | no | no | yes |

The optional `referencePois[]` field is additive. Existing consumers that only understand `pois[]` remain compatible.

## 12. Receiver contract

Receiver responsibilities:

1. validate `pois[]` as active supported entities;
2. validate optional `referencePois[]` against supported reference kinds;
3. dedupe each channel by GUID;
4. ensure active GUID ownership wins if an invalid payload contains the same GUID in both channels;
5. store active POIs separately from references;
6. adapt only active POIs into the standard Campsite active POI collection;
7. retain references for visualization/review modules.

Receiver must not inspect raw Wayfarer GMO data to decide reference kind.

Legacy compatibility code that derives a reference from non-active `pois[]` may remain temporarily, but new v1.1 senders must use the explicit `referencePois[]` channel.

## 13. Creative Mode handoff

Normal UX target:

```text
Bridgeで内容確認
  -> Campsiteへ送る
  -> Receiver
  -> Creative Modeへ直接進む
```

The normal count-confirmation screen is not part of the standard flow.

A confirmation/diagnostic screen is shown only when data integrity requires attention, for example:

- active/reference count inconsistency;
- duplicate ownership conflict;
- invalid Bridge records;
- unexpected classification diagnostics above an accepted threshold.

Within the selected range, `bridge-inactive-review.js` may carry `INACTIVE_POWERSPOT` references into Creative Mode.

`NOT_IN_GAME` references remain stored but are not shown on the map and are not used for distance review.

## 14. Diagnostics

One collection run must produce diagnostics separately from active/reference delivery data.

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
inactivePowerSpotReferenceCount
unknownCount
activeExportCount
referenceExportCount
```

Recommended integrity counters:

```text
crossChannelDuplicateCount
unknownReferenceKindCount
invalidReferenceCount
```

No confidential Campsite evaluation data may be included in Wayfarer-side diagnostics.

## 15. Regression baseline

Kwajalein reference dataset is the v1.1 regression baseline:

```text
Active POI                37
Reference total            5
  Not in Game              4
  Inactive Power Spot      1
Visible map POI           38
  Active                  37
  Inactive Power Spot      1
Hidden Not in Game         4
```

Required invariant:

```text
37 active + 4 Not in Game + 1 Inactive Power Spot = 42 classified non-UNKNOWN records
visible map count = 38
```

This dataset must be used to detect accidental reintroduction of Not in Game map rendering or loss of the inactive Power Spot reference.

## 16. Determinism

For the same normalized source snapshot, the Engine must produce the same:

- accepted/rejected POI set;
- deduped GUID set;
- `poiKind`;
- `referenceKind`;
- `reasonCode`;
- active export set;
- reference export set.

Classification must not depend on:

- map animation timing;
- DOM marker color;
- renderer state;
- WFMM marker appearance;
- Creative Mode state.

## 17. WFMM coexistence

WFMM may be present, but source of truth is normalized Wayfarer source data.

Rules:

- do not alter WFMM settings or storage;
- do not require WFMM for classification;
- avoid duplicate visual overlays where current coexistence behavior suppresses them;
- acquisition/export must work without WFMM.

## 18. Non-goals for POI Engine v1.1

Explicitly outside this specification:

- candidate quality evaluation;
- 50 m / 40 m / 30 m spacing decisions;
- S2 eligibility decisions;
- recommendation/ranking;
- AI learning;
- Supabase/R2 persistence of Wayfarer session data;
- replacing WFMM;
- changing `campsiteProject.v1`;
- introducing a new Bridge protocol type.

## 19. v1.1 test matrix

Parser/classifier/reference implementation must cover at least:

1. active HOLOHOLO PokéStop -> active `POKESTOP`;
2. active HOLOHOLO Gym -> active `GYM`;
3. active HOLOHOLO Power Spot -> active `POWERSPOT`;
4. absent `gameBrand` with supported active entity -> corresponding active entity;
5. valid Wayfarer POI with no GMO -> `NOT_IN_GAME` reference;
6. inactive Power Spot with no active entity -> `NOT_IN_GAME` + `referenceKind=INACTIVE_POWERSPOT`;
7. inactive PokéStop/Gym only -> `NOT_IN_GAME` reference, not inactive Power Spot;
8. only non-HOLOHOLO objects -> `NOT_IN_GAME` reference;
9. malformed relevant GMO metadata -> `UNKNOWN`, no active/reference export;
10. active Gym + inactive Power Spot -> Gym only;
11. active PokéStop + inactive Power Spot -> PokéStop only;
12. multiple supported active entities -> priority `GYM > POKESTOP > POWERSPOT`;
13. duplicate GUID -> one authoritative classified record;
14. invalid latitude/longitude -> rejected;
15. empty GUID -> rejected;
16. active records only -> Bridge `pois[]`;
17. `NOT_IN_GAME` / `INACTIVE_POWERSPOT` -> Bridge `referencePois[]` only;
18. `UNKNOWN` -> neither public channel;
19. map display -> active + inactive Power Spot only;
20. Not in Game -> retained but hidden;
21. Receiver without `referencePois` -> still accepts legacy active-only Bridge V1 payload;
22. duplicate GUID across active/reference input -> active wins and diagnostic is emitted;
23. Kwajalein regression -> active 37, references 5 = Not in Game 4 + inactive Power Spot 1, visible 38;
24. Creative Mode distance review receives inactive Power Spot but not Not in Game.

## 20. Migration plan from current implementation

Implementation alignment should be performed in this order:

### Phase A: Classifier authority

- remove final classification authority from `poi-parser.js`;
- keep parser source normalization intact;
- make `poi-classifier.js` the only owner of `poiKind`, `gameEntity`, `gameStatus`, `referenceKind`, and reason code.

### Phase B: Reference builder

- add a single reference-channel builder from classified POIs;
- derive `INACTIVE_POWERSPOT` in the Classifier, not in Receiver or renderer;
- ensure a GUID cannot exist in both active and reference outputs.

### Phase C: Bridge V1 export

- keep `CAMPSITE_BRIDGE_POI_V1`;
- keep `pois[]` active-only;
- serialize optional `referencePois[]`;
- do not export `UNKNOWN`.

### Phase D: Receiver cleanup

- preserve legacy compatibility temporarily;
- treat explicit `referencePois[]` as authoritative for new payloads;
- stop deriving product classification from non-active active-channel records.

### Phase E: Renderer / Creative Mode

- renderer shows only inactive Power Spot references;
- Not in Game stays hidden;
- Creative Mode receives inactive Power Spot references for distance review;
- no layer reclassifies source GMO data.

## 21. Definition of done for POI Engine v1.1

v1.1 specification alignment is complete when:

- Parser no longer owns final classification;
- Classifier is the single source of truth;
- inactive Power Spot has explicit `referenceKind=INACTIVE_POWERSPOT`;
- Not in Game has `referenceKind=NOT_IN_GAME` and remains hidden;
- Unknown is diagnostics-only;
- Bridge `pois[]` remains active-only;
- optional `referencePois[]` is sent and accepted without changing the Bridge protocol type;
- Receiver stores active and reference POIs separately;
- map display uses active + inactive Power Spot only;
- distance review uses active + inactive Power Spot only;
- Kwajalein 37 + 4 + 1 regression passes;
- existing Bridge V1 active-only payloads continue to work.
