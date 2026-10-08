# Creative Next Phase 2: 隔離編集プレビュー 開発報告

**日付:** 2026-10-09 JST  
**Repository:** `Kaityo1221/Campsite-Design-Tool-JP`  
**Branch:** `feature/creative-next-kmz-phase1b-20261009`（既存開発用、mainにはマージしない）  
**状態:** 試験用画面・編集セッション実装済み。Phase 1-B/Phase 2全体PASSは未承認。**実機テスト未着手・非公開。**

## 今回追加したもの

- `phase-1b/integration/isolated-editor-session.mjs`: 実KMZの全件ステージング、旧Creative（葛西型）の隔離変換、取込前確認、Phase 1-AのPOIストアとの接続、メモ・名称の編集、Undo/Redo、検証付きKMZ再書き出し、2世代保存・同じ元KMZを再検証したうえでの復旧。
- `phase-1b/test/isolated-editor-session.test.mjs`: 上記の安全性と異常系のNode単体テスト。
- `phase-1b/test/verify-real-kasai-editor.mjs`: 実物の葛西KMZを**ローカルでのみ**扱う検証スクリプト。原本は公開GitHubに含めない。
- `phase-2-preview/index.html` / `preview.mjs` / `preview.css`: 新フローの非公開・隔離プレビュー画面。検査前取込なし、本人の確定操作が必要。名称検索、編集、履歴、検証付き書き出し、手動保存/復旧、POIの位置を示す背景タイルなしの簡易位置図。
- `phase-2-preview/vendor`: JSZip 3.10.1のブラウザ用ビルドとライセンス（サードパーティ著作権・ライセンスを維持）。

## 試験結果

| 試験 | 結果 | 注意 |
|---|---|---|
| Phase 1-B Node自動テスト | **141 PASS / 0 FAIL** | 旧124件を含む。Node 22 / JSZip 3.10.1 / xmldom 0.9.8 |
| 実葛西KMZの編集セッション試験 | **PASS** | 188既存+25新規、213距離円、活動範囲1。移動/削除/種類変更の危険操作は拒否 |
| Chromium 390px幅の画面操作スモーク | **制限付きPASS** | 実葛西KMZを使用。画面描画・ファイル検査・編集・Undo/Redo・保存・再開・出力を検査。ただし環境ポリシーでURL遷移不可のため、ページ内コードを隔離注入。保存領域/WebCryptoはテスト用代替実装 |
| 通常URLでのブラウザ統合 | **未PASS** | ブラウザ側で `ERR_BLOCKED_BY_ADMINISTRATOR`。本番相当のorigin・localStorage・WebCryptoは未確認 |
| iPhone Safari実機 | **未実施** | テスト開始の最終確認が必要 |

## データ保護と制限

1. **main / 旧Creative Mode / Bridge / Field Mode / DB / 旧保存キー `next-lab-creative-v7` は変更しない。** テストの保存は隔離名前空間 `campsite-creative-next-v1-preview:*` のみ。
2. ファイル選択で既存編集中の状態を自動置換せず、KMZの構造診断、分類、ユーザーの明示的な確認を通った場合だけ隔離編集セッションを開始する。中断・不適合・重複検査の結果が古くなれば候補を無効化する。
3. 距離円付きPOIの移動・削除、旧Creative KMZのPOI種類変更、外部元データを持つKMZへのPOI新規追加は、関係する図形や原文を不整合なく維持できる正式契約・試験が終わるまで**保留**。対応済みの通常編集（名称/メモ）も、エクスポート後に全件再検証する。
4. 保存時は**元KMZの全体を隔離ジャーナルに同梱**し、復旧時に元KMZを再解析して全POI/活動範囲を照合する。別の作業を強制上書きしない。保存書き込みに失敗した場合は成功と表示しない。復旧用世代からの復帰は書込禁止とする。
5. ブラウザのlocalStorageは複数キーを原子的に更新できないため、2世代ジャーナルは完全なトランザクションではない。iPhone Safari実機での容量・クラッシュ・複数タブ・復旧の総合試験は別途必要。
6. 現画面の位置図は地図タイル/Leafletを使わない**簡易ビュー**。正式な地図描画・距離円表示・ポリゴン編集・POI追加UIとWayfarer連携は未着手。この試験画面を正式Creative Mode完成と扱わない。

## 次工程

- 距離円付き新規POIの移動・削除時の従属図形の一括同期、旧形式POIの種類変更時のフォルダー/style/レイヤーの同期、安全なPOI追加契約を別Phaseで検証する。
- 正式Creative UI・地図描画への接続と、旧版との回帰テスト。
- 通常originのChromium/WebKit・iPhone Safariでのデータ保護、保存・復旧、操作感、700件規模をテストする。
- 会長の明示確認までiPhone実機テストに進まない。正式公開・mainマージ・旧Creative Mode変更は行わない。

## 自力でコード試験を再現

```bash
cd creative-next/phase-1b
npm install --ignore-scripts
node --test test/*.test.mjs
# 実葛西KMZは公開リポジトリに置かない
node test/verify-real-kasai-editor.mjs "/private/path/to/kasai.kmz"
```

隔離プレビュー画面はリポジトリのルートをローカルWebサーバーで配信し、`/creative-next/phase-2-preview/index.html` を開く。`file://`でのES module読み込みは対象外。
