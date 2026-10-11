# Creative Next r31 PART B2 検証報告

2026年10月12日。B2専用ブランチ `codex/original-ui-r31-b2`。判定はCI確定後に記録する。

## 基準と変更範囲

- GitHub `codex/original-ui-r31` HEAD確認：`e8436035bf89ee653747c6afbed08e2f43099e9e`。
- 基準B1 CI：38175029950 attempt 2 SUCCESS、検証ソース `937e00cf15d97528cfbb7e6966b9b602b3c10daa`。PART A再検証38175029888もSUCCESS。
- 開始時の既存作業場所に未コミット変更なし。別worktreeで専用ブランチを作成。
- 開始時main：`f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`。
- 変更は `creative-next/original-ui-r31-b2/`、`creative-next/qa/r31-b2/`、本報告、`.github/workflows/creative-next-r31-b2.yml` の追加のみ。PART A/B1原本・証跡、共通Session/core/integration、main、旧UI、Bridge、Field、Wayfarer、保存、KMZ、旧previewは変更しない。
- 一時検討した共通エンジン拡張は凍結検査で取り下げ、基準のまま復元した。新エンジンや履歴の複製はない。

## 所有権と実装

既存 `createIsolatedEditorSession` で検証・明示確定済みのSessionを1つ注入する。Session内Storeとtimelineが確定済みPOI/活動範囲を所有する。既存Command Boundaryだけが変更し、Read Followerが投影する。UIのLeafletは1つ。UIには位置preview、頂点draft、表示設定だけを持たせる。

B1接続から生成したB2 Adapterに活動範囲の `area-create` / `area-remove` を追加接続。B1の既存POI全面拒否、request ID重複拒否、外部Session変更HOLD、確定1件＝履歴1件＝refresh1回、描画失敗HOLDを維持。新規area IDは元IDと発行済みIDを予約し、削除後も再利用しない。

HTML/CSS/画像/templateは同一。既存の頂点/境界/塗り、50/40/30m表示円、POIレイヤー、活動範囲表示、削除候補表示を同じLeafletへ描く。表示設定は編集後も保持し、参考円は表示POIの現在位置へ追従する。参考円操作で元の円データや所有関係を補正しない。

## 作成・取消・描き直し・履歴

- 作成開始・頂点入力・閉じるpreview：Session変更なし。
- 描画中Undo/Redo：UI draftだけ。確定済みtimeline変更なし。
- 新規範囲の取消：変更なし。確定：area-create1件。
- 削除候補選択/戻る：変更なし。明示削除：area-remove1件。
- **描き直すの明示タップは、現行正式ソースv74同様に先に旧範囲を削除する。** 削除1件→新規描画→確定作成1件の計2履歴。新しいdraftの取消は追加変更をしない。先に確定した削除は自動Undoせず、描画を取消した後のUndoで元範囲を復元する。原本UIにない一括置換コマンドは追加しない。
- POIと範囲の混在Undo/Redo、Redo打切りを同じSession timelineで検証。
- 範囲描画からPOI配置への切替で範囲draftを破棄。逆方向は位置previewを取消。

## 検証体系

`node creative-next/qa/r31-b2/run.cjs`。固定依存、合成NEW_V1だけ、独立context、storage:null、locks:null、memory storage、通信遮断、force click0。

1. 凍結B1の元run.cjsを全再実行。B1単体6件、実編集3画面幅、PART A全検査。元JSONはbyte単位で復元し、B2側へ別保存。
2. B1単体とbrowser検査のimport/出力先だけをB2へ切替えて、同一検査を再実行。
3. B2単体8件：範囲作成/削除/履歴、描き直し、図形拒否、POI混在、重複/再入、描画失敗、所有/未承認API、投影分離。
4. B2 browser：390×844、393×852、1366×768。実頂点/境界DOM、確定/取消、範囲履歴、円/レイヤー、B1編集/移動、削除/戻る、描き直し/取消/復元、操作干渉、重複、描画失敗、後始末。
5. B2派生UI未接続表示にも、元PART Aの156比較/96操作/9独立＋/333回帰/17監査/7機能群を再実行。基準のHOLD条件を変更しない。
6. 実行前後の凍結指紋とB2検証ソースの安定性を検査。旧関数実行、旧保存アクセス、地図/Session数、後始末を計測。

全結果とSHA/CI URLは `qa/r31-b2/final-ci-evidence.json` に記録する。詳細JSON/ログは専用CI artifactへ保存する。

## 残課題と停止範囲

iPhone Safari実機、IME/モバイル確認dialog、実ネットワークでの起動画像、既知FABアニメーションのタイミング依存は未解決。モバイルの既存FABと範囲actionの位置重なりは、既存FABドラッグで範囲描画前に移動して操作する検査とし、原本レイアウトを変更しない。

旧preview用2ワークフローの既存FAILは別範囲。B2の検証がPASSしてもCreative Next全体の完成判定ではない。進捗85% / Phase 1 HOLDを維持し、B3/KMZ、B4/保存・復元、実データ入口、配信、main反映へ進まない。
