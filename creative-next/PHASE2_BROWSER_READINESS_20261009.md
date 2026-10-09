# Creative Next | Browser readiness checkpoint, 2026-10-09 JST

**ISOLATED NON-PRODUCTION. DO NOT MERGE, DEPLOY, OR START IPHONE ACCEPTANCE.**

Repository: `Kaityo1221/Campsite-Design-Tool-JP`.
Branch: `feature/creative-next-kmz-phase1b-20261009`.

## What changed

1. Added a capability probe that never touches any legacy storage key, catches
   `localStorage` getter `SecurityError`, and separately reports import, export,
   save/resume, and UUID readiness. Missing features disable their respective
   controls instead of failing the entire preview page.
2. Pinned Leaflet 1.9.4 script and styles with published Subresource Integrity
   hashes. **CDN/tile loading remains network-dependent and unverified**.
3. Leaflet status now comes from tile-layer load/error events; initial
   initialization does **not** falsely claim basemap tiles loaded. A
   no-basemap canvas fallback remains available.
4. Added an isolated localhost-native Chromium runner with a private fixture
   argument. This checks real native browser storage/WebCrypto and can exercise
   Kasai KMZ load/save/reload *when browser navigation is permitted*.

## Verification performed in current environment

- `node --test creative-next/phase-1b/test/*.test.mjs`: **205 PASS, 0 FAIL**
  (195 previous + 8 browser capability + 2 Leaflet tile-status tests).
- Real user-supplied original Kasai KMZ: **six regression programs PASS**,
  original archive not modified. The original KMZ is **not committed**.
- JavaScript syntax checks PASS.
- Native Chromium tried `data:` and `file:` navigation and locally-served
  HTTP-origin navigation: **BLOCKED** (`net::ERR_BLOCKED_BY_ADMINISTRATOR`).
  This is an environment limitation. Native browser test = **NOT PASS**.
- No Safari, WebKit, live Leaflet tile, or native browser storage success
  is asserted. LocalStorage and WebCrypto have only mock unit tests so far.

## Outstanding quality gates

- Real HTTP-origin Chromium/WebKit tests with native `localStorage` and crypto:
  verify open/save/reopen, quota, two tabs, crash/restart, and abort recovery.
- Verify real Leaflet 1.9.4 loading and actual basemap tiles, marker events,
  vertex dragging, fit bounds, layers on iPhone-sized screens.
- Safari device: size limits, KMZ roundtrip, 700/701 existing boundaries,
  25/26 new, backup/recovery, regression against old Creative Mode.
- Final PO go/no-go for real device test, then separate release authorization.

The established `main` baseline and the old Creative Mode are untouched.
