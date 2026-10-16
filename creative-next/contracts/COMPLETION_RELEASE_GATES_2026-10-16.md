# Campsite Design Tool 新フロー | Completion and release gates

**2026-10-16 JST | PR #368 Draft | Phase 1 HOLD | This file is a plan, not approval.**
`Wayfarer Map → Creative Next → Campsite Design Tool → Creative Next (re-edit)`

## Definition of complete

A release is **not** complete when a synthetic LAB smoke test passes. Completion requires one uninterrupted, user-confirmed, production-equivalent workflow with an approved format and access controls: authenticated Wayfarer observation; exact primary Project, immutable provenance and three separate observation zones; Creative editing and durable revisions; trusted cross-origin transport; real Campsite Project receipt; the actual distance screen with a resolved 40m/50m policy; return to Creative with preserved POI/geometry/journal/history semantics; conflict-safe resume/rollback; and final iPhone Safari + Android device evidence. Production must be reversible without losing existing projects.

## Delivery milestones and objective gates

| Milestone | Required evidence | State (at writing) | May release? |
| --- | --- | --- | --- |
| A. Reproducible isolated round trip | WM3 synthetic relay → genuine frozen r31 → separately verified Project/NEW_V1 pair → cross-origin manually selected ZIP → isolated receiver → one-file or two-file reimport → re-edit/save → original received revision unchanged | Chromium 390/393 **PASS**, run [38914430504](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38914430504); latest WebKit full-round-trip **not yet concluded** | **No** |
| B. X-01 typed geometry decision | Approve ownership and mapping for design polygon, historical acquisition polygon, **0 / 1 / many** Creative activity areas, vertex ordering, and Distance input meaning. Review and approve a complete non-lossy adapter. | Diagnostic and explicit-selection HOLD prototype only; **PO approval missing** | **No** |
| C. X-04 trustworthy interchange | Specify source authentication, destination binding, authorized Project/Handoff IDs, versioned manifest, integrity, confidentiality policy, replay resistance, destructive-data handling and expiry. Independent security review. | Unsigned, unauthenticated LAB ZIP only; **PO/security approval missing** | **No** |
| D. Versioned Project persistence | New reviewed Project import path, strict currentPois/no selectedPois resurrection, no generic type/coordinate coercion, multi-generation CAS, durable journal, verified rollback and crash recovery. | Isolated create-only receiver + read-only dry-run transition; no formal persistence/rollback | **No** |
| E. Official Distance integration | Genuine Distance UI uses approved typed areas, three-zone handling, recomputes after edit, never promotes external or reserve POIs, resolves legacy text 40m vs code 50m; blocked analytics in LAB must become reviewed production behavior. | Read-only existing JS + Leaflet simulation PASS (3 pins/3 lines); actual app import **unconnected** | **No** |
| F. WM-7 and WM-8 end-to-end | Real authorized Wayfarer observation, Base/Local/Remote diff, conflict resolution, re-observation outcomes, staged failure recovery, full three-page E2E with synthetic-and-authorized fixtures | WM3 simulated service only; WM-7/WM-8 **not passed** | **No** |
| G. Device parity and controlled rollout | Native iPhone Safari and Android export/choose/reopen/large-file/refresh/two-tab, accessibility, rollback exercise, feature flag OFF by default, production monitoring and formal owner sign-off | Chromium/mobile-size and macOS WebKit simulator are **not native-device tests** | **No** |

## Work ordering to avoid rework

1. **Finish isolated UX and automated regression first**: protected preview, one-file return, invalid ID/cancellation, two-tab, original revision preservation, 0/1/many areas. Do not read real Wayfarer user data or publish LAB publicly.
2. Obtain **X-01 and X-04 explicit product/security sign-off**. No automatic assumptions about polygon meaning, provenance, or trusting a ZIP. Keep their decisions in a versioned review document before any real connection.
3. Implement the **new reviewed, feature-gated actual import** behind a test-only route. Do not silently change the old `bridge-distance-project.js` behavior or the current `campsiteProject.v1` save key.
4. Add **immutable revision history and verified recovery** and re-run concurrency/failure tests with real browser storage.
5. Connect the **actual Distance UI** and then WM-7 conflict handling, preserving all three geometries and source zones; settle the 40m/50m discrepancy by review.
6. Run **WM-8 + Safari/Android physical-device verification**. Rollout requires evidence from both device classes, owner approval, feature flag, observability, and tested kill switch.

## Explicit non-negotiable protections

- `main` baseline at start of this work: `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`. Approved r31 UI baseline: `3c63170c81aaca130e774d98d25be9c98aa38bea`. Any difference requires fresh review.
- PR #368 remains **Draft/unmerged**. Phase 1 HOLD is not released by CI green, a demo, or this document.
- Never overwrite existing production or current legacy Project data from an unapproved ZIP or dry-run generation candidate.
- A complete cryptographic hash match proves internal consistency, **not** an authenticated source.
- No live Wayfarer credentials/real location data in fixtures, test ZIPs, GitHub artifacts, or public previews.
- Fail closed; never auto-repair, auto-promote the first polygon, infer deleted POIs, or auto-merge a conflict.

## Current next action

Record the full-round-trip WebKit simulator result for `e8a5d3cf` / `5ec6f1e8` separately. Fix LAB regressions until Chromium and WebKit both pass the **single-file** return. Then use the full workflow to prepare the versioned X-01/X-04 review candidates **without approving them**. Only after those decisions may an actual feature-gated Campsite receiver be implemented.

## Step 1 closure reliability (2026-10-16, Draft LAB only)

- Safari/WebKit CI defect: preview builder and browser harness generated semantically identical synthetic KMZ archives with different ZIP timestamps, causing a false binary mismatch before `try/finally`. The harness now compares exact decompressed archive-entry bytes and guarantees browser close when fixture validation fails. The ZIP/Project **application** integrity checks remain strict and are not bypassed.
- Return page invalidates a prepared manual ZIP as soon as Project ID, Handoff ID or source file changes. While verifying it locks the source fields. No download is shown until the complete canonical return, typed Distance staging **and** distance preview pass. A final click-time identity check also blocks stale prepared data.
- The three-function browser E2E asserts that changing Handoff ID hides the prepared download and re-verifying restores it. This is synthetic isolated parity testing, never approval of source authenticity or live legacy Distance integration.
