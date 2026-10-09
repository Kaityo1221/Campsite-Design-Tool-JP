# Creative Next | Recovery UI and browser gate status

**2026-10-09 JST | ISOLATED DEVELOPMENT ONLY | NOT PRODUCTION READY | DO NOT MERGE**

## Target gates requested

| Gate | Evidence / outcome |
|---|---|
| ① Explicit recovery panel | **IMPLEMENTED; isolated tests PASS.** A recovery button, read-only status and verified revisions, no default choice, explicit confirmation, pointer-only repair with stale-pointer Web Lock guard, no v7 mutation. |
| ② Real Leaflet/map tiles and events | **NOT PASS / ENVIRONMENT-BLOCKED.** Synthetic map logic previously tested, but the actual Leaflet library and map tiles have not completed native-origin browser QA. |
| ③ Native browser persistence, reload, quota/abrupt stop, multi-tab race | **NOT PASS / ENVIRONMENT-BLOCKED.** Node mocked-storage journal tests PASS, but origin-backed real localStorage and Web Locks cannot be certified in this container. |

## What changed

- `phase-1b/integration/isolated-editor-session.mjs`: `inspectRecovery()` (read only), `recoverDraft({report,candidate,confirmed:true})` (checked, user-selected, explicit recovery; reopens verified editor data).
- `phase-2-preview/recovery-choices.mjs`: derive safely presented choices from a `FALLBACK` report; never preselect a revision.
- `phase-2-preview/index.html`, `preview.mjs`, `preview.css`: recovery panel, guarded selection, confirm/cancel and stale-diagnostic clearing after save/resume/new import.
- `phase-1b/test/recovery-panel-integration.test.mjs`: six fresh cases (safe diagnostic, older generation, stale pointer, invalid choice, absent Web Lock, healthy state).
- `qa/native-browser-gates.py`: **real browser-origin test runner** using localhost and Playwright (actual Leaflet, native storage, Web Locks, two-tab race, reload and explicit recovery), designed to FAIL or report blocked rather than produce a false PASS.
- `qa/recovery-ui-layout.py`: Chromium `about:blank` DOM/layout-only smoke at 390px. **Not** a native browser-origin or persistent storage test.
- `qa/generate-test-kmz.mjs`: generates entirely synthetic test fixture, not user's real KMZ.

## Verification

- `node --test creative-next/phase-1b/test/*.test.mjs`: **231 PASS / 0 FAIL**, including previous 225 cases, plus 6 recovery-panel cases.
- Private original Kasai KMZ: **six dedicated regression scripts PASS**. Source remains 188 existing / 25 new POIs / 213 distance circles / 1 activity area; no original KMZ bytes committed.
- Chromium at width 390px with DOM injected into `about:blank`: **recovery panel layout PASS**, but no app modules/real Leaflet/storage were running in that smoke test.
- Headless Chromium navigation to an isolated localhost HTTP server: **blocked by administrator**. Consequently ② and ③ remain **unverified**, regardless of unit test count.

## Remaining required verification

Run `python creative-next/qa/native-browser-gates.py` in a permitted browser test environment with installed Playwright Chromium and access to Leaflet 1.9.4/CDN and live map tiles. Extend it to explicit quota exhaustion and abrupt browser-process termination scenarios before signing off ③. Perform cross-browser/WebKit and user-authorized iPhone Safari tests before public release. Never mark ②/③ PASS from unit tests or fake storage.

`main` and old Creative Mode (`next-lab-creative-v7`) are untouched. No PR merge or public deployment authorized.
