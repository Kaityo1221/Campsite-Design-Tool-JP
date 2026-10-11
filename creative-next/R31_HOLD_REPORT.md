# Campsite Creative Next r31 — PART A HOLD / STOP報告

2026年10月11日。進捗 **85% / Phase 1 HOLD** を維持。

**r31のUI継承・エンジン接続・隔離プレビューは未完成。配信していない。**
今回完了したのは基準確認、通常モードの正確なソース組立、ソース/依存台帳、既存r30とのブラウザ診断、回帰確認、配信を伴わない監査CIの追加である。

依頼書の「安全に分離できない旧処理が見つかった場合は、推測で実装せずSTOP」「PART Aのゲートが失敗した場合、PART Bの統合を強行しない」「テスト失敗を無視した配信は禁止」に従い、PART Bと配信に進まなかった。混在を検出した関数を一括実行する方法も、script削除後の欠落を個別模写で補う方法も採用していない。

## 1. 現行UIの継承元一覧

- creative/index.html — PATCH_FILESと通常/Bridge条件分岐の正本
- creative/runtime/runtime-vnext.html — baseに適用される本番文字列変換
- creative/base-v7.html — 静的HTML/CSS、動的UIと旧エンジンの同居
- PATCH_FILES掲載のcreative/runtime/creative-patches-*.js 65本
- creative/jp-creative-patch.js — 通常モードにも必要な最終変換
- assets/creative-mode-opening-final.webp、assets/creative-mode-start-transition.webp、creative/assets/
- 旧map-engine外部script依存11本のうちJSZip/Leafletを除く9本も台帳へ記録

[要素別台帳・65本の順序・369関数定義](R31_UI_SOURCE_LEDGER.md) と [機械台帳](qa/r31/source-inventory.json) を参照。調査資料であり、抽出した全UIが移植済みという判定ではない。

## 2. 実際に利用したパッチ数と適用順

**65本、creative/index.htmlのPATCH_FILESそのまま。** runtime-vnextの文字列変換後に全パッチを適用し、通常JP変換を追加した。履歴manifestで置換せず、未掲載v72を追加していない。Bridge専用registrarは読み込み・実行していない。

ソース組立では本番のdocument.write先をメモリ内の受取口に置き換え、生成HTMLを解析する。生成HTML内の旧アプリscriptは実行しない。比較用参照アプリの実行は後述の合成データ/完全隔離環境だけに限る。

## 3. UIと旧エンジンの分離方法・現状

**ソースの組立と副作用検出まで実装。実行可能なUI専用ランタイムへの分離は未完了。**

Acorn ASTで369件の関数宣言/関数代入を抽出し、変換段階ごとの本文SHA-256から継承元を追跡。UI生成、保存、旧データ書込、履歴、旧KMZ、旧Leaflet、listener/timerを分類した。混在候補は46件。

特に手動確認済みの問題：

| 関数/経路 | 元の副作用 | r31でそのまま実行できない理由 |
| --- | --- | --- |
| cmInstallUi → cmInstallEntryHistory → cmMigrateLegacyStore | 旧キーのgetItem/setItemと移行 | 前回データ案内を残すだけでも旧保存に接続する |
| cmOpenRecord / cmCloseSheet | r.title/memo/layer/deletedへの直接変更、snapshot、cmPersistCurrent | 旧recordsの編集と旧履歴/保存がシートイベント内にある |
| cmSafeInstallAddBar / cmBeginMove | 旧POI追加/位置確定、描画、履歴、保存 | プレビューと確定境界をNext adapterへ置換する必要がある |
| cmOpenSaveMenu / cmInstallStandaloneSave | 旧exportKmz・snapshot・cmPersistCurrent | UIを継承しても旧出力と保存を起動できない |
| setHand | 旧HANDキーの読込・書込 | 表示設定も旧保存領域から分離する必要がある |
| map-engine登録/委譲イベント | 旧recordsとrenderer、capture pointerup/click、observer/timer | 二重描画・二重送信・後始末の監査が必要 |

解析は保守的であり、名前ベースの呼出し伝播は完全な字句スコープ/alias解析ではない。46件すべてを実害と断定せず、分離レビュー候補として扱う。UNPROVENも実行許可を意味しない。上記の具体的な混在は元ソースで確認した。

## 4. 動的UI生成機能の一覧

台帳に、＋と3種類選択、POI編集シート、移動UI、追加位置/crosshair/半径レバー、距離円/参考円、活動範囲、ツール/物差し、ヘルプ、ルールカルーセル、保存メニュー、前回データ案内、起動演出/遷移、追加アニメーション、左右利き、レイヤー、Undo/Redo、Safariジェスチャー、JP追加処理を記録。

**r31でこれらが動作するとは判定していない。** script削除で動的DOM/CSSが失われることを検出する監査テストを追加した。

## 5. Creative Nextへの接続機能一覧

**r31として接続済みの機能はない。** PART A未PASSのためPART Bへ進んでいない。既存phase-1a/phase-1bエンジン、Session、Follower、Overlay、Command Boundary等を参照・回帰検証しただけで、複製エンジンや新規POI/履歴ストアを追加していない。

## 6. 未接続機能一覧

r31 UI Command Adapterのadd/edit/move/change-kind/delete/undo/redo/commandArea/prepare/acceptPrepared/exportKmzすべて未接続。単一Leafletへの投影、各表示切替、保存安全停止のUI接続、明示復元、iPhoneイベント解除も未接続。

既存POIの名前/メモ/位置/種類/削除はadapter境界で全面拒否する必要がある。既存エンジンは一部編集を許すため、そのままUI接続するだけではr31要件を満たさない。

## 7. 変更・追加ファイル一覧

追加のみ：

- creative-next/R31_UI_SOURCE_LEDGER.md
- creative-next/R31_HOLD_REPORT.md
- creative-next/qa/r31/.gitignore
- creative-next/qa/r31/production-source.cjs
- creative-next/qa/r31/source-audit.cjs
- creative-next/qa/r31/source-audit.test.cjs
- creative-next/qa/r31/source-freeze.cjs
- creative-next/qa/r31/source-inventory.json
- creative-next/qa/r31/browser-diagnostic.cjs
- creative-next/qa/r31/browser-diagnostic.json
- creative-next/qa/r31/write-ledger.cjs
- .github/workflows/creative-next-r31-audit.yml

合成データのみのスクリーンショット12枚はqa/r31/artifacts/にローカル保管、Git対象外。依存ライブラリと実行ログもGit対象外。生成器は旧r16〜r30へのwriteをメモリ内で受け取るため、旧成果物を書き換えていない。

## 8. コミットSHAと差分境界

基準ブランチ: feature/creative-next-ui-exact-parity-20261010
基準コミット/取得したHEAD: **2d9f0c472a0263fd4b68044b76bb2a80bb265289**
基準からの追加リモート差分: **0**
作業ブランチ: codex/original-ui-r31
隔離worktree: Codexのoriginal-ui-r31/Campsite-Design-Tool-JP

監査成果は独立したローカルコミットにする。実際のSHAは作業終了メッセージとgit log -1で確認できる。
これはPART A完了コミットではない。PART Bコミットは作成しない。開発mainと隔離プレビューrepositoryに変更を反映していない。

## 9. CI結果・Node結果

**リモートCI: 未実行。新規workflowはローカル追加のみ。配信ジョブ・公開権限なし。**

| 検査 | ローカル結果 |
| --- | --- |
| r31監査単体テスト | 5 PASS / 0 FAIL |
| 正式ビジュアルソース14件 | PASS（Git配信LFに正規化、画像はバイト比較） |
| Phase 1-A POI core + Phase 1-B + 既存qa回帰 | 333件: 329 PASS / 4 FAIL |
| 保守的な分離監査 | HOLD: 369定義、46混在候補 |

既存4件のFAIL（本変更前の基準コミットで発生）：

1. creative-next-original-leaflet-overlay.test.mjs — fake mapにhasLayerがなくTypeError
2. original-file-review.test.mjs — fake controlにclassListがなくTypeError
3. original-ui-buttons-fixture.test.mjs — 期待1/実際0のassertion
4. real-engine-original-ui.test.mjs — import直後のUndo enabled期待と実際のdisabled状態が不一致

これらをエンジン全面不良と断定しないが、テストPASSとも扱わない。旧プレビューを保護するため既存fixture/期待値は変更していない。Phase 1-Aの歴史的isolation.testは「全untracked追加がphase-1aのみ」を前提とする初期工程専用なので、このr31回帰集合には含めていない。

Windowsのcore.autocrlf=trueにより旧ゲートをそのまま読むとtext blob差分になる。Git ls-treeとLF正規化で正本一致を確認し、新規source-freezeで旧ゲート本体をメモリ内の正規化FSに対して実行した。本番ファイルと旧ゲートを編集していない。

再現（隔離checkout内）：

~~~powershell
npm install --prefix creative-next --no-save --no-package-lock --ignore-scripts jszip@3.10.1 @xmldom/xmldom@0.9.8 acorn@8.15.0 playwright@1.56.0
node --test creative-next/qa/r31/source-audit.test.cjs
node creative-next/qa/r31/source-freeze.cjs
node creative-next/qa/r31/source-audit.cjs
node creative-next/qa/r31/write-ledger.cjs
$env:R31_BROWSER_CHANNEL='msedge' # ローカルEdge。CIはPlaywright Chromium
node creative-next/qa/r31/browser-diagnostic.cjs
~~~

source-auditはHOLD時に非0、browser-diagnosticも差分時に非0で停止する。エラーを成功扱いしない。

## 10. 自動UI比較結果

**r31対現行UIの完成形ゲート: 未実行（分離済みr31ランタイムが存在しない）。PART A未PASS。**

実施したのは **正式ソースを実行した参照UI 対 改変していない既存r30** の診断。3画面幅すべてFAIL：

| 画面幅 | DOM/計算済みCSS差分数 | 参照＋展開 | r30通常クリック | pageerror |
| --- | --- | --- | --- | --- |
| 390×844 | 30 | 成功 | タップ遮断・timeout | 両方0 |
| 393×852 | 30 | 成功 | タップ遮断・timeout | 両方0 |
| 1366×768 | 30 | 成功 | タップ遮断・timeout | 両方0 |

起動と合成KMZ承認後のmap状態で、要素数、位置/サイズ、display、font、z-index、background、border、touch-actionを比較。r30には#cmStyle、#cmV58StartTransition、#cmV59HelpButton、#cmV60RulesPanel、#cmRecentがない。＋DOMが存在するだけでは位置/スタイル/タップ可能性のPASSにならない。

通常クリックの失敗をforceクリックで回避しなかった。
ピクセル差分、アニメーション全経路、全20操作、Safari double-tap受入は未実施。
タイルを固定画像に置換、外部リクエストは全遮断しているため、本番全画像/タイルの見え方まで一致したとは主張しない。

証跡: [browser-diagnostic.json](qa/r31/browser-diagnostic.json)。比較用r30のHTML生成は旧生成器の出力をメモリに捕捉し、旧パスには書き込まない。

## 11. データ保護確認

- 本番UI、承認済み画像、Wayfarer、Bridge、Field Mode、DBは変更なし。
- 旧保存領域の実ストレージに対する読込/書込/削除/移行は行っていない。
- 参照アプリは新規browser context、認証未使用、合成NEW_V1 KMZ、完全なin-memory local/sessionStorageで動かした。旧キー名の参照はそのメモリmockにだけ記録され、実保存には到達しない。
- r30候補のstorage accessは3幅とも0。参照側メモリmockの呼出しは13/16/16回。
- すべてのネットワークリクエストをrouteし、検証対象ローカルソース/画像/固定タイルだけをfulfill、それ以外はabort。ネットワークpassthroughなし。service workerはblock。
- geolocationは拒否mock。ユーザーの認証・現在地・保存データに触れない。
- 実KMZ原本/変換出力を読み込み、編集、アップロードしていない。
- LEGACY_CIRCLE_AMBIGUOUS等の安全検査と保存コードを変更していない。
- r31保護保存は未接続。成功表示を作っていない。旧保存キーにも接続していない。

## 12. 隔離r31プレビューURL

**なし（未作成・未配信）。** PART A未PASSおよび既存回帰FAILのためoriginal-ui-r31へ配信していない。
隔離preview repository、r16〜r30のURL/成果物/配信設定は変更していない。

## 13. iPhone Safari実機テスト項目

**r31すべて未検証。実機試験に進める状態ではない。** 分離/CI/UI比較PASS後に以下を会長が確認する：

- 起動画像/タイトル/演出、前回案内、ファイル選択と明示承認
- ＋の左右位置・サイズ・展開、3種類選択、新規追加・位置プレビュー・確定/取消
- 編集シート、名前30/メモ50文字、種類変更、移動、削除、Undo/Redo
- 既存POIは選択・詳細閲覧のみで、全編集はUI/adapterで拒否
- 単一地図、距離円/参考円/活動範囲、非表示レイヤー
- 保存の安全停止、KMZ書出/再読込、HOLD/REJECT維持
- ツール、ルール、ヘルプ、左右利き、double-tap異常拡大、pinch、後始末

Edge/Chromiumの自動診断をiPhone Safari実機PASSとして記録しない。

## 14. 未解決事項とHOLD理由

- **R31-A-01:** 動的UIと旧保存/編集/履歴/rendererが混在。UI専用compiler/adapter置換の安全証明と実装が未完了。
- **R31-A-02:** script除去型の既存r30は完成UIと一致しない。3幅各30差分、動的CSS/演出/ヘルプ/ルール欠落、＋操作不能。
- **R31-C-01:** 基準コミットの既存統合回帰4件FAIL。旧fixtureと要求動作の整合をレビューする必要がある。
- **R31-B-01:** PART A未PASSなのでCommand Adapterと全操作統合は開始していない。
- **R31-S-01:** r31保存名前空間/2世代/SHA-256/Web Locks/revision/strict IDB/読返し/破損読取専用/復元承認は未検証。
- **R31-C-02:** r31完成形のpixel比較、全20操作、リモートCI、Safari実機は未実施。
- **R31-P-01:** 隔離プレビュー未作成。mainマージ・本番公開・進捗90%昇格は行わない。

このSTOPはPO承認の追加要求ではなく、今回の明示的な停止条件に従うもの。安全に分離できたこととUI完全一致が実証されるまで、下流統合/配信を進めない。
