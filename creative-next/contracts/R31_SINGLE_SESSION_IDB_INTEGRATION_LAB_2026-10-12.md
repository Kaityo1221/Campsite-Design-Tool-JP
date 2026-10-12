# r31 Workspace/B2 ⇄ independent X-01/X-04 IndexedDB LAB

**Date:** 2026-10-12 JST
**Status:** DRAFT. r31 Session module test PASS; UI test is a separate gate.
**Parent:** PR #366 X-01 IndexedDB prototype. The approved r31 UI branch and production `main` are unchanged.

## What was connected

Added `creative-next/contracts/r31-session-indexeddb-lab.mjs`, a new independent lab-only adapter.

- Takes an existing **real** `createWorkspace()` single Session; never changes r31 Workspace code, existing r31 journal, Source KML, rendering/UI script or page.
- `start({confirmed:true})`: verify the provided Project + original NEW_V1 KMZ via existing strict pairing, stage the archive, require REVIEW, explicitly accept, bind matching Project identity. A pre-existing active Session is refused.
- `attachLive({confirmed:true})`: a test-only attach point for a Session already created via **real r31 UI file picker and Start**. This path re-verifies the exact NEW_V1 source and matching Project with its initial Session state; attached only before the first edit.
- `save({confirmed:true})`: capture actual Session records and activity areas, preserve existing POIs, turn only new POIs into LAB Project `role:'added'` entries with their stable local IDs, make a **typed** X-01 polygon save plan with primary `project.polygon` unchanged, call the actual `workspace.exportKmz()`, and persist the verified Project+areas+KMZ in X-01's strictly isolated single-row IndexedDB CAS transaction.
- `reopen({confirmed:true})`: read/re-verify the stored Project+KMZ and activate a **fresh single Session** after REVIEW. No auto-restoration; Undo/Redo history starts empty by design. A restarted r31 UI can instead open stored KMZ normally then use `attachLive` for the test-only association.
- Any `saved` report is `productionReady:false`. Neither function sends data to a server, deploys a page, alters existing `campsiteProject.v1` session storage, or changes the old r31 three-key journal.

## Guarded limitations

1. This is an **explicit user-confirmation test protocol**, not a live UI save button. The finished r31 Save UI and native iOS share/download behavior are left untouched.
2. A deleted/tombstoned new POI returns `R31_LAB_DELETED_POI_HOLD` until an approved persistence/deletion and revision policy exists. The user may Undo before saving in the LAB. This narrow trial does not claim general deletion persistence.
3. All existing POIs remain fully read-only. Additional data fields, observation zones, source metadata and unknown future Project fields must survive the linked pair; ambiguous identities HOLD.
4. The in-memory Project `currentPois/addedPois` mapping for newly created candidates is a **LAB proposal**, not approved canonical schema. `gameStatus:'UNKNOWN'` on new candidates is deliberate: a proposed object must not be falsely marked as an active Wayfarer POI. Independent Creative `activityAreas` are NOT automatically written into `project.polygon`.
5. If the editor mutates during asynchronous export or save, the adapter refuses to report synchronized success; a post-commit UI race is explicitly differentiated. X-01 IndexedDB CAS handles stale stored revisions, not every possible race across the legacy r31 save journal or an external file.
6. Existing `selectedPois/sourcePois/edits` and historic observations remain untouched. Re-observation 3-way merge, real Wayfarer service and all-device operation are separate pending gates.

## Synthetic actual-Session evidence

`creative-next/qa/r31-session-indexeddb-lab.test.mjs` exercises the **actual** r31 Workspace session and **real** B2 command adapter, not a copied Session model:

- B2 add, edit, create area, Undo, Redo;
- export and verified IDB save; original KMZ byte copy unmodified;
- attach 1 fresh Session to saved KMZ and restore new POI and 31-vertex activity area;
- existing original POI remains immutable, restored Undo/Redo history begins empty;
- subsequent change to added POI and revision-2 save;
- confirmation required; deletions fail closed; stale revision collision fails; wrong initial Project identity fails before importing.

The browser UI test `creative-next/qa/r31-session-idb-browser.cjs` uses 390px/393px Chromium viewport with actual frozen r31 map UI, real file input and buttons, **only** injecting the LAB adapter into the test page. The test does not deploy a preview, not authorize production, and is **not** iPhone Safari/Android physical-device verification.

## Remaining next stages

- Ratify X-01 typed primary design polygon / activity areas and X-04 Project+KMZ persistence contract.
- Integrate into one isolated, explicit save/reopen UI with a separate namespace and no existing journal cross writes, including tombstones, full source provenance and rollback semantics.
- Actual Wayfarer⇄Campsite receiver and external re-observation Base/Local/Remote, plus PC/Android/iOS parity and user acceptance.
- Retain Phase 1 HOLD and unmerged Draft PRs until those gates pass.
