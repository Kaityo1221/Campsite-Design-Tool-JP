# r31 Project save UI LAB, explicit confirmation / isolated preview

**Date:** 2026-10-12 JST  
**Scope:** A separate **test page**, not a modification of frozen r31 UI or production.  
**Entry (when served from this branch):** `creative-next/qa/r31-project-save-lab/index.html`  
**Storage:** exclusively `campsite-creative-next-x01-idb-lab-r31-save-ui-20261012` IndexedDB, protected by namespace validation in PR #366.  
**Phase:** 1 HOLD, Draft PR.

## UI/flow

The test page embeds the existing approved `creative-next/original-ui-r31-b3-b4/index.html` in a **same-origin iframe**, with a separate small `🧪 プロジェクト保存 LAB` panel. This leaves all buttons, CSS, workflows, original r31 journal and JS files untouched. It is intentionally NOT a replacement production Save button.

1. Explicitly select the matching **campsiteProject.v1 JSON** and **original NEW_V1 KMZ**. The UI refuses unsupported schema and an absent/mismatching Project and KMZ. If no separate Project JSON exists, this flow is **HOLD**, because NEW_V1 KMZ cannot recreate observation zones.
2. Validate the actual source KMZ using `stageKmlInput()`, inspect its activity areas and run the strict `createLinkedPairLab()` preflight. Do this before activating the editor.
3. The user explicitly confirms import. Then the page passes the verified KMZ through the **unchanged** r31 `selectFile()`/Start UI, and calls the reviewed `attachLive({confirmed:true})` only before any Session edit.
4. The user edits using r31. To save they must explicitly open the LAB panel and confirm. Save refuses pending edit sheet, active placement/polygon tool, faulted adapter and busy workspace. `r31-session-indexeddb-lab.mjs` uses actual Session records, checks identity, exports new KMZ and writes a complete linked Project/areas/KMZ row to the separate IndexedDB via revision CAS and SHA-256 readback.
5. To reopen, enter the **exact project ID and handoff ID** (auto-filled after attaching the current Project). Read and verify the stored pair **before** requesting replacement. On consent, dispose the old test iframe/Workspace, launch a new unchanged r31 iframe, import stored KMZ and attach the Project context to the new one Session; Undo/Redo intentionally start empty. Cancellation preserves the old Session. No enumeration of saved Project IDs.
6. On a failed save or integrity check, display `HOLD` with the error code; never auto-repair/delete/copy into a production namespace. Original user KMZ bytes are never overwritten by LAB save.

## Safety and limitations

- This LAB validates only fully paired Project + NEW_V1 input. `campsiteProject.v1` persistence, X-01 typed shape authority and X-04 Project/KMZ sidecar are still **pending user/PO ratification**, so all results are `productionReady:false`.
- No backup/migration between this experimental IndexedDB and existing Creative/r31 journals; no automatic access to older keys or published Wayfarer Map sessions.
- The panel is a **separate overlay next to the old r31 UI**, not inside its frozen Save menu. A future isolated UI review may decide where to put the approved new action. On the approved public UI, `下書きを保存` stays hidden as previously agreed.
- The preview is locally servable or served from an isolated test repository/branch once separately published; the code PR alone does **not** imply it is publicly hosted or safe to share with end users.
- Newly deleted POI tombstones HOLD, unsupported POI/project shapes HOLD, re-observation Base/Local/Remote merge NOT implemented.
- No physical iPhone Safari or Android verification; Chromium's 390px and 393px viewports are **not** proof of native Safari behavior. User test needed later.
- This is one IndexedDB transaction for a complete bundle only; no guaranteed OS power-loss recovery or multi-store atomicity.
- Original KMZ download and iOS share remain unchanged and are not tracked by this experimental IDB database.
- No production main changes, no r31 approved integration branch changes, no live Creative/Wayfarer runtime changes, and no automatic deployment.

## Acceptance

Run the scoped CI `.github/workflows/creative-next-r31-project-save-ui-lab.yml`. It exercises the real frozen r31 iframe in Chromium at 390×844 and 393×852, selects matching JSON/KMZ files, explicitly binds Project, uses UI Add→Undo/Redo, clicks the LAB Save action, checks DB revision, confirms reopen, verifies the restored Session, and compares old saved keys. Prior r31 Session/IDB/Wayfarer regressions run separately. Record exact run ID/conclusion after execution. Do not report PASS from source creation alone.

**Next gates:** tighten any CI failures and test error/cancellation/legacy protections; then assess a true isolated preview publication; obtain PO decisions on the Project+KMZ linkage before committing a user-facing Save menu feature.
