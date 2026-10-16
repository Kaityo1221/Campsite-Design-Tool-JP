# Campsite Return Receiver LAB / read-only receive candidate

**Date:** 2026-10-15 JST
**Target:** PR #368 isolated `feature/creative-next-r31-confirmed-project-save-ui-20261012`
**Status:** READ-ONLY CANDIDATE. Full production Wayfarer → Creative → Campsite return still **HOLD**.
**Source:** `creative-next/contracts/campsite-return-receiver-lab.mjs`
**Private preview route:** `creative-next/qa/campsite-return-lab/index.html` under a dedicated, access-controlled nonproduction hostname only.

## What the browser LAB now actually does

1. After user-confirmed r31 import/edit/save in the **separate** creative-next IndexedDB, navigate to an isolated Campsite Return LAB HTML page on the **same browser origin**.
2. Provide the exact Project ID and Handoff ID. No stored-project listing is exposed.
3. Read a row via the existing `createX01IndexedDbSaveLab().read()`, which validates the canonical manifest and SHA256 before returning.
4. Re-verify Project plus `NEW_V1` KMZ with `createLinkedPairLab()` and `reopenLinkedPairLab()` before showing the immutable, non-authoritative preview.
5. Show saved generation, Project/Handoff IDs, snapshot, 3 Wayfarer observation zones, current/added POIs, **separate** design/acquisition polygons and activity-area count. Unknown/future metadata must survive the verified Project JSON.
6. Wrong ID, invalid file, missing lineage, incomplete observation, or ambiguous POI: **HOLD**, no silent normalization, no repair, no deletion.

All UI fields are displayed using `textContent`, not inserted HTML from user-supplied Project data. No data download, automatic POST, `postMessage`, Project sessionStorage write, or bridge receiver redirection.

## Existing legacy receiver is NOT the return receiver

`bridge-receiver.html` only accepts `CAMPSITE_BRIDGE_POI_V1` **inbound from allowed Wayfarer origins**, then normalizes/deduplicates Active GUID POIs for the Campsite selection flow. It does not accept the versioned Creative Project + original/source/edited `NEW_V1` KMZ. Sending Creative new POIs (no Wayfarer GUID), entire polygon sets, original/selected/edited lineage, historical observation, or unknown project fields through that payload risks silent loss.

The new candidate **does not call** this legacy receiver and always reports `legacyBridgeReceiverCompatible:false`, `writeAllowed:false`, `productionReady:false`. Its "ready" status indicates only that source conservation checks passed, not that the user's real project can be imported into the normal Campsite editor.

## Browser/storage boundaries

The r31 test preview and the Campsite Return LAB currently share the isolated Vercel preview **hostname**. IndexedDB is origin-scoped. If final Campsite deployment uses a different hostname, this exact in-browser `store.read()` handoff will **not** work across origins. An explicit user-confirmed transfer of a versioned linked pair is needed; do not weaken origin security, use wildcard `postMessage`, or mirror the LAB database into production.

## PO approval still required

- X-01: only `project.polygon` may represent the design polygon, with approved UI for editing it; Creative activity areas are a different channel and must not be picked as the first polygon.
- X-04: select **linked versioned Project sidecar + NEW_V1 KMZ** versus newly specified KMZ envelope and approve reliable cross-origin transport, atomicity, deletion/status/diff provenance, migration and rollback.
- Actual Campsite Project editing/return UI, real Wayfarer/GCS acquisition, 2-complete-observation absence, Base/Local/Remote diff, Android parity and independent production release approval.

Existing Creative Mode, its journals, `campsiteProject.v1`, Vercel Production and approved frozen r31 UI were not modified.

## Evidence

- New real Chromium browser chain in `creative-next/qa/three-function-r31-browser-lab.cjs` runs WM3 pseudo collector and actual Bridge exporter, a test fixture's Project/NEW_V1 pair, actual r31 editing, isolated save, **real Return LAB browser UI**, wrong-Handoff HOLD, valid re-read and old-key preservation.
- Guard tests in `creative-next/qa/campsite-return-receiver.test.mjs` exercise incomplete acquisition, wrong Handoff, missing source lineage, corrupted KMZ and reference leakage. Record full CI PASS only when workflow finishes.
- Phase 1 HOLD / PR Draft persists.
