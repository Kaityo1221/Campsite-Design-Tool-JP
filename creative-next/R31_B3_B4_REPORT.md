# Creative Next r31 B3/B4 implementation

2026-10-12 JST. Dedicated branch: `codex/original-ui-r31-b3-b4`.

**B3/B4 PASS. Dedicated GitHub CI SUCCESS, 169/169 checks and all browser flows PASS. Production readiness remains HOLD. iPhone Safari実機未検証。** No merge, deployment, production navigation link or publication.

Base is GitHub B2 PASS HEAD `7ef98ad4250af8f2d1a1458d289d3ed1989a8da7`, confirmed before implementation and before push. Protected remote refs remain:

- B2: `7ef98ad4250af8f2d1a1458d289d3ed1989a8da7`
- Frozen A/B1 branch `codex/original-ui-r31`: `e8436035bf89ee653747c6afbed08e2f43099e9e`
- main: `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`

## Implementation

B3 adds a separate derived entry and bootstrap. KMZ/KML selection clears any previous candidate, stages a bounded archive, validates XML, CRC, paths, geometry and schema, then exposes REVIEW. Explicit Start is the only activation gate. Unsupported sources remain HOLD/REJECT. The frozen strict legacy converter produces separate bytes; zero/multiple circle owners produce **LEGACY_CIRCLE_AMBIGUOUS HOLD**. No nearest-owner guess, relinking, geometry correction, source overwrite or repair path is added.

Output uses the frozen exporter and independently stages the resulting bytes before offering a separate `creative-next-r31-edited.kmz` download. Opaque ZIP entries are retained. Filesystem destination replacement stays HOLD; the user can use Download. Existing original KMZ files are never opened for writing.

B4 owns exactly `campsite-creative-next-v1-r31-b3-b4:{current,slot-a,slot-b}`. A storage capability rejects every other key. No old-key read/write, enumeration, migration, deletion, autosave or namespace selection is exposed. SHA-256, exclusive Web Locks, revision preconditions, two generations and readback are mandatory. Without safe save capabilities, save is HOLD. Deleted new IDs remain reserved in checkpoints; tombstone revival is authorized only by an actual Session undo/redo. Quota/readback errors do not publish a new pointer.

Restore requires explicit confirmation on a fresh page, verifies the source archive and complete existing-POI identity, then uses the frozen engine's record/shape/export validation before activation. FALLBACK/CORRUPT remain **HOLD**, with no automatic pointer repair. An active Session cannot be replaced. Restore starts a new empty undo/redo timeline; history is deliberately not serialized. Back/Continue keeps the current single Session, map and history.

The frozen **B2 adapter is imported unchanged**. A small capability facade guards existing POIs, fresh-only additions, persistence concurrency and lifecycle. Persistence revisions are separate from B2's editing-state conflict check. There is exactly one existing engine Session, one Leaflet map and one existing timeline. No engine/store/history copy is introduced. Existing POIs are entirely read-only, including name, memo, kind, position, deletion and source metadata.

## Validation

- 14 new safety cases: review/cancel/stale reads, explicit acceptance, full POI protection, mixed area/POI export, source/opaque-entry preservation, save/restore, authorized tombstone Undo, stale-tab writes, lock/confirmation/busy refusal, quota/readback faults, damaged journal, rehashed malicious snapshot and legacy ambiguous/orphan circles.
- 155 regression/frozen-boundary cases: B1/B2 adapter compatibility plus focused KMZ staging/export, legacy conversion, circles, area membership, Session and journal concurrency/recovery tests and the additions-only scope check.
- Frozen B1/B2 browser assertion sequences against the derived presentation: **3 widths each PASS**, assertions and thresholds unchanged. Only presentation/output routing is adapted in memory; frozen builders are not executed and frozen files/evidence are never written.
- Actual new-entry flow at **390×844, 393×852, 1366×768 PASS**: reject bad file, review/cancel/start, new POI edit, save, Undo/Redo, Back/Continue, KMZ download/reimport, navigation and real same-origin storage resume, existing read-only display, isolated key access, one map/Session and zero UI resources/object URLs after disposal. Network and real user datasets are excluded.
- Additions-only scope check protects every pre-existing tracked path, including A/B1/B2, shared engine, Creative Mode, Wayfarer/Bridge/Field, r16-r30 and data. No synced project source is edited.

Development checks found and fixed the entry's inherited base-URL resolution and permanently hidden Resume button. Two test harness assumptions were corrected: hidden Save during placement and absent editing fields on existing POIs. Map counting instrumentation was placed after a newline to avoid the vendor's trailing source-map comment. Final assertions were not weakened. Detailed generated evidence stays in CI artifacts; it is not duplicated in Git.

## Changed files (additions only)

- `creative-next/original-ui-r31-b3-b4/workspace.mjs`
- `creative-next/original-ui-r31-b3-b4/bootstrap.mjs`
- `creative-next/original-ui-r31-b3-b4/ui-runtime.mjs`
- `creative-next/original-ui-r31-b3-b4/index.html`
- `creative-next/original-ui-r31-b3-b4/README.md`
- `creative-next/qa/r31-b3-b4/build.cjs`
- `creative-next/qa/r31-b3-b4/workspace.test.mjs`
- `creative-next/qa/r31-b3-b4/browser.cjs`
- `creative-next/qa/r31-b3-b4/regression.cjs`
- `creative-next/qa/r31-b3-b4/scope.test.cjs`
- `creative-next/qa/r31-b3-b4/run.cjs`
- `creative-next/qa/r31-b3-b4/.gitignore`
- `.github/workflows/creative-next-r31-b3-b4.yml`
- `creative-next/R31_B3_B4_REPORT.md`

## Commit and CI

- Initial implementation commit: `f1672066010bd455bc42fba3ff797e1d420067b9`.
- Final verified runtime/test commit: **`02b511f9f404ae9f7e391e76618b0e8ab273098d`**. The final change releases the owned Session reference and denies state reads after disposal.
- [Dedicated CI 38181493057](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38181493057), attempt 1: **SUCCESS**, 2026-10-12 07:42:38–07:43:56 JST. Exact head is the final source SHA above. Result: `unitPassed:169`, `unitFailed:0`, `b2Regression:PASS`, `b3b4Browser:PASS`, `safariRealDevice:NOT_TESTED`, `productionMerged:false`, `published:false`.
- Earlier source CI 38181403699 was explicitly cancelled when the disposal fix superseded it, to avoid duplicate full test runs. No acceptance thresholds were changed.
- Existing old-preview workflows also report FAIL ([38181491808](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38181491808), [38181492329](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38181492329)). They are the unchanged two workflows already reported FAIL at the B2 baseline and remain outside this scope. This is not a claim that every workflow in the repository is green.
- Protected B2/A-B1/main refs were verified unchanged after final CI. Local original B2 checkout is clean. The final report-only commit changes this Markdown file only and is excluded from dedicated CI trigger paths; all tested runtime/QA code stays exactly at the verified SHA.

## Remaining HOLD

**iPhone Safari実機未検証。** Browser checks use desktop Edge/Chromium with mobile viewports; Safari, IME, real mobile dialogs, real network imagery and device quotas are not certified. Corrupt/fallback recovery and overwrite-capable destination selection intentionally remain HOLD. B3/B4 PASS does not certify the entire Creative Next product for production, nor authorize a main merge or publication.
