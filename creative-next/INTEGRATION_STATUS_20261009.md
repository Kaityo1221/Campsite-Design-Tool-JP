# Creative Next | Phase 1-A → Phase 1-B isolated integration status

Date: 2026-10-09 JST. Status: **NOT PRODUCTION READY / DO NOT MERGE**.

## Provenance
- The POI core and tests under `creative-next/phase-1a/` are the 19 source files from user-supplied `Campsite_Phase1A_STEP1_Codex_Retest_20261008.zip`. ZIP integrity was checked.
- All **19 GitHub blob SHA-1 hashes** match the approved ZIP's corresponding local files byte-for-byte.
- The supplied implementation report independently documents 33/33 Node PASS, 15/15 MJS syntax PASS, Chromium and WebKit isolated browser PASS in the prior Codex environment. It also records an initial environment-related browser launch failure. These earlier browser results are *not* a new browser pass in the current environment.
- A separate recreated Git worktree fixture passed the **33/33 Phase 1-A Node tests** locally.
- The local Phase 1-B suite with the fresh-data bridge passed **117/117 Node tests** (previous Phase 1-B 105 plus 12 bridge tests), no failures. These are not production/browser tests.

## Implementation scope
- `creative-next/phase-1b/integration/phase1a-fresh-bridge.mjs`: narrow bridge from Phase 1-A canonical snapshot to a **fresh NEW_V1 KMZ** and separate journal-ready record snapshot.
- Null external IDs are omitted from fresh KML but retained in canonical saved records. Empty Phase 1-A metadata is accepted; any unknown attributes, nonempty metadata, invalid coordinates, duplicate IDs or unsupported activity fields HOLD (no lossy export).
- Existing 701+ are rejected, new 26+ are held with warning rather than truncated, deleted POIs are kept as journal tombstones but excluded from exported KMZ. No live app state is mutated, no legacy storage key is read or written.
- No direct production UI entrypoints were changed, no import was applied to a live store, and no Phase 1-A files were modified compared to approved ZIP.

## Remaining work and gates
1. The real Kasai KMZ bytes have now been supplied in the conversation, structurally checked, and reported to match the previous Kasai fixture. **Full legacy-to-new import/roundtrip remains unimplemented and unapproved**. Legacy inputs still HOLD.
2. Phase 1-A + Phase 1-B **existing/source-bearing record** adapter and provenance-preserving migration is not built; the fresh-data bridge must not be used for this path.
3. Transactional live-store import confirmation, durable recovery/rollback, integration to the new Creative Mode UI and Undo/Redo, Browser/Chromium/WebKit regression and iPhone Safari tests remain pending.
4. The Phase 1-B journal is a two-generation logical journal, not a true atomic multi-key storage transaction. Device limits remain provisional.
5. **No main commit, PR merge, deploy, public exposure or iPhone test is authorized by this staging work.** The user delegated pre-device development decisions but reserved iPhone test start and release gates.

Repository: `Kaityo1221/Campsite-Design-Tool-JP`, isolated branch `feature/creative-next-kmz-phase1b-20261009`.
