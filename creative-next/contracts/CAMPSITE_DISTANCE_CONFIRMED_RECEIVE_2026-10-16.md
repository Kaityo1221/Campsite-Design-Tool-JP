# Campsite Distance return: explicit confirmed isolated import (LAB only)

Date: 2026-10-16 JST. Repo `Kaityo1221/Campsite-Design-Tool-JP`, PR #368 Draft.
**Release: Phase 1 HOLD. Neither actual production Campsite receiver nor approved r31 UI is changed.**

## User-mediated test workflow

1. On a protected private preview of Creative Next, use the existing return LAB to explicitly export a synthetic, verified Project + NEW_V1 portable LAB ZIP. This experimental ZIP is **not** the approved production transport, and is not a KMZ.
2. Open separate `creative-next/qa/campsite-distance-import-lab/index.html` on the receiving test origin, enter explicit Project/Handoff IDs, and choose the local ZIP.
3. Click **① 受信データを検証**. The file is parsed client-side (no upload), the complete ZIP and canonical Project+KMZ manifest are checked, the independent design/acquisition/activity polygons remain typed, and a read-only 50m warning-count preview is shown. Source generation and receiving-generation are distinctly labeled.
4. If and only if receiving origin has **no existing stored Project for those exact IDs**, the user may click **② 確認して隔離保存** and accept the native confirmation. The save goes to `campsite-creative-next-x01-idb-lab-distance-receiver-20261016` using the already verified atomic X01 IndexedDB CAS store. A successful save is not acknowledged until its canonical Project+KMZ is read back and cryptographically verified.
5. **③ 隔離保存データを再開・照合** explicitly reopens the saved pair after a refresh or second browser tab. Data are still read-only and are not passed into actual Campsite production `sessionStorage['campsiteProject.v1']` or Distance.

## Hard gates

- **Create-only**, even if a user clicks confirmation. A receiving Project that already exists is marked `DISTANCE_IMPORT_EXISTING_PROTECTED`; it cannot be overwritten. The existing source ZIP remains untouched for manual recovery. **No destructive rollback or automatic repair**. This is a conscious constraint until multi-generation rollback is designed and approved.
- Multiple tabs that both inspected the same empty receiving slot may race, but X01's actual IDB transaction-and-CAS permits **only one** revision 1 commit. Stale writer returns `IDB_LAB_REVISION_CONFLICT`.
- Re-import with changed Project or Handoff ID is not permitted without explicit ID matching. Truncated/tampered Project/KMZ/ZIP fails before writing; no fallback to selectedPois if currentPois has been deleted.
- Preview calculation is **not** the official distance score, map, or pre-submit approval; original real Distance UI/Leaflet display was separately verified in an offline test. This new screen does not run `js/distance.js`, does not upload analytics, and does not write the legacy bridge key.
- Readback exposes complete Project, activityAreas, NEW_V1 KMZ for future explicit *re-edit staging*, but no automatic live r31 Session mutation. A successor edited portable artifact can be generated in a separate test without overwriting the accepted recipient row.
- Original WebKit mobile simulation was cancelled as of check on 2026-10-16; no new on-device iPhone Safari or Android result may be claimed. Chromium device-sized automation is not a physical mobile device.

## New source and tests

- `creative-next/contracts/campsite-distance-confirmed-import-lab.mjs`: private pending ticket, explicit consent, cryptographically verified prepare/re-verify, strict create-only X01 transaction and readback.
- `creative-next/qa/campsite-distance-import-lab/index.html` + `controller.mjs`: small confirmation form and read-only receipt summary on protected preview.
- `creative-next/qa/campsite-distance-confirmed-import.test.mjs`: consent denied, reopen, full unknown-field/area preservation, competing writers, hard existing-target lock, invalid IDs and next-edit candidate.
- `creative-next/qa/three-function-r31-browser-lab.cjs`: real UI via portable ZIP across different browser origins, two concurrent receiver tabs, one successful isolated save, stale CAS HOLD, reload/reopen, refusal of overwrite and unchanged legacy keys.
- CI runs both source/packaged static preview browser scenarios at 390×844 and 393×852 and existing regressions. **Only claim PASS when that run completes successfully.**

## Still necessary before actual Campsite handoff

X-01 polygon ownership and zero/one/many independent activity-area mapping approval; X-04 official versioned portable/authenticated cross-origin format; security and user-permission review; atomic and reversible real Project import including multi-generation rollback and stale-tab conflicts; actual distance scoring/analytics policy and reference100 treatment; test edit→distance→return-to-Creative changes against real, not synthetic, app workflows; WebKit/iPhone/Android device parity and full release authorization.

Do not merge to `main`, overwrite `campsiteProject.v1`, or deploy any LAB as a production feature.

## Return to Creative Next re-edit (LAB only)

6. **④ Creativeで再編集する（手動LAB）** provides verified Project JSON and original NEW_V1 KMZ download only after a successful reopen. The JSON file has valid trailing whitespace, never literal backslash-n bytes. Changing either identity or selected ZIP hides exports pending re-verification; controls are locked during verification.
7. Explicitly import both files into the separate confirmed r31 Creative Next LAB UI. After a new POI edit, an independent Creative LAB save creates a new cryptographically verified linked pair; another experimental portable return ZIP can be built and re-opened. The original Campsite receiving IndexedDB generation must stay byte-equivalent. The browser flow also checks declined save consent and stale-tab CAS.
8. Browser checks include Wayfarer observation zones, selected and source POIs, unknown future fields, design polygon, activity-area equality, archive bytes, and IDs. A separate Node fixture covers a 31-vertex independent area through a new isolated successor store. Neither browser automation nor macOS WebKit simulation is a physical iPhone or Android pass.

**HOLD unchanged:** X-01/X-04 unapproved, actual Campsite receiver unconnected, official Distance write blocked, no r31 approved UI/main/release changes.

## Completion-focused: one-file Campsite to Creative re-edit (LAB, unapproved)

After a verified recipient reopen, the operator may now download a **single** `distance-reedit-test-only.zip` in addition to the original two-file method. The ZIP is freshly constructed from the verified isolated Project, independent activity areas and NEW_V1 KMZ. It remains an unauthenticated, experimental v0 transfer with the same hash/identity rules.

The *separate* Creative r31 parent LAB accepts this ZIP only with explicit Project/Handoff ID input, full bundle and NEW_V1 pair checks, preservation of independent area geometry, and user confirmation. If the same Project was previously saved in that Creative LAB origin, it requires the existing verified reopen route instead of accepting a fresh revision-zero Session. Wrong Handoff and cancellation cannot start a Session. Approved r31 iframe implementation and legacy Project keys are not changed.

The full browser integration validates both unchanged manual JSON/KMZ downloads and the new one-ZIP import, deliberate wrong ID, cancelled consent, genuine r31 editing, new isolated Project+KMZ save and byte-for-byte protection of the Campsite received generation. Both Chromium and WebKit use the same synthetic scripted flow. Physical devices, official transport and deployment remain HOLD.
