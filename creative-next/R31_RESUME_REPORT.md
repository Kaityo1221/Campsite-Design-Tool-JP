# Creative Next r31 再開報告（2026-10-11）

**85% / Phase 1 HOLD。PART A HOLD、PART B未実施、配信なし。**

## 1. 監査成果の保全

作業は独立worktreeのcodex/original-ui-r31で実施。前回監査コミット b312c83907a6c696f595e694ff6854f4a9b3f2ba を最初に同名の新しいremote branchへpushした。監査成果だけの独立remote branch codex/original-ui-r31-audit も同SHAで作成し、再開実装はcodex/original-ui-r31へ分離する。既存開発branch、main、旧プレビューへ反映していない。

R31_HOLD_REPORT.md、R31_UI_SOURCE_LEDGER.md、source-inventory.json、browser-diagnostic.json、前回監査コードは保持。過去のignored画像12枚・依存・regression.logも削除していない。今回は別名の報告/比較結果を追加した。

回帰修復コミット: 77a32fe7ad307626c95d515505709ea497c7c876。
UI分離・CIコミット: 436ee51c578b7f9cf6b433eaabc4aff5cdadc0f4。報告追記のみの後続commitではCI再実行を省略し、検証対象ソースをこのSHAで固定する。

## 2. 既存回帰4件

| 対象 | 原因・修正 | 再テスト |
| --- | --- | --- |
| creative-next-original-leaflet-overlay | mock mapのhasLayer不足。Setを参照するinterfaceを追加 | PASS |
| original-file-review | classList/cloneの不足と非同期changeの待ち不足。classListを追加し実readyを待つ | PASS |
| original-ui-buttons-fixture | mock履歴なし。Undo/Redo後の実状態0/1、1/0を返す | PASS |
| real-engine-original-ui | import直後Undo有効という誤期待。履歴0/0→実編集後Undo→Undo後Redoを検査 | PASS |

修正前4 FAIL、修正後4 PASS。Phase 1-A POI core、Phase 1-B、既存qa計333件PASS/0 FAIL。アプリ/旧・新エンジンの安全制御は変更していない。差分は独立コミットとR31_REGRESSION_REPAIR.md、ローカルログに保持。

## 3. 46件の機能グループ分類

| 機能 | 混在46件の内訳 | 全369定義の割当 |
| --- | --- | --- |
| 起動・表示設定 | 6 | 137 |
| POI追加 | 8 | 54 |
| POI編集・移動 | 6 | 53 |
| 活動範囲・地図 | 8 | 55 |
| 保存・KMZ | 6 | 41 |
| 一覧・座標・補助 | 8 | 17 |
| アニメーション・操作 | 4 | 12 |

R31_FUNCTIONAL_GROUPS.mdに46件のUI/状態参照/イベント/データ変更/保存/timer依存を記録。functional-groups.jsonに369定義の経路・曖昧呼出し・履歴/KMZ依存を記録。147副作用あり/176未証明の分類は保持した。名前ベースの保守的グラフは安全証明ではなく、scope/間接呼出しを完全解決していない。

## 4. UI専用処理の分離

正式組立器で65本の正式順序と通常JP変換を再利用。静的HTML/CSS/承認済み画像を継承し、動的CSS2個と20表示式/DOM記述子を独立抽出した。適用順、由来関数、式SHA-256、入力、検査方針はui-extraction-manifest.jsonに記録。

原ソース由来index.html/source-templates.mjsと新規接続ui-runtime.mjsを区別。候補r31には旧IIFE/handlers/store/renderer scriptを出力せず、元関数を呼ばない。新コードはviewコピーだけを読み、表示/プレビューを管理。候補側の通常操作でadd/edit/delete/move/export要求はHOLD/changed:false、合成view不変。単一Leaflet/重複mount拒否/後始末を検査。

活動範囲/地図全機能、全chooser、一覧/座標カード、演出全経路は未完了。部分抽出を一式継承PASSとは扱わない。

## 5. 未証明関数

残数176。候補r31で実行許可0。147副作用あり・46混在も元関数として全件deny。抽出した純表示式20個の個別検査によって、元関数の安全性を証明したとは扱わない。参照UI実行は指示書A-4に従う完全隔離・合成データの比較側だけ。

## 6. 自動UI比較

390×844、393×852、1366×768で12場面ずつ比較した。新規context、synthetic NEW_V1、memory storage、固定タイル、外部通信遮断を使用。force click 0。候補側pageerror/保存アクセス/旧runtime request 0、既存POI編集要素0、dispose後owned DOM/map 0。

全幅で起動画面、左右利き表示、map主要controls、＋展開、PokéStop/Power選択プレビュー、既存sheetの対象DOM/CSS/画像領域が一致。3種のPOI選択・開閉は通常clickで実行できた。Gymバーは全幅画像差が残る。ルールは全幅画像差、保存menuは390px微差、新規sheetは390/1366px微差、移動距離は393/1366pxで0.1m差を検出。比較閾値を緩和してPASSにしていない。

左右利きは現行v58がボタンを非表示にするため表示API、sheet準備も表示APIを使用。marker通常タップ全経路、animation全時間、距離円/活動範囲全canvas、Safari実機は未PASS。

上記はWindows Edgeローカルの結果。Linux Chromium CIは36場面中30 PASS/6 FAIL: ルール3幅、移動393/1366、新規sheet1366。CIではGym追加バーと保存menuが一致したが、ローカル差分は未解消として保持する。詳細はqa/r31/ui-runtime-comparison.jsonおよびui-runtime-comparison-ci.json。前回browser-diagnostic.jsonは上書きしていない。

## 7. PART A判定

**HOLD**。上記差分と未抽出/未検証グループのため完全一致・全要素継承ゲートを満たさない。part-a-status.cjsはHOLDを非0終了で記録。85% / Phase 1 HOLDを維持。

## 8. PART B範囲

**未実施**。Next Session、単一編集履歴、実編集command、KMZ prepare/accept/export、保存・復元へ接続しない。UI request境界は観測とHOLD応答だけ。配信URLなし。main/本番/旧プレビュー/Bridge/Field Mode/Wayfarerを変更しない。

## 9. リモートCI

旧監査commitのrun38135119893は回帰4 FAILとHOLDでFAIL。今回専用workflowを修復し、回帰jobとPART A比較/HOLD jobを分離。Leaflet/pngjsをCI依存へ追加。deployment jobはない。

最新run [38138730367](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38138730367)、ソースSHA 436ee51c578b7f9cf6b433eaabc4aff5cdadc0f4。regression job SUCCESS（333+9 PASS/0 FAIL）、part-a job FAILURE（UI比較HOLD exit2、全体HOLD gate exit2）。artifact r31-resume-hold-evidence を保存した。qa/r31/remote-ci-result.jsonにも記録。全CIはFAILでありPASSとは扱わない。

別途、変更禁止の旧preview-poi-controls-layout-once.yml/v2-once.ymlにも既存のjobなしFAILがある（run38138729478/38138728867）。今回変更していない。main/旧プレビューの修正に範囲を拡張しない。

## 10. 残る実装課題

1. Gym/ルール/保存/sheet画像差、移動0.1m差の根因を解消する。
2. 活動範囲・ruler/地図背景・距離円レイヤー、一覧/座標カード、全保存chooserのUI/state/eventを分離する。
3. startup履歴/演出、FAB drag、lever、sheet swipe、marker通常タップ、左右利き各状態の全比較を追加する。
4. 未証明176件と副作用147件のscope/間接経路を個別に証明する。証明できない元関数はdenyを維持する。
5. PART AがPASSした後だけ機能グループごとにPART Bを接続し、保存/復元を独立ゲートにする。Safari実機の＋/3種選択/編集sheet/移動十字・円/ヘルプ/左右利き/異常拡大を別判定する。
