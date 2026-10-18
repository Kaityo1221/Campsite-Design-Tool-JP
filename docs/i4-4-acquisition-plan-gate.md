# I4-4 Acquisition Plan Gate (isolated)

Status: design gate only. No production runtime changes.

## Proven from I4-3 iPhone observation
- A completed I3 polygon was used for a manual bounding-box GCS request.
- HTTP 200, JSON valid, 175 ms were observed.
- `coverageComplete` and `sourceComplete` were null. Neither POI completeness nor full coverage is proven.

## Existing authoritative engine
Reuse `bridge-pc/wayfarer-acquisition-engine.js` `createPlan(polygon, {bufferMeters:200,maxTileMeters:500,cellLevel:14})` and `executePlan(plan,requestTile,options)`. Do not fork its geometry rules for iPhone.

## Next implementation gates
1. Reuse identical normalized I3 completed polygon, with session ID binding and immutable snapshot.
2. Derive 200m buffered acquisition bounds independent of viewport or zoom, partition into 500m tiles, and cap tile count before network calls.
3. Fetch GCS tiles sequentially, explicit user action only, with per-tile timeout and bounded retries. Never silently auto-fetch.
4. Preserve raw responses in memory only during the test; no token or cookie exposure, no persistence. Normalize Pokémon GO POI records and deduplicate by GUID/poiId, not coordinates.
5. Separate geometry coverage, transport completeness and source verification. A 200 response or syntactically valid JSON must never set sourceComplete=true.
6. Require source verifier based on documented GCS payload semantics before `coverageComplete=true`; otherwise show `unverified`.
7. Keep A interior, B 0-100m read-only reference, C 100-200m reserve; exclude NOT_IN_GAME. No Creative handoff in I4-4.
8. Maintain separate TEST launcher and CI. Never change I3 frozen files, Android N4, Launcher 1.3.0, production Creative or WFMM.

## Stop conditions
- GCS response format or source completeness semantics cannot be verified.
- I3 session/polygon mismatch.
- Any tile failure or unexpected response shape.
- Exceeded tile count / polygon constraints.

## Acceptance
- Deterministic tile plan for fixed polygons; viewport/zoom changes do not affect tile list.
- Explicit test fetch shows per-tile status and unique GUID counts.
- Partial failures never report complete.
- No production code paths altered.
