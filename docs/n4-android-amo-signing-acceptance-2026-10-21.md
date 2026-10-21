# Campsite Noah Android N4: Mozilla unlisted署名・受入れ監査（隔離QA）

更新：2026-10-21。**署名未実施 / 実機未試験 / Phase 1 HOLD / 本番未反映。**
この文書は PR #375 の補助文書であり、公開 Android 0.3.5、本番 main、PC/iPhone、Receiver、Creative を変更しない。

## 0. 署名に出せるもの / 出してはいけないもの

- GitHub Actions run `39263439959` の Artifact `n4-android-qa-unsigned-0.3.7`（ID `12191608909`）を取得。
- ZIP の **中身** `campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi` のみが署名提出候補。ZIP全体は送らない。同梱 `.sha256` は元XPI検査用に保管する。
- QA専用 ID は `campsite-bridge-android-n4-qa@local`、version は `0.3.7`、Android compatibility 用 `browser_specific_settings.gecko_android` が含まれる。
- 公開版 ID `campsite-bridge-android@local`、公開署名済み `downloads/campsite-bridge-android-0.3.5.xpi`、本番既存のAMO掲載は**更新しない**。
- Artifactは2026-10-26 22:49頃 JST失効。失効した場合はQAブランチのCIで**同じソースを再構築**してチェックサムを再照合（暗黙に旧ファイルへ差し替えない）。

## 1. 開発者のAMO手操作（まだ実施していない）

1. AMO Developer Hub (https://addons.mozilla.org/developers/) に開発者本人がログインする。既存公開アドオンの「新バージョンを登録」は選ばない。
2. 「Submit a New Add-on」を選び、配布方法は **On your own / Self-distribution / Unlisted（非掲載）** を選ぶ。
3. 上記QA専用XPIをアップロードし、AMOの検証結果を確認。検証・レビューで止まった場合は理由を記録し、必要なら新しい隔離PRで対応する。制限や権利条件への適合も申請者が確認する。
4. 受理・署名されたXPIを取得し、署名済みファイルとして別名で保管する。AMO APIキー、セッション、トークン、認証済みGCSの本文はリポジトリやチャットに保存しない。
5. AMO側の状態が「署名済み」になっても、この時点では **Android実機PASSでも送信可でもない**。

参考（Mozilla公式）：
- https://extensionworkshop.com/documentation/publish/submitting-an-add-on/
- https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/
- https://extensionworkshop.com/documentation/publish/install-self-distributed/
- https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/manifest.json/browser_specific_settings

## 2. 署名返却XPIのオフライン受入れ監査

署名前XPI・同梱SHAファイル・署名後XPIを同じPCに保管し、このリポジトリで次を実行（Node.js / unzip が必要）。

```bash
node scripts/audit-n4-android-signed-qa.mjs \
  /path/to/campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi \
  /path/to/Mozilla-returned-N4-QA.xpi \
  /path/to/campsite-bridge-android-n4-qa-0.3.7-unsigned.sha256
```

以下を検査：オリジナルSHA-256、バージョン/ID/Android互換メタデータ、実行コード・manifest・CSSなど全ペイロードの**バイト単位一致**、追加ファイルが `META-INF/` 署名関連に限定されること、署名構造が存在すること。署名返却XPIのSHA-256を記録する（ファイル本体を一般配布しない）。

**重要**：この比較ツールではMozilla署名を暗号学的に検証しない。誰でも偽の `META-INF` を作れてしまうため、監査PASSだけで署名済みと認定しない。AMO開発者画面の署名状態と、**Android Firefoxが署名・互換性を受理して導入できること**を合わせて確かめる。

ツールがFAILした場合：勝手にファイルを書き換えない。署名済みXPIを配布・導入せず停止し、AMO提出元のファイルを確認する。

## 3. Android実機（署名・同一性の検証が終わってから）

1. 同じWayfarerページで公開0.3.5とQA版を**同時起動しない**。QA中のみ公開版を無効にする、または別のFirefox環境を使う。
2. Android Firefox 設定→Firefoxについて→ロゴを素早く5回→設定へ戻って「ファイルから拡張機能をインストール」。Mozilla署名返却XPIを選択。
3. Android Firefoxがインストールを受け付け、QA名とバージョンが独立して表示されることを確認する（D01）。失敗時は `D01 FAIL` として原因を控え、導入成功と報告しない。
4. 引き続き PR #375 の既存QAガイド D02〜D09 を試す。匿名GCS診断以外の秘密データを共有しない。
5. D10は `sourceComplete` の真正な意味的証明まで **BLOCKED**。`null` を `true` に変更しない。`coverageComplete=false` の正式送信停止を維持する。

## 4. 受入れ判定

| ゲート | 判定基準 | 2026-10-21 |
|---|---|---|
| S01 | AMO unlistedでQA IDに署名 | NOT TESTED |
| S02 | 返却XPIとunsignedの全ペイロード一致 | NOT TESTED（監査ツール合成PASSのみ） |
| S03 | Firefox Androidで署名・互換性が検証された | NOT TESTED |
| D01〜D09 | Android実機の各テスト | NOT TESTED |
| D10 | GCS真正全件判定・実機Receiver→Creative | BLOCKED |
| RELEASE | オーナー承認と公開版保護 | HOLD |

この補助PR自体も **Draft** としてQAベースに積む。mainへ直接マージせず、本番拡張の署名・AMO提出・公開アップロードは自動化しない。
