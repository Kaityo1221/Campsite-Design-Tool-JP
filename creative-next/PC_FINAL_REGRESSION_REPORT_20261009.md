# Creative Next | PC総合回帰試験 結果（iPhone Safariテスト開始前）

**2026-10-09 JST | 隔離ブランチのみ | 公開なし | iPhone実機テスト未開始**

## GitHub Actions 実Chromium
- 実行: https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/37908738647
- 検証コミット: `37c6fbe8574b934a534fea56d0b5dbfd22f0aeca`
- 結果: **ワークフロー全項目PASS、Node自動テスト249件PASS、0件FAIL**。
- `creative-next/qa/pc-final-regression.py` によるPCブラウザ操作:
  - 検査済み合成KMZは確定前に未反映。確定して初めてPOIを表示。
  - 実Leaflet・タイル取得、既存POI位置変更不可・メモ編集。
  - 新規POI追加、50m距離円生成、POI削除→距離円削除、Undo復元。
  - 活動範囲の新規作成/削除/Undo/Redo、POI・距離円・活動範囲の表示ON/OFF時も元データ保持。
  - 2世代保存 + strict IndexedDBチェックポイントの完了を検査。
  - 保存後リロード→復帰。KMZを実際にダウンロードし、**保存状態を共有しない別ブラウザコンテキスト**でKMZを再読み込みして同じ件数と形状分類を確認。
  - 幅1366pxで横はみ出しなし、画面のJavaScriptエラーなし。
- 既存の実Chromium試験: Leaflet地図タップ、2タブ競合、容量不足、明示的な復旧・復元キャンセル、strict IndexedDB保存直後のSIGKILL（0秒、0.1秒、1秒）→再起動の検査がPASS。
- CIにアップロードしたKMZは**人工的に生成した試験用データだけ**。葛西KMZ原本は含まれない。

## 葛西臨海公園の実KMZ 回帰試験
- 秘匿した原本SHA-256: `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162`。
- GitHub隔離ブランチと同じ6本の実データ検証スクリプトをローカルで実行し、すべて**PASS**。
- 確認: 既存188 / 新規25 / 距離円213 / 活動範囲1。名称・元座標・生の説明文・付属リソース3件の保持。
- POI編集・既存位置保護・種類変更・新規25件上限・距離円連動・活動範囲の頂点変更/丸ごと削除/再作成・Undo/Redo・2世代保存/再開・KMZ再出力が個別試験PASS。
- 原本のバイト列は変更していない。元のKMZをpublic GitHubへアップロードしていない。

## 最終ゲート
- **PC総合回帰試験: PASS（Chromium、隔離プレビュー、人工KMZ UI操作 + 秘匿原本の6件Node回帰）。**
- iPhone Safari実機上のブラウザ・IndexedDB durability・容量/性能・画面操作・実機KMZワークフロー: **未検証**。PC PASSはこれらのPASSを意味しない。
- 正式なPhase 1-B/Phase 2全体PASS・一般公開: **保留**。ユーザーの明示的な指示なしに開始しない。
- 新フローの限定プレビュー公開/本番切替は未実施。現在公開中の`main`と旧Creative Modeは保持する。
- iPhone試験開始には非公開の安全なプレビュー導線の用意とユーザー承認が必要。承認前には実機テストに進まない。
