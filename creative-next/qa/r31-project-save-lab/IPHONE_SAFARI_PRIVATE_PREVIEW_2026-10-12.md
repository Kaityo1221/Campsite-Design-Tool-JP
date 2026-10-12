# iPhone Safari 隔離プレビュー実機確認手順（Phase 1 HOLD）

この手順は **PR #368 の検証用**であり、本番公開・本番保存承認を意味しない。承認済み r31 UI、Wayfarer Map、旧 Creative Mode、`main` は変更しない。

## 配布・公開の条件

- 専用オリジン（本番サイトとは**別のホスト名**）が必須。同じホストの別パスでは `localStorage` と `IndexedDB` のオリジンが分離しない。
- Vercel Authentication 等、アクセス制御のある独立した**非本番**プレビューでのみ配置する。公開 Pages に無制限で自動配信しない。`robots=noindex` はアクセス制限の代わりにならない。
- GitHub Actions `Creative Next r31 confirmed Project save UI LAB` の `r31-private-preview-<run-id>` **artifact** は静的ファイル一式であり、Web上で実行できるURLそのものではない。デプロイは自動で行わない。
- Artifactには依存モジュールと3種類のUIアイコン、架空のProject/KMZサンプルだけを入れる。既存ユーザーのファイル、保存内容、秘密鍵、環境変数は含めない。
- 配置する場合はZIP内の `index.html` と `creative-next/`、`creative/assets/` を**サイトのルートに**展開する。サブパスへそのまま移すと、凍結済みr31 HTMLの `base` 相対パスが変わるため不可。
- 埋め込みr31は凍結済みHTMLをそのまま使うため、Leafletの外部CDN、OSM地図タイル、背景画像への外部アクセスが必要。外部依存のブロックや通信圏外は別途評価する。

## iPhone Safari 実機チェック（実施前は NOT_TESTED）

1. 専用プレビューのルートURLをSafariで開く。**本番URL・従来Creative URLではない**ことを確認。
2. 「サンプルProject JSON」と「サンプルNEW_V1 KMZ」をiPhoneの「ファイル」へ保存する。**実データは使わない**。
3. 「r31プロジェクト保存LABへ」→右上の「🧪 プロジェクト保存 LAB」。2ファイルをそれぞれ選択。
4. 明示確認で編集開始。地図が1つだけ表示され、既存POIは読取専用であることを確認。
5. 新規Gymを追加→Undo→Redo。「変更をプロジェクトに保存」→承認→「保存成功・世代 1」を確認。
6. 「保存済みプロジェクトから再開」→承認→新規SessionのPOI再現とUndo/Redo初期化を確認。
7. Project ID／Handoff IDを不正にして再開→`HOLD`。現在の地図／保存世代が維持されることを確認。
8. 保存確認または再開確認を**キャンセル**→従来Sessionと保存が維持されることを確認。
9. iOS Safariの表示を確認：上部セーフエリア、スクロール、パネルの開閉、ファイル選択、タップ、キーボードによる入力、ピンチ/地図操作、Safariの戻る、縦持ちでの再表示。
10. 必要なら通常のr31 KMZ書き出しで共有シート／ファイル保存を試す。共有シートが閉じただけでは「ファイル保存成功」と判定しない。

## 証跡と判定

- デバイス機種/iOSバージョン、Safari、実行日時、プレビューの**commit SHA**、画面幅、使用したサンプル、合否を記録。
- 不具合は再現手順と画面を記録し、作業をLAB内で止める。実データのスクリーンショットやKMZ/JSONをPRへ添付しない。
- `R31_LAB_BROWSER=webkit` を用いたmacOS上のPlaywright WebKit合格は「**WebKitシミュレーション PASS**」であり「iPhone Safari実機 PASS」とはしない。
- 本番 `main`、既存Creativeデータ、元KMZは絶対に移行・上書きしない。Phase 1 HOLDとPR Draftを維持。
