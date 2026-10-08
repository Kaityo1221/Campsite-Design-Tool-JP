# Creative Next | 新規POI追加・種類変更の安全接続

**2026-10-09 JST / 隔離ブランチのみ / Phase 1-B・Phase 2正式PASSではない**

Branch: `feature/creative-next-kmz-phase1b-20261009`  
Repo: `Kaityo1221/Campsite-Design-Tool-JP`  
Public `main` and existing Creative Mode, Bridge, DB, and old save key remain untouched.

## 実装内容

1. **KMZへ新規POIを追加**：Phase 1-Aの内部IDで、role=`new`だけを受け付ける。既存KMZの元POIを消したり重複統合しない。タイトル/メモ/種類/座標を反映し、同じIDを所有者とする半径50mの閉じた距離円をKMLに作成。新規25件・種類別12/8/5件の上限を維持。削除はtombstone保持、Undo/Redoで復元。
2. **旧形式POIの種類変更**：元の`nextlab-layer`、フォルダー、`#creative-*`アイコンを一括して変更。対象のフォルダーとスタイルを特定できなければ**編集操作前にSTOP**。既存POIの座標は常に移動禁止。
3. **保存と再開**：追加した新規POIの内部IDと元KMZを別の保存領域に保持。二世代ジャーナルで保存内容を読み直す。`next-lab-creative-v7`は触らない。
4. **隔離プレビュー画面**：［＋ 新規POIを追加］フォームを設置。総数25のときは無効、削除後に空き枠ができたら利用可能。種類別の空き数にも従う。危険な座標は追加前に保留。

## 検証

| 試験 | 結果 |
|---|---|
| Phase 1-B・編集統合 Node `test/*.test.mjs` | **160 PASS / 0 FAIL** |
| 実葛西KMZ SHA-256 | `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162` と一致 |
| 実葛西：新規25件で追加拒否→新規Gym1件削除→Gym1件追加 | PASS、既存188/新規25を保持 |
| 実葛西：追加POIの50m円と、旧POI種類のフォルダー・レイヤー・アイコン同期 | PASS、円213・活動範囲1 |
| 実葛西：Undo、二世代ジャーナルの保存・再開 | PASS、旧v7キー変更なし |
| 実葛西の原本の指紋再検査 | 一致、原本未変更 |
| Chromium 390px、フォーム操作、保存・再開・KMZ書き出し | PASS（`set_content`で操作、オリジン保存・暗号はモック） |
| Chromium/WebKit通常URLからの起動、実Leafletタイル、iPhone Safari | **未PASS** |

**注記：** 実葛西KMZおよび変換KMZ、保存内容は公開GitHubや成果ZIPに含めない。Chromiumのシミュレーションは通常URLの検証やSafari実機の代わりではない。特定のMy Maps互換性も未検証。旧形式全般を変換できる保証ではなく、実葛西と検証済みプロファイルに限定。

## 今後の保留

- 活動範囲ポリゴンの追加・頂点編集・削除に対する、元形状・IDの保持とUndo/Redo・KMZ一括更新。
- 正式Leaflet環境（タイル・画面起動、操作の同期）とスマートフォンでの地図UI操作。
- 編集・保存・Undo/Redo・ファイル一括反映の異常系、タブ競合、容量、強制終了復旧。
- Wayfarer→編集→KMZ→My Maps往復、PC Chromium/WebKit通常起動・iPhone Safari。
- 最終的な公開は会長の別途承認後。**mainへのマージ・デプロイは禁止**。
