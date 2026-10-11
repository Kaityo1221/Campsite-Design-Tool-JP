# r31 回帰4件の修復（2026-10-11）
監査コミットb312c83907a6c696f595e694ff6854f4a9b3f2baを独立リモートブランチcodex/original-ui-r31へ保全した後に実施。

| テスト | 原因 | 修正 |
| --- | --- | --- |
| creative-next-original-leaflet-overlay | fake mapにhasLayerなし | Setの現在状態を返すhasLayerを追加 |
| original-file-review | fake controlにclassListなし、native changeは非同期開始のみ | add/remove/toggleを追加しcloneにクラスを保持。observableな開始ボタンreadyを期限付きで待つ |
| original-ui-buttons-fixture | fake sessionにhistoryなし | Undo後0/1、Redo後1/0の履歴を返しrefreshでsync。無効/有効状態も確認 |
| real-engine-original-ui | import直後Undo有効を期待 | importはhistory 0/0。実編集後だけUndo有効、Undo後Redo有効を確認 |

アプリ/エンジン/Command Boundary/保存/旧プレビューは変更しない。変更対象は4テストだけ。
変更前4 FAIL、変更後4 PASS。Phase 1-A POI core + Phase 1-B +既存qaの333件すべてPASS、FAIL 0。
旧監査のregression.logは残し、regression-four-before.log、regression-resume.logをignoredローカル証跡として追加した。
これはPART AのUI一致やiPhone実機PASSを意味しない。進捗85% / Phase 1 HOLD。
