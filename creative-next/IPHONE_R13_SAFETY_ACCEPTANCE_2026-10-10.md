# Creative Next r13 iPhone safety acceptance (2026-10-10 JST)

## Status / progress
- iPhone工程 **85%（前回80%より +5%） → 次の目標90%（iPhone UI最終調整）**。2026-10-10 19:24 JST、PO報告によるSafari安全性6/6と再開2/2を照合し85%安全性ゲートPASS。
- PC版・Android版はPO申告の完成状態を保持。今回の変更から完成版へ自動移植しない。
- `main`/旧Creative Mode/Field Mode/Bridge/旧保存キー/実KMZ原本/既存r9〜r12保存名前空間：**変更禁止、変更していない**。
- 隔離プレビューのみ。PO承認なしの本番公開・切替・マージ禁止。

## GitHub / immutable preview source
- Feature repository: `Kaityo1221/Campsite-Design-Tool-JP`
- Feature branch: `feature/creative-next-kmz-phase1b-20261009`
- QA source pinned for r13: `a1dcd68782de1cdfbc9bb162d0ac4b3a1f2a6639`
- Existing r12 static preview pinned to its earlier deployed source: `488c2c21b054dd084fd80b98e7911f3e0c735f59`
- Preview deploy repo: `Kaityo1221/campsite-creative-next-preview` (independent)
- Preview workflow commit: `87538e35bb7dcadceee07560e640ef13c4a26afb`
- r13 Safari safety test page:
  `https://kaityo1221.github.io/campsite-creative-next-preview/iphone-safety-r13/phase-2-preview/iphone-safety-lab.html`
- r13 isolated editor:
  `https://kaityo1221.github.io/campsite-creative-next-preview/iphone-safety-r13/phase-2-preview/index.html`
- Existing r12 remains:
  `https://kaityo1221.github.io/campsite-creative-next-preview/legacy-winding-r12/phase-2-preview/index.html`

## Safety lab scope (synthetic only)
- Its editor namespace is `campsite-creative-next-v1-iphone-safety-r13`.
- Lab journal/checkpoint/lock test keys are strictly under `campsite-creative-next-v1-iphone-safety-r13-lab*`.
- No real KMZ needed. Never delete/overwrite legacy `next-lab-creative-v7`, prior preview generations, or real POIs.
- **One-click lab check** validates:
  1. Safari localStorage/Web Locks/Web Crypto/IndexedDB readiness.
  2. Corrupted pointer is detected as fallback and is read-only (isolated in-memory storage).
  3. Simulated quota failure cannot publish a partial save (isolated in-memory storage).
  4. Two simultaneous native origin-scoped Web Locks writers cannot both commit.
  5. Actual localStorage journal write+readback.
  6. Actual strict IndexedDB checkpoint write+readback.
- **Separate post-restart verification**: reopen identical lab page after Safari reload or app restart; inspect the already saved lab journal and strict checkpoint independently.
- Synthetic in-memory fault tests do not establish that iOS' own native quota or forced process termination behavior is proven. Do not confuse these with a full iOS durability guarantee.

## Automated QA
- Feature Actions run [38043810917](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38043810917): **SUCCESS**. Includes Node regression, native localStorage+Web Locks/quota/crash, strict IndexedDB SIGKILL, IDB race+abort injection, recovery UI, new r13 one-click lab browser smoke/reload/readback, and PC E2E.
- Isolated preview Actions run [38043951949](https://github.com/Kaityo1221/campsite-creative-next-preview/actions/runs/38043951949): **SUCCESS**. Versioned files generated and Pages deploy succeeded.
- Native Chromium PASS is *not* a Safari/iPhone PASS, and synthetic QA is *not* a real user KMZ PASS.
- Prior PO-reported iPhone r10/r12 functionality and real Kasai/Hikarigaoka KMZ PASS remain recorded; do not repeat needlessly.

## User Safari gate to reach 85%
1. Open r13 **safety lab** above in iPhone Safari, tap `一括検査を実行`. All six result rows must be PASS. Otherwise record exact HOLD code/text, do not claim completion.
2. Reload page or fully restart Safari and open same r13 URL; tap `保存データを再確認`. Both localStorage and IndexedDB must show PASS.
3. Send copied result or screenshots. Only after confirming both tests and absence of regressions may the iPhone safety milestone be marked 85%.
4. If Safari cannot provide any required API, preserve stored data and hold the safety gate. Do not remove/overwrite old journal keys to make the test pass.
5. After 85%: iPhone UI adjustment (90%), combined regression (95%), then explicit PO release decision (100%). Android parity implementation comes only after evaluating recorded differences.

## iPhone Safari user-reported reopen acceptance (2026-10-10 19:22 JST)
- User submitted r13 lab results after Safari reopening (user-agent text: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.6.1 Mobile/15E148 Safari/604.1`). This is an **iPhone Safari user report**, not CI.
- `PASS | localStorage再開 | 状態: READY`
- `PASS | IndexedDB再開 | 状態: READY`
- `再開試験PASS: 両方の保存データを読み取れました。`
- Acceptance of **reopen/re-read gate: 2/2 PASS**. First one-click 6/6 report was submitted separately at 19:24 JST (see below).

## iPhone Safari user-reported initial safety acceptance (2026-10-10 19:24 JST)
- User submitted original lab output with the same iPhone Safari user-agent as the 19:22 reopen report.
- `PASS | Safari機能 | storage, locks, crypto, idb / 4`
- `PASS | 破損ポインタの読取専用保護`
- `PASS | 容量不足（安全な模擬）の保存停止`
- `PASS | Web Locksによる競合拒否`
- `PASS | localStorage実保存・再読込`
- `PASS | IndexedDB strict保存・再読込`
- `合格: r13の隔離検査が完了。Safari再起動後の検査は別途必要です。`
- **Initial 6/6 PASS**, previously reported **reopen 2/2 PASS**. Both required user-reported Safari gates passed; **85% milestone PASS** as of 19:24 JST, previous 80%, delta +5%. Next milestone is 90% UI.
- Scope caveat: corruption and quota were synthetic/in-memory; Web Locks + storage/IDB were genuine browser APIs. A process force-kill, real native quota exhaustion and all abnormal iPhone interruptions were not proven; do not claim absolute data durability. Chrome/Chromium CI remains separate from real Safari report.
- Prior r10/r12 user-reported PASS preserved; no repeat required. PC and Android completed baseline unchanged. No main merge, production cutover, legacy keys, existing preview namespace or original KMZ touched.
- **Next**: audit iPhone UI layout, button tap targets, file picker, browser history/scrolling, map controls and actionable save error messaging within isolated branch; record any later Android parity decisions in P-04 / P-05. Proceed to 90% only after UI acceptance, then regression95%, release decision100% after explicit PO approval.
