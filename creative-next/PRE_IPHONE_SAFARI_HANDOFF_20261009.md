# Creative Next | iPhone Safari 実機試験直前の引き継ぎ

**状態：隔離開発のみ。旧Creative Modeは本番維持。ユーザー承認なしにiPhone実機試験・公開・mainへのマージをしない。**

## 対象
- GitHub: `Kaityo1221/Campsite-Design-Tool-JP`
- Branch: `feature/creative-next-kmz-phase1b-20261009`
- Isolated preview: `creative-next/phase-2-preview/index.html`
- 実機試験前に安全な非公開/限定アクセスのプレビュー導線を別途用意すること。公開GitHub Pages/mainには接続しない。現時点でiPhone用アクセスURLは存在すると断言しない。
- 旧 `next-lab-creative-v7` は読み取りも書き込みもしない。一般公開画面は変更しない。

## PCテストとエビデンス
- private葛西KMZ（SHA-256: `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162`）の6回帰試験PASS。既存188件、新規25件、距離円213件、活動範囲1件、KMZ添付3件を保持。原本はGitHubにアップロードしない。
- GitHub Actions `Creative Next isolated native browser gates`: Nodeテスト、実ChromiumのLeaflet/タイル、地図タップ、保存・復旧、IndexedDB strict、容量不足、タブ競合、SIGKILL後の復旧を検査する。
- `creative-next/qa/pc-final-regression.py`: GitHub Actionsで実Chromiumの画面総合回帰試験PASS。合成KMZを使いPC画面から編集、Undo、レイヤー、活動範囲、保存、KMZをダウンロード後に別コンテキストで再読込する。本物の葛西KMZをActionsには持ち込まない。実行 https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/37908738647
- ブラウザ依存の耐久性に絶対保証はない。IndexedDBの`strict`指定に対応しているかSafari実機で再確認する。

## ユーザー承認後に実施するiPhone Safariチェック項目（未実施）
1. 認証済みの限定プレビューでのみ起動し、現行Creative Modeが従来通り使えることを確認。
2. 葛西KMZの選択→安全性診断→内容プレビュー→明示的な反映。ファイル選択時点では既存編集中データを変更しない。
3. 地図表示、POI・距離円・活動範囲の3レイヤーON/OFF、地図タップ/頂点操作を確認。
4. 既存POIは移動不可、新規POIのみ追加・移動でき、距離円が追従することを確認。
5. 25件上限、種類変更、POI削除→Undo、活動範囲の頂点編集・新規作成・削除・Undo/Redoを確認。
6. 保存→Safariをリロード→復元、IndexedDBバックアップ確認、復旧選択のキャンセル時はデータ無変更を確認。
7. KMZ書出→再読込し、POI/距離円/活動範囲/名称/メモの一致を検査。
8. 容量不足・ストレージ使用不可・タブ競合では安全に停止し、データを無言で削除しない。
9. iPhone Safariレイアウト、操作のタッチ領域、戻る、スクロール、パフォーマンスを確認。

## 判定・終了条件
- **iPhone実機試験を始めるかどうかはユーザーが判定する。** PC試験PASSはiPhone試験開始の自動許可ではない。
- 不具合時はログの機密情報/元KMZを公開せず、隔離ブランチで修正・PC再試験。
- POの明示的な公開承認があるまで `main` にマージせず、本番旧モード維持。
