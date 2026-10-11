# r31 PART B2 — 地図・活動範囲接続

基準は `codex/original-ui-r31` の `e8436035bf89ee653747c6afbed08e2f43099e9e`。B2専用ブランチ `codex/original-ui-r31-b2`。PART A/B1のソース・証跡・共通エンジンは凍結し、変更しない。

`connectB2({session,ui,document,confirmEdit})` は明示注入された既存 Isolated Editor Session 1つを使用する。Store、timeline、Command Boundary、Read Follower、Leafletを新設しない。B1のAdapterと表示controllerから生成したB2接続コードだけを追加する。HTML/CSS/テンプレート/画像は同じものを参照する。単独ページは未接続HOLD。Sessionの作成・ファイル読込・保存・公開入口を製品UIへ追加しない。

## 活動範囲

- 頂点入力、閉じるpreview、描画中のUndo/RedoはUI draftのみ。Sessionデータ・履歴を変更しない。
- 「活動範囲を作成！」で既存 `commandArea(area-create)` を1回実行。新規IDをAdapterで発行し、元ID・POI所有権・未検証metadataの主張を拒否する。
- 削除対象の選択と「戻る」は無変更。「活動範囲を削除」で既存 `area-remove` を1回実行する。
- **描き直しは現行UIの正式ソースv74の操作を継承する。** 「描き直す」の明示タップが旧活動範囲の削除を確定し履歴1件、新しい図形の確定が作成の履歴1件。新しい図形の取消は追加変更なし。先に確定した削除を取消で自動復元しない。元の活動範囲は描画を取消してからUndoで復元できる。この2件をまとめる別timelineや新エンジンは作らない。
- 不正座標、頂点重複、交差、退化、日付変更線、過多頂点、特殊な元構造は既存エンジンの検査でHOLD。距離円/POI/不明IDを活動範囲として削除しない。
- 確定済み操作はB1 POIと同じtimelineのUndo/Redoへ入る。確定1件につきFollower refresh1回。描画失敗は `APPLIED_RENDER_HOLD` / `changed:true` とし、以後の変更を拒否。成功表示・自動Undo・自動再送なし。

## 地図・表示

単一Leaflet上でdraftの頂点/境界/塗り、確定済み境界、削除候補を描く。正式ソースの50/40/30m円のスタイルをそのまま使用する。Sessionの検証済み距離円から初期半径集合を読み取り、表示参考円を表示対象POIの現在位置へ描く。参考円は元の円データを追加・補正・保存する操作ではない。POI移動・削除・Undo/Redoへ追従する。円・POIレイヤー・活動範囲の表示切替はUI状態のみであり、POI編集後も明示した表示設定を保つ。

既存POIは全面編集拒否。B1追加/移動へ切り替えると範囲draftを破棄。範囲描画開始はPOI配置previewを取り消し、sheetを閉じる。モバイルでは現行UIのFABと範囲の「点を打つ」ボタンが重なる位置があるため、混在操作検査は既存のFABドラッグで移動して操作する。レイアウト原本は変更しない。

## 検証

    node creative-next/qa/r31-b2/run.cjs

合成NEW_V1、storage:null、locks:null、独立browser context、memory storage、通信遮断、force click0。B2単体8件、B1単体のB2接続先への同一検査6件、B2地図/範囲とB1実編集の各3画面幅。元のB1全検査を再実行し、B2未接続表示へも元のPART A 156比較/333回帰/17監査/9独立＋検査を実行する。B1互換検査はソースを生成し、importと出力先だけを変更する。元の凍結証跡はbyte単位で復元し、新しい結果はB2ディレクトリだけへ保存する。

`build.cjs` は凍結A/B1と全共通モジュールを検証してB2を再生成する。CIはB2ブランチ限定、deploy jobなし。B3/KMZ、B4/保存・復元、main反映、公開へ進まない。進捗85% / Phase 1 HOLD。Safari実機、IME、実ネットワーク画像、既知FABアニメーション依存は別途検証。
