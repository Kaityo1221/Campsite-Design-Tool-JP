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

## Oct 9: Legacy Kasai private-file conversion and Phase 1-A preview (isolated)

- `core/legacy-kasai-convert.mjs` converts only fully diagnosed, unambiguous legacy Creative Mode Kasai-profile KMZ into a **new-version candidate**. It never modifies an active editor, saves state, or authorizes import (`canApply: false`).
- It creates stable, unique internal POI IDs from the source SHA-256 and Placemark index; duplicate names remain separate. Original decimal coordinate strings, folder/style, all original geometries, unknown KML, and ZIP attachment bytes are retained. Machine-generated old descriptions become empty editable memos with the original string in `campsite.creative.legacy-description`; ambiguous text is blocked.
- Polygon `campsite.creative.object` tags distinguish distance circles from activity areas. Distance circles carry a checked owner ID and radius; an ambiguous center, duplicate circle, invalid ring, or missing owner is blocked. `stage-kmz.mjs` rechecks new circle geometry and relation to its referenced point on every re-import.
- `integration/legacy-poi-preview.mjs` can build a standalone, **in-memory** Phase 1-A POI store from a verified new candidate for testing coordinates, identity and Undo/Redo. No production import, history migration, storage migration or UI connection occurs.
- Tested against the exact user-supplied Kasai KMZ privately (SHA-256 `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162`): 213/213 exact original coordinates/names, 213 original descriptions preserved, 213/213 circle-to-owner matches, all 214 polygon rings preserved, 3 non-KML attachments byte-identical, no-edit export/re-import READY. **The private KMZ and converted output MUST NEVER be committed to the public repository.**
- `node --test test/*.test.mjs`: **124/124 PASS** in Node.js 22 with JSZip 3.10.1 / @xmldom/xmldom 0.9.8. Phase 1-A's separately rerun 33 tests also PASS. Real fixture runner is opt-in: `node test/verify-real-kasai.mjs <PRIVATE_KMZ_PATH> [AGGREGATE_REPORT_PATH]`.

**Not yet passed:** browser/Chromium/WebKit regression in the current environment, iPhone Safari, live editor and UI integration, two-generation journal atomicity on Safari, editing legacy POI kind with synced folder/style/legacy layer, moving new POIs together with attached distance circles, and source-aware save rollback. All potentially lossy operations remain fail-closed. Do not merge or deploy.

## Latest Oct 9: source-aware POI addition and synchronized kind migration (160 PASS)

This section supersedes the earlier 105/124-PASS status and legacy-kind HOLD notes above. The earlier paragraphs remain as dated historical milestones, not current feature status.

- An explicitly confirmed `add` command in the **isolated editor** appends one Phase 1-A canonical, source-free **new-role only** POI. Its ID is generated by the core, not supplied by the user; it has a verified owned **50 m** circle. Existing 25 overall and per-kind 12/8/5 limits remain enforced. Existing source POIs are never replaced or merged.
- `exportNewV1Kmz(stage,{...,edits,additions})` appends safe KML Placemarks, their unique metadata and 50m polygon, and checks the entire generated ZIP by re-staging it. It retains all unedited source/attachments. Deleted newly-added POIs remain tombstones in draft, not source KML.
- Audited source-bearing `change-kind` now synchronizes original old-format `nextlab-layer`, folder and `#creative-*` styleUrl only when the target folder/icon can be verified. Otherwise the editor **rejects before accepting the edit**. Existing POI positions stay locked.
- Editor journal can save and resume new POIs, IDs and circles. Undo/Redo governs additions/deletions. Old `next-lab-creative-v7` keys are never touched.
- UI preview has a new POI form, title/memo/kind/coordinates, and disables add at the active 25 cap. New circle generation refuses unsupported near-polar coordinates.
- `node --test test/*.test.mjs`: **160 PASS / 0 FAIL**. Exact private Kasai KMZ: delete one of 25 new POIs then add one with owned circle, change a source existing kind with matched layer/folder/icon, save/resume, Undo and all 427 output objects validated. The privately uploaded source KMZ and output are **never committed**.
- Chromium 390px UI interaction via `set_content` passed the same add/edit/save/export flow with simulated storage and crypto because direct normal navigation is disallowed in the host. **This is not a production-origin browser or Safari PASS.**
- **Still HOLD:** activity-area polygon editing and full Leaflet network/tile path; production Creative Mode UI integration, real-browser storage/closure rollback, My Maps external roundtrip, iPhone Safari tests and final product release. DO NOT MERGE OR DEPLOY.

## Oct 9: isolated activity-area editing

`core/activity-areas.mjs` adds fail-closed area vertex validation and source geometry guards. Verified activity-area polygons can have vertices moved, inserted, or deleted with chronological Undo/Redo shared with Phase 1-A POI commands. New-v1 KMZ export rewrites only selected area coordinate rings, re-stages resulting KMZ and verifies edited coordinates. Two-generation isolated journal saves/reopens modified areas; old Creative Mode and source archive stay unchanged. Historical lines above stating all area editing HOLD are superseded only for this guarded isolated editor. Real Leaflet tile/drag behavior and production integration are **not** verified.
