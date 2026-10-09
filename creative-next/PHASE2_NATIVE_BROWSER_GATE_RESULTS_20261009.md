# Creative Next — Native Chromium browser gates (2026-10-09)

**ISOLATED DEVELOPMENT ONLY. NOT A PRODUCTION PASS. DO NOT MERGE OR DEPLOY.**

## Scope
- Isolated branch: `feature/creative-next-kmz-phase1b-20261009`
- Synthetic KMZ only. The real Kasai KMZ and the old `next-lab-creative-v7` store were not uploaded or touched.
- CI runner: Ubuntu GitHub Actions, Node 22 and actual Chromium via Playwright, local HTTP origin, actual Leaflet 1.9.4 and OSM tile network.
- Successful run: https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/37903250388
- Tested source commit: `edf2ca6efde3660c12a1989f7ff866942f183cc9`

## Passed evidence
1. Node regression: **243 tests passed, 0 failed**.
2. Real Leaflet rendering and at least 1 real map tile loaded, no map fallback.
3. Native Leaflet map tap proposes coordinates but does not commit an unconfirmed POI.
4. Synthetic KMZ import, native origin-backed localStorage save, reload, 2-generation journal and explicit UI recovery.
5. Native Web Locks two-tab first-save collision: exactly 1 save succeeded and the other failed with SAVE_CONFLICT.
6. Native localStorage quota exhaustion: actual **QuotaExceededError**; previous committed pointer and `READY` revision 1 remained unchanged.
7. Dedicated persistent Chrome profile, **8 seconds after save**: top-level browser process killed with **SIGKILL**, browser relaunched using the *same on-disk profile*, `READY` revision 1 and saved title recovered.

## Critical unresolved durability finding
- Earlier persistent-profile test killed Chromium about **1 second after save**. A fresh launch returned `EMPTY`; recorded in GitHub Actions failed run https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/37903023632 .
- After an 8-second disk-flush window the same class of test PASSed. This **does not prove durability against immediate process termination**. The browser may batch its LevelDB flushes. JavaScript localStorage read-back verifies the in-process value, not a filesystem fsync.
- Do **NOT** describe save as guaranteed durable under immediate renderer/browser SIGKILL, or mark the full Phase 2/iPhone Safari/release gate PASS.
- Investigate a stricter durable storage strategy (e.g. well-tested IndexedDB transactions with supported durability settings) or an explicit portable KMZ backup before changing the save guarantee; test on Chromium and Safari independently.

## Gates
| Gate | Current result |
| --- | --- |
| ① Explicit recovery panel | Implemented and isolated tested |
| ② Native Leaflet map/tile/load/map-tap basic test | **PASS** in Chromium CI; additional real interaction/browser coverage needed |
| ③ Native reload, two generation, recovery, quota failure, two-tab race | **PASS** in Chromium CI |
| ③ Abrupt termination after 8 sec | **PASS** in Chromium CI |
| ③ Abrupt termination ~1 sec after save | **NOT PASS: observed empty storage** |
| Safari / iPhone, PC full product regression, public deploy | **NOT RUN / NOT AUTHORIZED** |

Never modify `main` or old Creative Mode during these isolated tests.
