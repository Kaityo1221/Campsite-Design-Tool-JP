# Creative Next | Explicit Two-Generation Recovery Checkpoint

**2026-10-09 JST | Isolated branch only | NOT PRODUCTION READY | DO NOT MERGE**

## Scope

Added **isolated recovery diagnostics and explicit pointer-only recovery** to `phase-1b/core/journal-save.mjs`.

- `inspectRecovery()` reads and SHA-256-verifies both candidate generations, reports the exact slot/revision/checksum and the observed pointer, and **does not change storage**.
- `recover({confirmed:true,slot,revision,checksum,observedPointer})` is a **separate operation**. It works **only when the journal currently reports `FALLBACK`**, and only if the user has explicitly chosen a previously inspected, still-valid generation.
- The recovery path **requires the same exclusive Web Lock** as concurrent saves, checks for an intervening pointer change, rewrites only the `current` pointer, verifies pointer readback and the published snapshot, and does not modify either generation or old Creative Mode storage keys.
- A healthy, empty, entirely corrupt, stale, unconfirmed, unlocked, changed/corrupt selected slot, or failed-pointer-write path is fail-closed. It never claims to recover missing/corrupted data with no verified backup.
- This is **core API only**. There is **no end-user recovery button or native-browser implementation sign-off**. The existing isolated preview continues to open fallback data **read-only**; users cannot inadvertently run the new repair operation.

## Verification

- `node --test creative-next/phase-1b/test/*.test.mjs`: **225 PASS, 0 FAIL**. Eight new explicit-recovery cases on top of previous 217 checks.
- Private user-supplied Kasai KMZ: **six dedicated regression scripts PASS**, verifying existing POI 188, new POI 25, 213 owned circles, 1 area, edits, undo/redo, export and saved drafts. Raw user KMZ is **not included** in the source or artifacts, and is **never published**.
- Source provenance from previously approved Phase 1-A ZIP remains unchanged. No deployment, main modification, old Creative Mode access, public preview or iPhone Safari test.

## Required next gates

1. Design a separate, clearly confirmed recovery UI that displays *which* verified generation is being restored, then safely enables saving only after reinspection and a successful pointer repair. Do not automatically repair on load/resume or choose the highest revision on the user's behalf.
2. Test **real browser-origin Web Locks and persistent localStorage** under normal Chromium, WebKit, and iPhone Safari contexts. This execution environment continues to block real-page navigation. Node tests cannot certify browser behavior.
3. Complete native Leaflet tile/event rendering, persistent storage closure/quota checks, historical/production regression, and the user-approved iPhone test gate.

Repository: `Kaityo1221/Campsite-Design-Tool-JP`; branch: `feature/creative-next-kmz-phase1b-20261009`.
