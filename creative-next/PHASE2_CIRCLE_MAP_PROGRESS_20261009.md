# Creative Next | 距離円連動・隔離地図UI 進捗

**2026-10-09 JST / 非公開開発中 / Phase 1-B・Phase 2 正式PASSではない**

対象：`Kaityo1221/Campsite-Design-Tool-JP` の専用ブランチ `feature/creative-next-kmz-phase1b-20261009` のみ。`main`、現行Creative Mode、旧保存キー、Bridge/Field Mode、DBには変更しない。

## 今回実装したもの

- `phase-1b/core/dependent-circles.mjs`：KML `distance-circle` をPOI内部IDと半径（30/40/50m）で厳密に対応付け。所有者不明、同一半径二重登録、未検証ポリゴンは拒否。位置移動時には48分割の球面円（閉環49点）を生成する。元の円・高度の情報を安全に解釈できなければ保留。
- `phase-1b/core/export-kmz.mjs`：移動した**新規POI**と所属距離円を同時に書き換える。POI削除時は所属円も一緒に出力から除外する。**既存POIの座標変更は禁止**。未変更の円の座標原文は触らず、書き出したKMZを再読み込みしてPOI・円・活動範囲の件数を検証する。
- `phase-1b/integration/isolated-editor-session.mjs`：円の有効件数・所有者・中心を、Undo／Redo・削除・移動に合わせて都度算出。保存では元KMZのバイト列と削除済みPOIの記録を保持する。
- `phase-2-preview/leaflet-map-view.mjs`：新フロー専用のkeyed Leaflet表示アダプター。POI、半径円、活動範囲を地図上へ描画し、POI内部IDで選択する。既存レイヤーを再生成せず位置・半径を更新し、削除対象は取り除く。
- `phase-2-preview/preview.mjs`・`index.html`・`preview.css`：新規POIのみ数値座標による移動を許可。距離円とPOIが連動して表示・削除・Undo復元できる。Leaflet 1.9.4の外部配信が利用できないときは**距離円を含む簡易位置図**へ切り替える。

## 今回の実施結果

| 試験 | 結果 |
|---|---|
| Phase 1-B + 隔離編集・地図アダプター単体テスト | **150/150 PASS** |
| Phase 1-A（専用Gitテスト環境で再検証） | **33/33 PASS** |
| 実際の葛西KMZ SHA256 `1c57f66d…5d162` | 原本一致、編集/書出/再取込PASS |
| 葛西 既存188・新規25・円213・活動範囲1 | 変換後も一致 |
| 葛西 新規POIを移動 | 対応する50m円も移動、件数213維持 |
| 葛西 既存POIを削除 | 既存187・新規25・円212、活動範囲1、再取込PASS |
| 葛西 Undo復元 | 既存188・新規25・円213に戻る |
| Chromium 390px 隔離画面操作 | 2シナリオPASS（KMZ/編集/移動/削除/Undo/Redo/保存/再開） |
| 旧保存 `next-lab-creative-v7` | 代替環境とテストで維持確認 |

**試験の条件：** Chromiumではネットワーク/通常URL起動が制限され、画面の一時保存領域と暗号計算のみテスト用の代替実装を使用。したがってLeaflet地図タイル・実ブラウザのオリジン保存・iPhone Safariの受入PASSではない。Leafletのkeyed更新は独立したNodeのテスト用スタブで検証した。ユーザーから受領した実葛西KMZはGitHub・成果ZIPに含めない。

## 次の工程・継続保留

1. Leafletの実ライブラリ・地図タイル・通常URL起動でのブラウザ試験、およびiPhone Safariの性能/保存/履歴を確認する（**iPhoneテスト開始には会長の明示確認が必要**）。
2. 旧形式KMZ由来のPOI種類変更（レイヤー/フォルダー/styleの同期移動）、新規POI追加（元KMLへの図形挿入）、活動範囲の編集はまだ未実装・保留。
3. 本番Creative Modeへの接続、同期・Undo/Redoの回帰、実ブラウザ保存障害・強制終了/ロールバック、Wayfarerからの通し試験を行う。
4. **mainへのマージ、PRによる公開、デプロイはしない。** 新フローの一般公開は別途最終承認が必要。
