# Creative Next 地図UI接続境界 U1 監査結果
2026-10-10 / 開発隔離 / 仕様確定前はランタイム結合しない

## 検証済みの2つの実装資産
- 既存の正式Creative Mode UI: `creative/index.html` が `creative/runtime/runtime-vnext.html` を起動し、v2〜v77パッチとBridge/Wayfarer関連パッチを適用する。地図、下部ドック、＋、道具箱、ヘルプなどの表示/イベントを既存UIが所有。
- 隔離内部コア: `creative-next/phase-1b/integration/isolated-editor-session.mjs` が保護付き入力候補、編集記録、Undo/Redo、活動範囲、出力、二世代ジャーナルを所有。ブラウザr14では `phase-2-preview/preview.mjs` がUI接続し、別途 `strict-idb-checkpoint.mjs` まで成功して初めて「保護付き保存完了」と案内する。
- `creative-next/phase-2-preview/workspace-namespace.mjs` はr9〜r14 URLごとの保存空間を分離する。新UIのパスで既存r14や旧本番保存空間を使い回してはいけない。

## 仮の画面操作 ↔ コアAPI対応（実装の一対一承認ではない）
| 既存Creative画面の操作 | 隔離エンジンの候補 | 必須確認条件 |
| --- | --- | --- |
| 起動 / 「前回のデータがあるみたい」 | `inspectDraft()` → `resumeDraft({confirmed:true})` | 旧UI保存とは別。権限/データ契約・読取専用FALLBACKをレビュー |
| Wayfarerから開始 | **専用Bridge adapter未実装** | `campsiteProject.v1` を無理にKMZとみなさない。X-04 HOLD |
| ファイル選択 | `prepare(bytes)` → `acceptPrepared({confirmed:true})` | READYのみ採用。HOLD/REJECT・ユーザー確認を飛ばさない |
| ＋ 新規POI / 位置決め | `command({...},{confirmed:true})` | 既存POI移動は禁止、25件と種類別上限、円owner連動をエンジンで保証 |
| POI編集・削除 | `command({...},{confirmed:true})` | 既存の座標不可、メモ/種類と元KMZ構造検査 |
| 活動範囲頂点・追加/削除 | `commandArea({...},{confirmed:true})` | 設計正本ポリゴンと追加活動範囲を混同しない。X-01 HOLD |
| ↶ / ↷ | `undo()` / `redo()` | 一つの履歴正本から地図を再描画、二重履歴にしない |
| 保存 | `saveDraft()` **＋厳密なジャーナル再検査＋strict IDB checkpoint** | `saveDraft()` だけで「完全保存」表示禁止。競合/容量不足/中断は失敗閉鎖 |
| 完成KMZ | `exportKmz()` | 再診断済み出力のみ案内し、原本の上書き禁止 |
| 保存破損復旧 | `inspectRecovery()` → `recoverDraft()`、必要時 `restoreStrictCheckpoint()` | 全て明示的選択・確認。自動削除・自動上書き禁止 |

## 接続方式・リスク
1. **DOMのコピーではなく契約の接続**。既存Creativeは大量のバージョンパッチでUI+状態が生成されるため、`creative/index.html`を単純iframe化/複製すると旧保存処理・旧履歴が動き、独立エンジンとの二重正本になる危険がある。
2. U2では**地図・操作UIの外観/既存実装を資産として再利用**しながら、既存ランタイム内の書込/復元/出力の実際のハンドラーをコード照合して責務ごとに無効化または適切に配線する。安全に単一正本を作れない場合は無理に動作させない。
3. Wayfarer Map→Creative Mode→Campsite Design Toolの X-01〜X-07 は別の統合ゲート。単体KMZエディタを3者結合済みと呼ばない。
4. **旧本番・旧UI/Field/Bridge・PC/Android**への変更禁止。本番は管理者切替OFF維持。
5. U2の成功条件: 隔離ソースが地図中心の起動・レイヤー・ツールを提示、ユーザー操作が予期せぬ旧保存キーを書き換えない、未接続機能は明示的に「準備中/利用不可」、既存のr9〜r14を改変しない。実機Safariは別途。

## 進捗
iPhone内部安全性85%の既往PASSを維持。U1は調査/契約の段階で、UI90%の条件をまだ満たさない。
