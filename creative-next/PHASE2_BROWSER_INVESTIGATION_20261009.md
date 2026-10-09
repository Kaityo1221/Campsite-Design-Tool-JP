# Creative Next | Native-browser investigation & map safety gate

Date: 2026-10-09 JST. **ISOLATED DEVELOPMENT ONLY. NOT PRODUCTION READY. DO NOT MERGE.**
Repository: `Kaityo1221/Campsite-Design-Tool-JP`.
Branch: `feature/creative-next-kmz-phase1b-20261009`.

## Research basis

- Leaflet 1.9.4 official event contract: `loading` begins a tile batch; `tileerror` reports a failed tile; `load` reports the visible batch is finished, not necessarily that **all** tiles succeeded. See https://leafletjs.com/reference.html#gridlayer-loading and https://leafletjs.com/reference.html#gridlayer-load ; the Leaflet 1.9.4 package's GridLayer `_tileReady` fires `load` after errors as well. Code reference: https://app.unpkg.com/leaflet@1.9.4/files/dist/leaflet-src.esm.js.
- This is why a naive `load => READY` callback can mask the previous tile error. The isolated renderer now tracks errors per loading cycle, remains `ERROR` when an error was observed, and returns to `READY` only after a **new**, error-free loading cycle. The preview never claims initial `READY` merely from Leaflet initialization.
- A successful `READY` callback only confirms the map tile provider completed that loading cycle without a reported `tileerror`. It does **not** prove POI overlay correctness, offline readiness, or device Safari compatibility.

## Verified locally

- `node --test creative-next/phase-1b/test/*.test.mjs`: **206 PASS, 0 FAIL** (205 baseline, plus one new failure/retry lifecycle regression scenario and strengthened former test).
- The private user-supplied Kasai KMZ regression scripts **6 of 6 PASS**. Original archive was read-only; source/private KMZ bytes are **not committed**.
- `python qa/real_origin_chromium.py --root . --kmz <private-kasai.kmz>`: **BLOCKED** with `net::ERR_BLOCKED_BY_ADMINISTRATOR` in this managed environment, script exit code 2. No real-origin page load, native browser storage/crypto, true raster tiles, or Safari device success is claimed.
- Existing mock Leaflet + Chromium simulated tests from prior milestones remain distinct from a real Leaflet 1.9.4 runtime.

## Next external browser acceptance (not performed here)

Run the existing `creative-next/qa/real_origin_chromium.py` against **localhost served on the tester's own machine or a permitted CI environment**, not the public `main` deployment. Use an ephemeral browser profile, local private fixture and permitted 1.9.4 CDN access, avoid committing any fixture or browser profile. Confirm: actual `L.map`, real tile lifecycle and overlay rendering; file input, explicit review, non-production save/reload with real `localStorage` and WebCrypto; corrupted slot, quota failure, two-tab write conflict, recovery read-only path; 700/701 and 25/26 limits; viewport 390px; browser console/network failures. Fail closed on blocked navigation. Do not attempt to bypass administrator policy.

## Outstanding release gates

- Native HTTP-origin Chromium/real Leaflet & tile loading **NOT PASS**.
- Real-browser storage quota, double-tab, abort and restart **NOT PASS**.
- WebKit/iPhone Safari 700/701, 25/26, KMZ round-trip, session recovery **NOT PASS**.
- User approval to start iPhone testing and separate release approval still required.
- `main`, old Creative Mode, and `next-lab-creative-v7` untouched.
