# X-01 Explicit Project Polygon / Activity Area Save Channels, LAB acceptance

**2026-10-12 JST · Isolated implementation · Phase 1 HOLD · Not a production integration**

## Current verified hazard

The actual `creative/bridge-project-patch.js` `syncCampsiteProjectFromCreative()` currently does:

```js
const activePolygon=(polygons||[]).find(p=>!p.deleted&&Array.isArray(p.points)&&p.points.length>=3);
const polygon=activePolygon?activePolygon.points.map(p=>[Number(p[0]),Number(p[1])]):Array.isArray(project.polygon)?project.polygon:[];
project.polygon=polygon;
```

`loadCampsiteBridgeProject()` also maps `project.polygon` to an **untyped** `polygons` entry with a generated `activity` ID. When Creative gains multiple activity areas, that first-record selection is unsafe for the WM-0 single authoritative design polygon, and there is no approved way to persist multiple areas in the Project contract.

**This PR DOES NOT modify that actual production runtime.** The hazard remains on the production integration path until the explicit adapter is wired into an isolated runtime and separately approved.

## Tested isolated correction

Added `creative-next/contracts/design-polygon-save-channel-lab.mjs`, a pure, synchronous, in-memory planner:

- Require an explicit **one-and-only-one** geometry `kind:'project-design-polygon'`, `projectId`, `handoffId`, unchanged `basePolygon` and its next `points`.
- Require every additional Creative area to have `kind:'activity-area'`, unique `id`, validated `points`. Reject unknown/untagged objects and unsupported deletions. **No infer-by-first-entry, size, name, folder or location**.
- Preserve `project.polygon` as the **sole design polygon** (3–30 vertices), separate from 0–64 **activity areas** (3–512 vertices each).
- Require an exact caller-supplied source `expectedBasePolygon` and identity to prevent stale-tab, wrong-project or wrong-handoff replacement. A mismatch returns a specific fail-closed error.
- An activity-only edit leaves the Project polygon and historical `wayfarerObservation.polygon` untouched, with no unnecessary reserve reclassification.
- Explicit primary edits require a confirmed complete prior observation and the actual WM5 `bridgeMapLab_evaluateWayfarerReserveCoverage` function. Only an in-reserve edit produces a proposed new Project polygon. Beyond reserve returns `X01_REACQUISITION_REQUIRED` and does not commit a change.
- Clone the full JSON Project without silently discarding unknown or unsupported runtime values. Preserve `wayfarerObservation`, `selectedPois/currentPois`, edit state, metadata and unknown future fields. The returned areas live in a **separate in-memory property**, never copied into `project.polygon`.
- Every result is `status:'LAB_GEOMETRY_PLAN_READY', productionReady:false`. No Project key writes, KMZ overwrite, Session mutation, user file changes or deployment.

### Contract illustration (LAB proposal, **not** approved persisted schema)

```js
planDesignPolygonSaveLab({
  project, // existing campsiteProject.v1
  expectedProjectId: project.projectId,
  expectedHandoffId: project.meta.bridgeHandoffId,
  expectedBasePolygon: originalProjectPolygon,
  geometryObjects: [
    {kind:'project-design-polygon',projectId,handoffId,basePolygon,points,deleted:false},
    {kind:'activity-area',id:'area-1',points:activityPoints,deleted:false}
  ],
  evaluateCoverage: window.bridgeMapLab_evaluateWayfarerReserveCoverage
});
```

The typed shapes above are **new interface candidates**, not live r31/legacy Creative object shapes. Old untyped `polygons` MUST NOT be passed unchanged or inferred.

## Regression evidence

- Dedicated CI: [Creative Next X01 polygon save channel lab](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38209665767) **SUCCESS**.
- New `creative-next/qa/x01-design-polygon-save-channel.test.mjs`: **19/19 PASS**.
- Previous 3-function synthetic E2E + earlier contract/pair checks: **36/36 PASS**.
- Old WM4A project lifecycle: both feature and packaged public-page TEST variants PASS.
- Existing activity-area and fresh NEW_V1 writer: **25/25 PASS**.
- Includes an actual `createFreshV1Kmz` and `createLinkedPairLab`/`reopenLinkedPairLab` synthetic roundtrip demonstrating that primary design polygon, 31-vertex Creative activity area, observation reserve and unchanged POIs remain separate.

The initial CI caught a fixture mistake: a symmetric self-crossing polygon was degenerate, causing the **degeneracy guard** rather than the intended **intersection guard**. The synthetic polygon fixture was corrected and the rerun passed. No runtime fix was required from this finding.

## Still missing before a live 3-screen E2E

1. **Isolated UI tagging**: replace the untyped primary polygon creation on the Wayfarer→Creative import path with a distinct project-design object; guarantee exactly one and a separate activity-area collection. Do not alter released Creative until gate approval.
2. **Safe save transaction**: integrate the planner into the **isolated** actual runtime save handler. The Project JSON and activity-area/KMZ sidecar must be versioned, revision-checked and written with rollback/verification. A pure in-memory planner proves **no persistent atomicity**.
3. **Real browser and session**: test Wayfarer polygon and observation → Project receiver → r31 one-Session edit → project save/reopen → Wayfarer reacquisition and Base/Local/Remote conflict review.
4. **PO contract decision**: adopt or revise the typed channel and choose where independent activity areas persist (Project backward-compatible field vs explicitly linked sidecar). The current link-pair is also a LAB-only candidate.
5. PC, Android and iPhone parity and explicit production release/rollback gate remain separate.

**Do not merge this Draft PR into main or presume completion of X-01.** Existing UI, old KMZ data, preview paths and Project storage have not been changed.
