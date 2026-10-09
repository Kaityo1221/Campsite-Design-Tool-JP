# Creative Next | Strict Save Revision Guard

Date: 2026-10-09 JST. **Development-only. Do not merge or release.**

Repository `Kaityo1221/Campsite-Design-Tool-JP`; isolated branch `feature/creative-next-kmz-phase1b-20261009`.

## What changed

- `phase-1b/core/journal-save.mjs`: when `requireLock:true` (strict browser-facing saves), reject every `save()` call that does not explicitly provide `expectedRevision`. Accept `null` for a first save, or a positive safe integer for a previously observed revision. Reject missing, `undefined`, negative, fractional, nonnumeric, and `NaN` values before acquiring a Web Lock or touching storage. Error code: `SAVE_REVISION_REQUIRED`.
- `phase-1b/test/journal-web-locks.test.mjs`: existing lock tests now explicitly submit `expectedRevision:null` for first saves; 3 new tests check missing / invalid preconditions, no write/no lock acquired on rejection, and stale `null` revision cannot replace an existing project.
- No other source or production path changed. Phase 1-A files untouched. The editor already submits `expectedRevision:revision`; this guards against future integration callers bypassing the stale-tab precondition. For legacy isolated Node tests using `requireLock:false`, default behavior is unchanged.

## Verified

- `node --test creative-next/phase-1b/test/*.test.mjs`: **217 PASS, 0 FAIL** (214 prior + 3 new).
- `node --check` on both modified JS modules: PASS.
- Python browser acceptance script syntax (`py_compile`): PASS.
- User-provided real Kasai KMZ SHA-256 unchanged: `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162`.
- Six private Kasai KMZ checks PASS: format conversion, editor session, dependent circles, POI additions/kind, activity-area vertex edits, and area add/remove. Existing 188, new 25, distance circles 213 and activity areas 1. The private KMZ is not part of the deliverables or repository.
- `python qa/real_origin_chromium.py --root . --kmz <private Kasai file>`: **BLOCKED due to managed Chromium navigation policy**. Do not describe this as a native-browser PASS or as proof of an app bug.

## Remaining gates

Native Chromium/Leaflet/tile rendering, real origin-scoped Web Locks + localStorage concurrency and quota, sudden tab/browser termination and recovery, WebKit and iPhone Safari, and formal Phase 1-B/Phase 2 PASS remain outstanding. No production/main file changed, no PR merge, no deployment, no live browser/mobile signoff. The user reserves explicit authorization for starting iPhone tests and releasing.
