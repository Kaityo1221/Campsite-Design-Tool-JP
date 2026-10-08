# Phase 1-B | Isolated KMZ candidate diagnostic (WIP)

**Status: TESTED POLICY ONLY. Not a KMZ importer or production feature. DO NOT MERGE.**

Main baseline: `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`.
No links from public Creative Mode; no writes to legacy storage/Bridge/Field Mode/DB.
The user has approved O-01 through O-04 and delegated O-05 through O-08 design work up to the iPhone test gate.
The formal three-phase specification and release gates remain in force.

## Contents
- `core/diagnose-kmz-candidate.mjs`: pure, non-mutating policy evaluator for **already audited and exhaustively parsed** candidate manifests.
- `test/diagnose-kmz-candidate.test.mjs`: Node native unit tests, including 700/701, new 26, no auto-apply, legacy HOLD, conflict checks, and synthetic Kasai-shaped 427 Placemark manifest.

To verify from the repository root:

```sh
node --test creative-next/phase-1b/test/diagnose-kmz-candidate.test.mjs
```

## Safety guarantees and limits
1. The diagnostic always returns `canApply:false`. Even READY is NOT an import/commit or save-success signal.
2. Distinct internal IDs are never collapsed. A duplicate internal ID is HOLD; name/position/GUID duplicates warn only.
3. 701+ existing rejects; 500-700 warns; extra new POIs warn, not auto-delete.
4. New-form version ambiguity, missing/contradictory metadata, and unidentified geometry HOLD. Legacy profiles are HOLD until real roundtrip and geometry validation PASS.
5. Archive, KML selection, complete object listing, and source preservation are provided by a **separate audited staging parser**. This policy module only checks evidence flags in its input. It DOES NOT establish the truth of those flags, block ZIP bombs, or parse raw KMZ/XML. Treat a forged/partial manifest as unsafe at the adapter boundary.
6. Synthetic Kasai test uses counts and folder conventions, **not the actual Kasai KMZ**. No real KMZ roundtrip or Safari/browser test is claimed.

## Blockers before integration
- The corrected, 33-test-PASS Phase 1-A ZIP is on the user’s local Windows Codex workspace, **not in GitHub or this workspace**. Do not integrate the older, uncorrected POI core.
- Actual Kasai and Hikarigaoka KMZ raw bytes are currently unavailable in the working runtime. A verified raw copy is required for real fixture/roundtrip testing.
- ZIP/XML staging parser, O-07 circle/area roundtrip, O-08 transactional save recovery, UI wiring, Chromium/WebKit regression, and iPhone Safari remain pending.
- No production entrypoint changes or publication are authorized. Real-device test start and release require separate user gates.
