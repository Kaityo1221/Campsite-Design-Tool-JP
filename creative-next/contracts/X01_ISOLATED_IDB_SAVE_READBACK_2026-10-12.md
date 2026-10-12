# X-01 / X-04 isolated IndexedDB save + reload rehearsal

**Date:** 2026-10-12 JST  
**Status:** Synthetic LAB and actual headless Chromium IndexedDB PASS. Not production, not actual r31 UI integration.  
**CI evidence:** [GitHub Actions #38210458051](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38210458051) SUCCESS.  
**Release:** Phase 1 HOLD; all PRs remain Draft and unmerged.

## Scope

Adds an explicit `createX01IndexedDbSaveLab` storage connector to the prior isolated **typed polygon save planner** and **Project + unmodified NEW_V1 KMZ linked pair**. There is **no** use of production sessionStorage/localStorage, `campsiteProject.v1`, existing Creative Mode keys, r31 save journals, real Wayfarer user sessions, GCS requests, or production pages.

Database namespace: `campsite-creative-next-x01-idb-lab-20261012` (tests use separate `campsite-creative-next-x01-idb-lab-*` names). Only object store `verified-pairs`, keyed by exact `[projectId,handoffId]` JSON string. No deletion, database enumeration, migration or production-storage fallback.

## Actual LAB save and reopen procedure

1. Caller supplies an **explicitly typed, validated** `LAB_GEOMETRY_PLAN_READY` with the unique Project design polygon, independent activity areas, expected project ID/handoff ID, verified source observation and separate `NEW_V1` KMZ bytes. Unmapped or ambiguous POIs/data are HOLD, never discarded.
2. Call the existing X-04 `createLinkedPairLab` again **before any write**. It stages and diagnoses the KMZ, compares Project's `currentPois` with NEW_V1 POIs by stable GUID/ID and checks areas and full observation completeness. The entire unchanged Project JSON and activity areas JSON plus source KMZ bytes are preserved in an experimental linked pair with SHA-256.
3. Require an explicit `expectedRevision` (0 for first save). For update, first validate the old record, then use IndexedDB's serialized **readwrite transaction** to read existing record and compare its full previous manifest and KMZ bytes. Refuse stale revisions or same-revision modifications.
4. Write **one complete linked pair row** (Project, areas, KMZ, hashes and revision) in the **same IndexedDB transaction**. Request `durability:'strict'`; browsers may treat this as a durability hint, **not a crash-proof guarantee**.
5. After transaction completion, reopen from the database, rerun cryptographic integrity and existing NEW_V1 source/identity/areas checks, compare full returned JSON/bytes against prepared source, and only then return `LAB_IDB_SAVE_VERIFIED`. Reopening after a fresh page load returns `LAB_STORED_PAIR_VERIFIED` and `productionReady:false`.
6. Any invalid, incomplete, corrupted, mismatched or ambiguous data is rejected without automatic source recovery or overwriting real user files.

## Evidence, final passing CI

| Test block | Outcome |
|---|---|
| Isolated IndexedDB save/reload + CAS, corruption and scope, via `fake-indexeddb` | **9/9 PASS** |
| **Actual headless Chromium IndexedDB**: reload, stale revision, archive corruption, parallel tabs | **4/4 PASS** |
| Previous X-01 typed geometry, X-04 pair and three-feature synthetic chain | **55/55 PASS** |
| Existing WM4A project lifecycle, feature-patch and public-page TEST variants | **Both PASS** |
| Activity area and NEW_V1 KMZ writer regressions | **25/25 PASS** |

The first draft browser CI failed due to Playwright webServer working directory, not due to data loss; we corrected the server to serve the repository root, re-ran, and obtained the above successful actual browser results.

## Exact limits and HOLD status

- This is a **one-row atomic IDB transaction**, not a transaction across Project sessionStorage, Creative's own journals, an external file, or other databases. No two-generation recovery or browser-termination durability guarantee is claimed.
- The prototype receives a **prebuilt typed plan and KMZ**, not actual r31 UI records, undo/redo or active Session. Therefore it is **NOT yet an application save button or end-user recovery feature**. It cannot migrate existing saves or repair older files.
- There is no browser UI, no real iPhone Safari/Android/PC cross-device parity, no live Wayfarer GCS, no three-screen receiver or Base/Local/Remote re-observation apply test.
- The persistent Project + KMZ sidecar/pair format and independent activity-area authority remain **PO unapproved**, and conversion outside the narrowly validated synthetic mapping remains HOLD.
- A post-commit readback error is surfaced as HOLD. The LAB does **not** automatically roll back, delete, repair or overwrite the database. Users' separate original KMZs remain untouched.

**Next isolated gate:** Bind the typed channel and storage adapter behind r31's single-Session **TEST-only**, with explicit PO import/save confirmation and separation from the existing r31 journal; inspect UI behavior and tests on 390px/393px, then request separate user device verification. No main merge or Phase 1 release until complete E2E and PO approval.
