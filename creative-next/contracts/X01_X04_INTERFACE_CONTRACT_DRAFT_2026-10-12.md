# X-01 / X-04 Interface Contract, Draft for PO Review

**Date:** 2026-10-12 JST  
**Status:** SOURCE REVIEWED / PREFLIGHT ONLY / ADAPTER NOT APPROVED / Phase 1 HOLD  
**Target:** Wayfarer Map, Creative Next r31, Campsite Design Tool  
**Branch:** `feature/creative-next-x01-x04-contract-audit-20261012` from approved isolated UI `3c63170c81aaca130e774d98d25be9c98aa38bea`

This records the observed source contracts, the proposed boundary, and loss-prevention checks. It does **not** ratify X-01 or X-04, define a new production schema, or authorize a conversion or publication.

## Source of truth and checked implementation

| Authority/implementation | Finding |
|---|---|
| `docs/wayfarer-observe-flow-spec-v1.md` §2,4,5,10,20 | One **project/design polygon**, 3–30 vertices, first created on Wayfarer; after successful handoff, the Campsite-edited polygon is authoritative. Observe polygon +200m; visible reference 0–100m, hidden reserve 100–200m. Project schema remains `1.0` pending approved extension. |
| `docs/bridge-project-contract-v1.md` §4,5,9 | `campsiteProject.v1` is canonical; requires `schemaVersion: "1.0"`, `projectId`, `source: "bridge"`, `polygon`, `selectedPois`, `currentPois`, provenance/edit fields and handoff metadata. Optional top-level `wayfarerObservation` already exists without schema bump. |
| `bridge-pc/wayfarer-acquisition-engine.js`, `bridge-pc/wm3-observe-controller.js` | Actual Wayfarer polygon upper bound 30; observation carries `snapshotId`, `observedAt`, `polygon`, three zone arrays and explicit `acquisition.coverageComplete`. |
| `creative/bridge-project-patch.js` `syncCampsiteProjectFromCreative` | **Existing integration hazard:** selects the **first** nondeleted polygon from `polygons` and writes its points into `project.polygon`. This is not a valid rule if Creative areas are independent or multiple. No fix in this PR. |
| `creative-next/phase-1b/core/activity-areas.mjs` | Area editor validates **3–512 vertices**, at most 64 active areas. Separate object identity. |
| `creative-next/phase-1b/core/create-new-kmz.mjs` and `diagnose-kmz-candidate.mjs` | `NEW_V1` marker is `campsite.creative.format=creative-mode-next`, `campsite.creative.version=1`. Placemark `object=poi` has internal `id`, `role`, `kind`, `lat/lng`, `guid/poiId`. `object=activity-area` has `area-id`. Neither project polygon nor observation/coverage/project ID has an approved ExtendedData mapping. |
| `creative-next/original-ui-r31-b3-b4/workspace.mjs` and `adapter-review.mjs` | r31 has isolated Session/journal and **all existing POIs are read-only**. New-only editing stays behind that boundary; do not interpret broader 2026-10-10 `SPECIFICATION.md` wording as permission to unlock existing POIs. |

## X-01: two kinds of polygon must never be conflated

| Field | Authority | Limits | Meaning and mutation |
|---|---|---|---|
| `project.polygon` | `campsiteProject.v1` | **Exactly one**, 3–30 vertices | Current project **design/acquisition polygon**; created Wayfarer-first, Campsite-owned after successful handoff. Only this defines +100m / +200m calculations and re-observation. |
| `wayfarerObservation.polygon` | Accepted Wayfarer snapshot | 3–30 vertices | **Historical acquisition polygon**, not automatically overwritten when Campsite edits current design polygon. |
| Creative `activityAreas[]` / KMZ `object=activity-area` | Creative Next Session and its `NEW_V1` KMZ | **0–64 areas**, each 3–512 vertices | Independent editable activity areas. Their `area-id` is not a project ID or a Wayfarer polygon ID. |
| `object=distance-circle` | Circle owner/radius relationship | 30/40/50m and source-preserving rules | Not an activity area, not a primary polygon. Never infer ownership by proximity. |

**Proposal for PO review:** use explicit names and typed channels: `designPolygon`, `acquisitionPolygon`, `activityAreas`. The current `project.polygon` remains the design polygon and `wayfarerObservation.polygon` remains the acquisition polygon. An activity area must **not** become a project polygon because it is the first in a list, happens to overlap, or has 30 or fewer points.

- Do **not** truncate a 31-vertex design polygon to 30 or truncate a 513-vertex activity area to 512. Return `HOLD` with a specific field path.
- A 31–512 vertex **activity area** is legitimate while that same geometry is **not** a Wayfarer design polygon. Geometric equality does not imply shared type/ownership.
- If a project has multiple areas, do not choose one to stand in for `project.polygon`. If a design polygon was removed/missing, explicitly HOLD, do not guess an area.
- Change to `project.polygon` triggers acquisition reserve coverage evaluation; change to an independent `activityAreas[]` does **not** silently mutate the Wayfarer observation target.
- Any new persisted field name for `activityAreas` inside `campsiteProject.v1` remains **UNDECIDED**. WM-4 permits backward-compatible extension but does not approve this specific field, serialization, or migration.

## X-04: Project `1.0` is not equivalent to KMZ `NEW_V1`

The two **versions are from different contracts**; they may both be “v1” but are neither identical nor automatically convertible.

| Property | Project / Wayfarer source | Existing NEW_V1 KMZ | Gap |
|---|---|---|---|
| Project identity / lineage | `projectId`, `meta.bridgeHandoffId`, `source`, `schemaVersion` | No approved project envelope | **Missing**: no safe KMZ-only project reconstitution |
| Current design polygon | `project.polygon` | Only tagged **activity-area** polygons | **Missing**: cannot use first activity area as design polygon |
| Historical acquisition polygon | `wayfarerObservation.polygon` | No observation geometry contract | **Missing** |
| Observation proof | `snapshotId`, `observedAt`, `acquisition.coverageComplete`, `bufferMeters`, provenance | No observation envelope | **Missing**. Never turn HTTP success into completeness |
| Zone ownership | `zones.interior/reference100/reserve200` | Generic existing/new POI role, no reference/reserve distinction | **Missing**. Hidden reserve must remain retained, not converted to normal editable POIs |
| Stable identity | Wayfarer `guid/poiId`, with `currentPois` and `selectedPois` separated | `campsite.creative.id` plus optional `guid/poiId` | **Partial**. Internal ID is not a Wayfarer GUID. Do not synthesize identity from name or coordinates |
| PowerSpot state | Active/Inactive distinguished by `gameStatus`, `poiKind/gameEntity/referenceKind` | `kind=power` | **Loss risk**: `kind` cannot encode Active/Inactive |
| User changes and baseline | `sourcePois/selectedPois/currentPois/addedPois/deletedPois/edits` | Flattened existing/new POI rows and tombstones/export semantics | **Loss risk**: independent Base/Local/Remote provenance not represented |
| Circle owners and radii | `circleRadii`, source object ownership | NEW_V1 dependent circles via `circle-owner-id/radius` in source-preserving path | **Partially representable**, but owner proof and source provenance remain mandatory |
| Activity areas | Independent Creative Session | `object=activity-area`, `area-id` | **Representable for Creative**; not automatically Campsite project fields |

**Proposed non-lossy boundary (requires PO ratification):**

1. Keep `campsiteProject.v1` as the **only project/observation authority**. Existing optional `wayfarerObservation` is preserved, including all zones and coverage information. Keep `schemaVersion:"1.0"` until separately versioned WM-4 extension approval.
2. Treat `NEW_V1` as a **Creative edit artifact**, not a project/Wayfarer observation database. Preserve original source bytes and provenance during KMZ edits. A bare KMZ is **not** sufficient to restore the Wayfarer project.
3. Introduce a future explicit **versioned adapter/envelope** or a user-verified linked Project + KMZ pair. Ratify how the project ID and handoff ID, current polygon, observation, original/current POIs, zones, Active/Inactive state, pending diffs, added/deleted state and activity areas survive **both directions**.
4. Before import/export, verify project identity, stable GUID/poiId, POI counts and zone counts, polygon ownership, external reference read-only policy, circle ownership, checksum/revision and acquisition completeness. Reject unsupported/ambiguous data rather than strip fields or silently downgrade.
5. Use a staged, confirmation-gated transaction with rollback and **no writes to existing project keys, r31 journals or source KMZ during preflight**. User approval and regression are needed before connecting to the production runtime.
6. A new observation uses Base/Local/Remote conflict rules, **not** ordinary manual edits to existing r31 POIs. X-02 remains separately HOLD.

### Decision gates left to PO

- **X-01-A**: Confirm `project.polygon` is the sole design/acquisition polygon and Creative activity areas never substitute for it. **Proposal, not yet approved.**
- **X-01-B**: Select a safe UI path for editing that primary polygon distinct from activity-area tools, plus approved storage extension for independent areas. **HOLD.**
- **X-04-A**: Choose where the versioned project context lives during KMZ file handoff: validated linked Project snapshot/sidecar vs an explicitly defined new KMZ envelope. **HOLD.**
- **X-04-B**: Define field-level versioning, status/zone mapping, provenance, migration/rollback and old project compatibility; sign off an end-to-end lossless round trip with synthetic and private local real-data tests. **HOLD.**

## Read-only preflight implementation and limits

`audit-x01-x04.mjs` checks JSON structure and geometry, area counts/IDs, basic observation identities and completeness, and the `NEW_V1` document markers. It **never** calls an editor Session, project storage, fetch, KMZ exporter or a write API. It returns `status:"HOLD"` **even if the structural checks pass**, because no reviewed cross-format mapping exists. A `structureValid:true` is **NOT an acceptance/PASS** for conversion.

This is a narrow early hazard detector, not a complete semantic parser, full GCS coverage proof, source ZIP integrity check or equivalent of `stageKmlInput`/`diagnoseKmzCandidate`. Production boundary must independently prove all those facts, enforce identity/zone equality, and reject collisions/unknown extensions without data loss.

Synthetic tests: `creative-next/qa/x01-x04-contract-audit.test.mjs`. Includes 31 vs 512 vertices, 64/65 areas, duplicate IDs, snapshot incompleteness, inactive status loss, project identity, and absence of a project KMZ envelope. No real KMZ or personal content checked into GitHub.

## Release boundary

- r31 integrated UI commit `3c63170c81aaca130e774d98d25be9c98aa38bea` is **unchanged**.
- No code changes to `creative/`, `bridge-pc/`, production `main`, `campsiteProject.v1` storage or any versioned preview.
- X-01 and X-04 **remain HOLD for behavioral integration**. After PO decisions, implement and test an isolated cross-format adapter with data-conservation assertions; then full Wayfarer → Creative → Campsite → Wayfarer E2E and device parity, followed by separate production authorization.
