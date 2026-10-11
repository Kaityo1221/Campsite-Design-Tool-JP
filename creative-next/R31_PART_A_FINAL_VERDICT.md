# r31 PART A 最終判定（2026-10-11）

**ローカルPART A PASS。リモートCIは今回のソースcommitで再測定する。**
進捗85% / Phase 1 HOLDを維持。PART B、保存有効化、KMZ実出力、隔離preview配信、main反映は未実施。iPhone Safari実機NOT_TESTED。

## 基点と承認

指定ソース05fb48953e335f2438996bac5b480e1b02cc196e、証跡HEAD37ba2595e4f0cb405e6723aea139b98e352a5997を確認し、cleanな独立worktreeをfast-forwardして再開。

承認例外R31-PLUS-2STEP-2026-10-11: 最初の通常tapは3種menuだけ、次の明示tapで選択preview。現行参照のPowerSpot誤自動選択を継承しない。仕様と操作差分はR31_PART_A_SPECIFICATION.md/R31_OPERATION_DIFFERENCES.mdに記録した。

## 修正差分

UI runtimeと元ソース、既存333回帰は指定ソースから未変更。QAと資料のみ変更した。

- 既存9 FAILをraw判定/classes/input trace付きbaseline JSONに保持。現在の参照診断も別JSONへ保存し、PASSには書き換えない。
- 独立候補contextのplus-acceptance.cjsを追加。第一tapでpreview/変更要求なし、第二tapで指定種preview、確定は一度だけHOLD、取消・view不変・解除を検査。
- 全グループの＋必須検査を独立受入証拠に接続。承認IDを限定し、参照診断の欠落や承認外差でHOLD。156場面を厳密に要求した。
- 既存17監査に欠落/未承認差/受入失敗/保存アクセス/解除漏れを拒否するassertionを追加。テスト数は17を維持。
- 専用CI artifactに独立受入・参照診断・旧FAIL baselineを追加。既存の画素、操作、安全検査は維持した。

## Windows Edge実測

fingerprint: f206ea51801e3a74e69cf7156a6fff803422ebe5af57a500fcb4d1a2ecae75ff

| 幅 | UI場面 | 必須操作 | 独立＋受入 | 参照既知FAIL |
| --- | --- | --- | --- | --- |
| 390 | 52/52 PASS | 32/32 PASS | 3/3 PASS | 3件保持 |
| 393 | 52/52 PASS | 32/32 PASS | 3/3 PASS | 3件保持 |
| 1366 | 52/52 PASS | 32/32 PASS | 3/3 PASS | 3件保持 |

156/156 UI場面PASS。未承認操作差0。回帰333/333 PASS、監査17/17 PASS、skip0。7グループすべて実測PASS。

候補旧関数実行0、旧runtime/engine request0、保存アクセス0、map生成1/幅、重複mount拒否。全57データ要求HOLD/changed:false（通常シナリオ48＋独立受入9）。既存POI閲覧専用、view不変。全幅dispose後map/DOM/listener/timer/raf/animation/observer0、独立EventTarget監視0。force click0。

過去のHOLD報告と前回証跡はその時点の判定として保持する。本報告と現在fingerprintの最終CIによってPART Aのみを再判定する。

## リモートCI・コミット

今回のソースcommitと最終CI結果はCI完了後に追記する。ローカルPASSをリモートPASSやiPhone実機PASSに流用しない。

PART Aが全ゲートPASSした時点で停止し、追加機能・次Phaseを実装しない。
