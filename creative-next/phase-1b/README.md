# Creative Next | Phase 1-B (isolated development)

**WIP: do not merge, deploy, publish or connect to existing Creative Mode.**
Baseline `main`: `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`. This directory has no application entrypoint and writes no saved Creative Mode state. Phase 1-A corrected code is not yet available for safe integration.

## Components

- `core/diagnose-kmz-candidate.mjs`: non-mutating policy evaluator. Separates `READY / HOLD / REJECT`, profile and issues; **always returns `canApply: false`**. Policy is not an importer.
- `core/stage-kmz.mjs`: bounded, non-mutating ZIP/KML reader that requires injected JSZip and DOMParser. Reads KML `ExtendedData`, coordinate original text, POI, polygon classification evidence. Retains the exact input bytes and original KML. It neither displays nor imports objects.
- `test/diagnose-kmz-candidate.test.mjs`: 28 policy unit tests.
- `test/stage-kmz.test.mjs`: 20 actual ZIP + XML tests, including 427-Placemark synthetic Kasai-shaped file, malicious archives, CRC corruption, unknown geometry, escaped Japanese text, duplicated KML, interrupted parsing.
- `test/browser-smoke.html`: opt-in native-browser smoke test. **Not yet PASS**; environment Chromium could not even load `about:blank`, so this test could not be executed here.

## Local test

Use Node 22 or newer and install dev dependencies within this directory (no application installation required):

```sh
npm install
npm test
```

Dependencies for tests: `jszip@3.10.1`, `@xmldom/xmldom@0.9.8`. Test results at handoff: 48 PASS, 0 FAIL. This test number **does not include Chromium, Safari, real Kasai/Hikarigaoka KMZ, KMZ export/reimport or Phase 1-A integration**.

The browser smoke page expects JSZip script from the dev dependency and serves from an HTTP test server. A browser-run report can be produced later when a working browser is available.

## Provisional safety envelope, not a final product limit

In isolated parser only: 8 MiB input, 32 MiB total expanded ZIP bytes, 16 MiB KML, 1500 entries, 4000 Placemarks. Optional parser limits may only reduce these bounds, not increase them. Final iPhone-safe limits will be selected after iPhone benchmarking. DTDs and entities, path traversal, multiple KMLs, unsupported archive formats, malformed/unverified KML and unknown external KML features are never silently imported.

`unknownInformationPreserved: true` means the parser still holds original input bytes in staging memory; it **does not** mean a future KMZ writer has demonstrated lossless roundtrip. The corrected Phase 1-A core and O-07 geometry exporter, O-08 transactional save, new UI, integration test and actual device PASS remain mandatory.

## Restrictions

1. Legacy entrypoints `creative/base-v7.html`, Bridge/Wayfarer, Field Mode, DB and old storage key `next-lab-creative-v7` are unchanged.
2. Profile-matched legacy KMZ stays **HOLD** until explicit profile implementation, real source import/export tests and further gates pass.
3. No partial apply; not even a `READY` candidate updates live data until explicit `置き換えて開始` and verified storage commit.
4. `main` and published old Creative Mode must remain untouched. Keep all changes on the isolated feature branch, draft only, pending a future formal gate.