# Creative Next: non-production isolated UI preview

**This is not public Creative Mode. Do not merge, deploy or link it from production.**

This preview connects a fully audited Kasai-style KMZ candidate to the approved Phase 1-A in-memory POI store through the Phase 1-B isolated editor session. Import requires explicit confirmation. It edits title/memo, supports Undo/Redo, guarded KMZ export and two-generation draft save/recovery in its own `campsite-creative-next-v1-preview` namespace.

Map canvas is only a coordinate-location illustration, **not** a fully functioning Leaflet / real map UI. Dependent distance circle moves/deletes, legacy kind reassignment, source-bearing POI additions and polygon editing are intentionally blocked until tested atomic updates are designed.

For local hosting, from repository root:

```bash
python -m http.server 8000
# Open http://localhost:8000/creative-next/phase-2-preview/index.html
```

Do not visit from an iPhone for approval testing without the user's test-start gate. Safari performance, origin-specific storage, WebCrypto, native downloads, cross-tab concurrency and crashes are not certified.

Dependencies: local JSZip 3.10.1 browser UMD file in `vendor/` (MIT-style license in `JSZip-LICENSE.markdown`), native browser DOMParser/XMLSerializer/WebCrypto; strict no-network KMZ reader. No external runtime libraries fetched. Preview data is stored locally in a non-production namespace.

Code tests: `node --test creative-next/phase-1b/test/*.test.mjs`. Real Kasai fixture remains private and is only used in an optional local runner. Browser UI smoke with 390px viewport was run with mocked origin-only browser storage/crypto due to environment blocking normal URL visits. This test does not constitute a Chromium/WebKit production-origin PASS.
