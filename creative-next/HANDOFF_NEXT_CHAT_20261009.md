# キャンプサイトアプリ / Creative Next 引き継ぎ（2026-10-09）
**次チャット冒頭にそのまま貼り付けてください。**

## 目的・最新の到達点
新Creative Modeを旧Creative Modeから隔離して構築中。POの指示で**PC総合回帰試験まで完了し、iPhone Safari実機テスト開始直前で停止**した。現時点では実機テスト・本番公開・mainへのマージは許可されていない。

- Repo: `Kaityo1221/Campsite-Design-Tool-JP`
- Branch: `feature/creative-next-kmz-phase1b-20261009`
- 対象UI: `creative-next/phase-2-preview/index.html`
- **共通仕様書（最優先）: `creative-next/SPECIFICATION.md`**。過去のPhase READMEには古い未実装記述があるので必ずこれを読む。
- PC判定レポート: `creative-next/PC_FINAL_REGRESSION_REPORT_20261009.md`
- iPhone試験準備: `creative-next/PRE_IPHONE_SAFARI_HANDOFF_20261009.md`
- 最新PC GitHub Actions PASS: https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/37909258314
- **249 Node tests PASS / 0 FAIL**。GitHub Actionsの実ChromiumではLeaflet・地図タップ・POI/距離円/活動範囲・Undo/Redo・保存/復旧・タブ競合・容量不足・IndexedDB strict耐久テストとPC編集→KMZ出力→別環境再読込がPASS。
- 私有の葛西原本KMZを使う**6種類の非公開回帰試験PASS**（既存188/新規25/距離円213/活動範囲1/ZIP資産3件保護）。この実ファイルはGitHub・CI・公開ZIPへ絶対にアップロードしない。CIのブラウザ試験は合成KMZを利用。
- 保存: `localStorage` 2世代＋版番号＋Web Locks＋SHA-256、`IndexedDB strict`チェックポイント。保存ボタンはIDBの完了も検査。バックアップのみ残る場合は**利用者確認後に**元KMZ等を再検証して復旧。Chromium強制終了0/0.1/1秒のstrict IDB試験はPASS。ただしSafariやあらゆる突然終了に対する絶対保証なし。
- 編集ルール: 既存POIは位置不変。新規POIは25件上限（種類別12/8/5）、50m所有円連動。活動範囲の頂点/新規/丸ごと削除/Undo/Redo。KML/KMZ原構造、説明、元座標・未知属性、添付資産は監査不能ならHOLD/REJECT。
- 旧キー`next-lab-creative-v7`、旧Creative Mode、公開中の`main`、Bridge/Field/DBは変更しない。Phase 1-A原本も勝手に変更しない。
- 新CI設定は隔離ブランチの`.github/workflows/creative-next-native-browser.yml`のみ。現行Creative Modeに入口を追加していない。

## 今どこで止めたか
**「iPhone Safari実機テスト前」**。PCと葛西KMZの回帰はPASSだが、実iPhone、Safari IndexedDB耐久性、スマホタッチ操作、戻る/進む、実機での葛西KMZ往復、実機容量・性能は未試験。新フローの限定プレビュー用URLもまだ用意していない。Phase 1-B/Phase 2全体の正式PASSは保留。

## 次に着手するとき
1. 共通仕様書と最新CI・実コードを再確認し、既存の249件/6本の試験実績と新しい差分の有無を把握する。
2. **iPhone試験の開始前には**旧画面に影響しない安全な限定プレビュー案（アクセス制御、URL、KMZ秘匿、テスト手順、戻し方）を提示する。現在URLがあると決めつけない。
3. **POの明示的な「iPhoneテスト開始」承認が出るまで試験は実施しない。** 承認後は`PRE_IPHONE_SAFARI_HANDOFF_20261009.md`の手順で実機テストし、異常時はSTOPして隔離修正/PC再試験。
4. iPhoneでPASSしても**mainマージ・旧画面切替・一般公開は別の明示承認**が必要。勝手に進めない。

## 開発の役割分担・禁止事項
POが方向性/最終判定。ChatGPTは仕様・レビュー・検証ゲート監督、Codexが確定指示に沿って実装、原因不明の多層問題ではClaudeを調査担当として使う方針。原則、旧システムや公開側を触らない。新テスト・証拠・コードは隔離ブランチだけ。原本KMZ・認証情報を公開しない。実機承認以前は「実機PASS」「正式リリース準備完了」と言わない。

**次チャットでは、まず上記状態の引き継ぎ確認から始め、ユーザーの次の指示を待つ。**
