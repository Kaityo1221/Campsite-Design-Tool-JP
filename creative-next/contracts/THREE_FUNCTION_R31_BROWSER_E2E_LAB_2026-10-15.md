# Three-function WM3 → r31 browser → verified Project return LAB

**Date:** 2026-10-15 JST  
**State:** **SYNTHETIC BOUNDARY E2E PASS**. NOT a full live 3-screen UI E2E, NOT production-ready.  
**Scope:** PR #368, isolated branch `feature/creative-next-r31-confirmed-project-save-ui-20261012`.  
**CI:** [run 38697951149](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38697951149), `isolated-r31-ui` **SUCCESS**. WebKit mobile-preview CI job was still in progress at observation time.  
**Commit:** `48089ba9191acd42a98f81c069253a1142733a02`.  
**Release:** Phase 1 HOLD.

## Newly proven connected boundary

The test `creative-next/qa/three-function-r31-browser-lab.cjs` calls actual WM3 tab-relay + observation controller and uses the **simulated** GCS collector to create complete 3-zone observation in a fake Project sessionStorage. It calls the actual Bridge V1 exporter. An explicit **test fixture adapter**, not a production receiver, prepares a fully paired synthetic `campsiteProject.v1` JSON + `NEW_V1` KMZ.

It opens the **actual frozen r31 HTML in a Chromium Playwright iframe**, clicks the existing LAB file import and confirmation UI, adds a new Gym via r31's own UI, and explicitly saves to the isolated r31 IndexedDB database. It reads back the **actual verified-pairs store row** and uses the existing `reopenLinkedPairLab` to verify the canonical manifest, hashes, exact project/handoff identity and exported `NEW_V1` KMZ. A second `createLinkedPairLab` + reopen validates that the new artifact remains eligible as a complete linked Project+KMZ pair.

### Verified data conservation
- Three separate Wayfarer observation zones `interior`, `reference100`, `reserve200`, and `acquisition.coverageComplete=true` persist unchanged through save and re-verification.
- Outer reference and hidden reserve POIs are **not** in Creative r31 editable Session or saved `currentPois`; only the true interior POI is imported.
- Stable Project ID, Handoff ID, current **design polygon** (`project.polygon`), historical acquisition snapshot, selected/source POIs and unknown future metadata survive exactly.
- One new Gym from the *real r31 UI* becomes one added Project POI; the complete pair is cryptographically reverified.
- Source KMZ bytes, old Creative localStorage and old r31 journal remain unchanged. No production storage or source files are written.
- Viewports **390×844** and **393×852** both pass: `returnPairVerified:true` and `productionReady:false`.

## Existing regressions that passed in the same CI

- Existing r31 Safari-sized Chromium browser scenario (normal/cancel/invalid/revision conflict/reload): both widths PASS.
- 34 r31+IDB tests, 14 Workspace tests, 36 X01/X04/three-function tests, WM4A Project lifecycle both versions: PASS.
- Separate WebKit job result must be checked independently. Chromium automation does **not** count as real Safari device evidence.

## **Still HOLD / explicitly not tested**

- Actual Wayfarer authenticated service, real GCS completeness, production WM relay and real credential flow. The WM3 test still uses its simulated collector.
- Actual live WM4 Project receiver UI: test fixture maps Bridge V1 payload to Project JSON for the LAB only. **It is not the approved production importer.**
- Real Campsite Design Tool receiving/saving the returned Project through its actual browser UI. Only the existing verified Project/NEW_V1 return *contract* is exercised.
- X-01 design-polygon edit UI versus independent Creative activity areas; X-04 sidecar versus embedded KMZ envelope, status/zone/provenance field mapping, and PO approval.
- Re-observation Base/Local/Remote conflict resolution, live three-way Wayfarer return, Android browser parity, and rollback/production release approval.

**Release gate unchanged:** PR #368 Draft, `main` unchanged, frozen approved r31 UI unchanged. Do not merge or deploy this prototype to production.
