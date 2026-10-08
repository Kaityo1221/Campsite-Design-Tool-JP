# Creative Next | Phase 1-B isolated KMZ and save prototypes

**DO NOT MERGE, DEPLOY, PUBLISH OR CONNECT TO PRODUCTION.**
Repository: `Kaityo1221/Campsite-Design-Tool-JP`.
Source baseline: main `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`.
Implementation branch: `feature/creative-next-kmz-phase1b-20261009`.
This directory is not imported from any production entrypoint. It does not touch `creative/base-v7.html`, Bridge, Field Mode, DB or old save keys.

## What has been implemented

| Path | Scope |
|---|---|
| `core/diagnose-kmz-candidate.mjs` | Pure non-mutating `READY / HOLD / REJECT` policy, always `canApply:false`. |
| `core/stage-kmz.mjs` | Bounded ZIP and XML staging reader, CRC/paths/size checks, detailed manifests and source bytes retained. |
| `core/export-kmz.mjs` | NEW_V1 READY KML/KMZ source-preserving edits and re-export, then automatic re-read/re-diagnosis. No implicit legacy conversion. |
| `core/create-new-kmz.mjs` | Creates a new valid KML/KMZ from **fresh canonical records only**, rejecting provenance-bearing data to prevent information loss. |
| `core/journal-save.mjs` | LocalStorage-compatible two-generation snapshot journal, SHA-256 integrity, read-back verification, fallback recovery, existing-position protection and undo-gated tombstone restore. Only uses `campsite-creative-next-v1:*` keys. |
| `test/*.test.mjs` | 105 automated Node tests including input safety, POI limits, duplicates, source preservation, fresh creation, edit roundtrip, save failure, recovery and isolated workflow. |
| `test/browser-smoke.html` | Browser smoke test intended for later Chromium/WebKit verification. **NOT PASSED**: browser startup previously failed in this environment. |

## Local verification

From this folder, using Node 22+:

```sh
npm install
npm test
```

Pinned test dependencies: `jszip@3.10.1`, `@xmldom/xmldom@0.9.8`.
Snapshot of last result: **105 PASS / 0 FAIL** for Node tests, not browser or device tests.
`TEST_RESULTS_105PASS.txt` contains machine output.

## Safety and limitations

- Staging **never applies** data to any live app state. Even a `READY` diagnosis is `canApply:false`.
- Source-preserving export supports verified NEW_V1 inputs only. Legacy Creative format stays `PROFILE_CANDIDATE / HOLD`, including synthetic Kasai-shaped file. It cannot be automatically migrated yet.
- Unknown resources / XML metadata in an unchanged NEW_V1 source are preserved by cloning and repackaging the source KML/ZIP; prior source and live POI objects are not mutated. XML/ZIP byte-identical output is not required. Unknown altitude behavior prevents movement when fidelity is unproven.
- The fresh writer is explicitly **not** a legacy/data-provenance conversion engine. If input includes raw-source/unknown metadata, it refuses conversion instead of dropping it.
- Journal has 2 generations and detects many interruptions and corruptions; browser `localStorage` remains **nontransactional**, especially with multi-tab concurrency. It cannot guarantee atomic behavior across keys. Live-store atomic commit/recovery integration remains unimplemented and requires dedicated testing.
- The journal is NOT connected to the UI; it does not read, migrate or delete old storage `next-lab-creative-v7`. An approved bulk-import workflow is not connected because saved older POIs must not be replaced without explicit consent.
- Provisional staging bounds: 8 MiB source, 32 MiB total inflated, 16 MiB KML, 1500 ZIP entries, 4000 Placemarks. The 8 MiB JSON journal bound is also **provisional**. Actual iPhone Safari benchmarking is required to determine safe product limits.
- Distance-circle O-07 metadata is NOT implemented for NEW_V1. Newly created activity-area Polygons are supported. NEW_V1 distance-circle Polygon inputs are HOLD until proper geometry/identity contract and tests PASS. Unrecognized polygons are never silently dropped.
- The **real Kasai KMZ** and actual corrected Phase 1-A 33-PASS ZIP were not accessible as bytes to this development runtime. No real-file KMZ roundtrip or Phase 1-A code integration was performed.
- Chromium/WebKit/iPhone Safari and external My Maps compatibility are NOT PASSED. The existing Chromium environment could not initialize even a blank browser page. Do not advertise those tests as successful.
- No user source KMZ, backup, published entrypoint, GitHub main, DB or Bridge was modified. Real-device testing and final release require the user's separate gates.

## Still needed before the iPhone test gate

1. Recover and verify the exact Phase 1-A 33-PASS artifact. Do not substitute older uncorrected code.
2. Access actual real KMZ bytes in an authorized working runtime (Kasai and other supported formats); execute real roundtrip comparisons including unknown metadata and geometry.
3. Implement an end-to-end consented import transaction with old save migration, source-provenance restoration, key conflict and storage quota recovery, activity area editing, distance-circle external export contract.
4. Integrate in an isolated preview with Phase 2 UI/controls/history, test browser WebKit/Chromium, Wayfarer end-to-end and regression suite.
5. Before iPhone Safari test, deliver test steps and STOP criteria, and ask for approval.