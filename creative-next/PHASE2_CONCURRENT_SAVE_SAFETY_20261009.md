# Creative Next | Concurrent Save Safety

**2026-10-09 JST · Isolated development only · NOT PASS for native browser / iPhone · DO NOT MERGE**

Repository: `Kaityo1221/Campsite-Design-Tool-JP`  
Branch: `feature/creative-next-kmz-phase1b-20261009`

## New issue reproduced (prior implementation)

Two isolated tabs / journal instances sharing `campsite-creative-next-v1:*` could both write the same inactive localStorage slot before one switched the `current` pointer. In a deterministic local reproduction using real SHA-256, simultaneous first saves returned `SAVE_VERIFY` and `SAVE_CONFLICT`; a subsequent load fell into `FALLBACK`. A pointer check alone does **not** serialize multi-key operations.

## Remediation (only new-flow files)

- `phase-1b/core/journal-save.mjs`: serialize **the entire two-generation save operation**, from reading state through checking the committed pointer, using a named, origin-scoped **exclusive Web Lock** (`<namespace>:save-lock`). The preview uses a strict `requireLock:true` mode. If no Web Locks API is available, preview saving must refuse rather than silently race. The existing unit-test-only non-browser storage mode remains available for isolated tests; this is **not** a browser safety guarantee.
- `phase-1b/integration/isolated-editor-session.mjs`: browser opts into cross-tab exclusive locks. An unsaved, newly imported workspace now submits `expectedRevision:null` instead of disabling version checks. Saving it over an existing stored project raises `SAVE_CONFLICT` and preserves the previous generation; a confirmed restore provides the current revision to permit the next save.
- `phase-2-preview/browser-capabilities.mjs` + `preview.mjs`: read-only lock capability probe, warning and **Save/Resume disabled** when origin-scoped Web Locks are unavailable; native preview passes the lock manager to the journal.
- `qa/real_origin_chromium.py`: when run on a permitted origin, the browser harness additionally requires real Web Locks and tests stale-tab initial-save refusal. It never runs against production and never uploads the original private KMZ. This browser test is **not yet executed successfully**.
- `test/journal-web-locks.test.mjs`: 5 new tests for fail-closed, concurrent first/second-generation saves, failed queued writer, and namespace independence; `test/browser-capabilities.test.mjs`: 2 new probe cases; `test/isolated-editor-session.test.mjs`: 1 new integrated dual-session test and revised expectations for stale saves.

## Verified in this turn

- Prior unsynchronized two-tab race reproduced: `SAVE_VERIFY`, `SAVE_CONFLICT`, `FALLBACK`.
- `node --test creative-next/phase-1b/test/*.test.mjs`: **214 PASS / 0 FAIL** (206 previous + 8 additions). Source and test syntax checked by running the tests; Python browser acceptance harness passed `py_compile`.
- Six **private** user-supplied Kasai KMZ regressions passed with 188 existing POIs, 25 new POIs, 213 distance circles and 1 activity area. The original KMZ is **not** in GitHub or artifacts.
- `python qa/real_origin_chromium.py --root . --kmz <private local KMZ>`: **BLOCKED**, exit code 2, due to managed-browser navigation policy. It is not a failure or success verdict for native-origin Web Locks, localStorage, Leaflet, iPhone Safari or tile loading.

## Boundaries and remaining gates

Web Locks coordinate **cooperating same-origin tabs**, not other origins, older noncooperating scripts or a malicious writer. localStorage has no atomic multi-key transaction. Native Web Locks behavior, abrupt tab termination, storage quota recovery, Leaflet tile/overlay rendering, browser storage persistence, Chromium and WebKit, plus iPhone Safari still require a permitted real-browser test environment. Do not mark Phase 1-B or Phase 2 PASS on the basis of Node tests alone.

`main`, legacy Creative Mode and `next-lab-creative-v7` unchanged. No PR, deploy, public exposure or iPhone test has been authorized by this change.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API
