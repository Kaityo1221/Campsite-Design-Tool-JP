# Real Kasai KMZ conversion verification | 2026-10-09 JST

**Stage: ISOLATED TEST / NOT PRODUCTION READY / NO LIVE IMPORT**

Private input SHA-256: `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162`

The original user-provided `葛西臨海公園【キャンプサイト用】_creative_creative_creative(1).kmz` was read locally. The original binary was unchanged. Neither it nor the converted KMZ is committed to this public repository. The report below contains aggregate results only.

| Result | Value |
|---|---:|
| Original legacy profile | `LEGACY_CREATIVE_KASAI_CANDIDATE / HOLD` |
| Converted candidate | `NEW_V1 / READY` (**canApply=false**) |
| Existing POIs / new POIs | 188 / 25 |
| Total named POI + unchanged Point coordinates | 213 / 213 |
| Individual generated raw descriptions preserved in dedicated legacy metadata | 213 / 213 |
| Distance circles / owner match | 213 / 213 |
| Activity areas | 1 |
| Polygon raw ring text preserved | 214 / 214 |
| ZIP attached resources byte-for-byte preserved | 3 / 3 |
| New output re-exported, re-staged and checked | PASS |
| Phase 1-A preview POI counts | 188 existing + 25 new |
| Original KMZ edited / public `main` touched / production importer activated | NO / NO / NO |

**Local tests:** Phase 1-B 124 tests PASS, 0 fail; Phase 1-A Node 33 tests PASS, 0 fail. Includes synthetic adversarial and ambiguity cases. Reports are attached as `TEST_RESULTS_124PASS.txt` and `PHASE1A_RECHECK_33PASS.txt` on this isolated branch.

**Gates outstanding:** Actual browser integration and regression, atomic save and rollback in the live app, old KMZ human UI inspection, original/user annotations with more complex older formats, external Wayfarer live handoff, Safari iPhone acceptance, and chairman final release authorization. A `READY` conversion result only describes file-level diagnostics and **never** authorizes automatic editor replacement.
