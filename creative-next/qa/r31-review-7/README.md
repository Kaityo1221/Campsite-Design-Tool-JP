# Creative Next r31 iPhone feedback fixes, 2026-10-12

Dedicated development branch: `fix/creative-next-r31-iphone-review-7-20261012`.
Base: `9388624d6401d27ba8c145e0c01c61e2747ec731` (B3/B4 PASS report).
This work is **NOT deployed**, not merged to main, and not proven on an actual iPhone yet.

## Fixes implemented in this branch

1. **#001 Gym touch**: touch pointer-up selects the POI kind before synthetic click; deduplicates delayed click. A full per-kind capacity shows an explanatory message rather than silently ignoring the tap. The existing 12/8/5 capacity policy is preserved.
2. **#002 Activity range**: "描き直す" only starts a UI draft. Cancel has zero Session mutations, and confirmation sends a single `area-replace` engine command, validated and recorded as one history step. Delete selection has an exit button; final deletion asks for confirmation. No automatic undo, guessed area ID, or POI edits.
3. **#003 Layers**: removes only the activity-range visibility row from the layer panel. Draw/editor functionality and area visibility in the map remain.
4. **#004 Draft button**: hides `下書きを保存` from the menu. B4's existing versioned persistence and explicit resume backend are not erased or automatically migrated; **no autosave** is introduced.
5. **#005 KMZ download**: when original KML has multiple same-name output folders, export creates a unique *new* destination folder only for additions. It never selects/merges original ambiguous folders or repairs ambiguous circle ownership. Export is round-trip validated first; Safari Download is then a separate synchronous user gesture from a prepared Blob URL. Stale editor state refuses download. The original KMZ is never opened for writing.
6. **#006 Save destination**: removes the overwrite-capable `保存先を選ぶ` choice. Download and cancel remain.
7. **#007 Ruler**: closes an open detail panel on ruler entry and routes taps on POI markers to the ruler without reopening POI details; markers remain visible.

## Required verification and release gates

New targeted tests:
- `node --test creative-next/qa/r31-review-7/review.test.mjs`
- `node creative-next/qa/r31-review-7/browser.cjs`

New dedicated CI:
`.github/workflows/creative-next-r31-iphone-review-7.yml` (no deployment job).

Code has passed in-session V8 syntax parsing for the six modified runtime/engine modules. The pure area-replacement planner was exercised with valid and duplicate-vertex inputs: valid plan created one history entry without changing original data; invalid input rejected. **End-to-end CI/browser test results have not yet been independently verified.**

Remaining before approval:
- Verify CI success and downloaded KMZ reimport + original folder preservation, including actual duplicate-folder real-world data.
- Run physical iPhone Safari tests for Gym tap, area cancel/redo, ruler marker tap, and the preflight Download.
- Reconcile the B3/B4 generated build recipe before running it again. The frozen B3/B4 build rewrites `ui-runtime.mjs` from its old baseline, which would overwrite these intentionally derived edits. Do not run the old builder on this branch without porting the fixes to a follow-on generator.
- Deploy a **new, isolated Sites preview** only after tests pass. The old Sites preview remains untouched.
- No production/main merge until explicitly authorized.

Safety invariants: existing POIs read-only; `LEGACY_CIRCLE_AMBIGUOUS` HOLD; one Session/Leaflet/history; original files and old localStorage untouched; opaque ZIP members preserved.
