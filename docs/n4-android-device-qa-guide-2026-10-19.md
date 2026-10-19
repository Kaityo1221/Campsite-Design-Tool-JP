# Campsite Noah / Android N4 実機QAキット（2026-10-19）

**状態：PREPARED / 署名・実機・GCS完全性の合格は未達成。**

対象はN4 0.3.7の隔離開発候補。PC main・iPhone・Creative・Receiver・公開Android 0.3.5への変更は行わない。Phase 1 HOLDを維持する。

## ファイルと署名の区別

| 種類 | ID | 状態 |
|---|---|---|
| 公開Android 0.3.5 | campsite-bridge-android@local | Mozilla署名済み、触れない |
| N4 QA 0.3.7 | campsite-bridge-android-n4-qa@local | **未署名**、開発・署名依頼用 |
| QAの実機用 | campsite-bridge-android-n4-qa@local | Mozillaが別途署名した場合に限り標準Firefoxで導入可 |

QA用と公開版は拡張機能のIDが異なる。ただし二つのBridgeを同一Wayfarerページで同時に実行すると競合し得る。別Firefox系アプリか、QA中だけ公開版を無効化して利用する。公開版を削除・置換しない。

## A. GitHub Actionsから未署名のQA成果物を取得

1. QA準備PRの「Noah N4 Device QA Package」GitHub Actionsを開く。
2. 成功した実行の成果物「n4-android-qa-unsigned-0.3.7」を取得する。
3. 同梱ファイルを確認する。campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi、同名sha256ファイル、この手順書。
4. SHA-256を照合。成果物名は **UNSIGNED**。署名済み配布版ではない。

この未署名版を通常Firefoxへ直接インストールしようとしないこと。CI成功はインストール可能や実機PASSを保証しない。

## B. Mozilla署名を取得する手順（開発者のみ、別工程）

Mozilla公式： https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/

- AMO開発者側でQA専用の非掲載（unlisted）アドオンとして提出する。公開0.3.5のIDやリスティングを更新しない。
- Mozillaによる審査・署名済みXPIの取得を待ち、IDがcampsite-bridge-android-n4-qa@local、versionが0.3.7であることを確認する。
- AMO認証情報・APIキーはGitHubアーティファクト、スクリーンショット、チャットに貼らない。
- 今回のPRは署名用の提出やAPI操作を行わない。**Mozilla署名は未取得。**

公式のAndroidファイル導入： https://extensionworkshop.com/documentation/publish/install-self-distributed/

## C. 署名済QA版が用意できた後のAndroidでの操作

1. 署名済みQA XPIを端末に保存する。
2. Firefoxの「設定」→「Firefoxについて」→ Firefoxロゴを素早く5回タップして開発者向け項目を表示。
3. 設定へ戻り「ファイルから拡張機能をインストール」を選択、署名済みQA XPIを指定。
4. 拡張機能の一覧に「Campsite Bridge N4 QA TEST」が現れることを確認。公開0.3.5とは別で管理する。
5. Wayfarer MapにログインしBridgeを開く。新しいPOI OverlayをBridgeが重ねないことを確認する。

現在のN4はGCS完全性を証明していないため、**実際のCampsite送信は停止するのが期待挙動**。送信成功を目的とした試験ではない。

## D. 実機テスト項目

| ID | 操作 | 期待 | 現状 |
|---|---|---|---|
| D01 | QA拡張を導入 | 公開0.3.5への影響なし | NOT TESTED |
| D02 | Wayfarer Map起動 | N4パネル表示、既存POIはWayfarer/WFMM側が管理 | NOT TESTED |
| D03 | 設計範囲を作る | 中央十字・3〜30頂点・元に戻す・編集/確定 | NOT TESTED |
| D04 | 取得を開始 | 設計範囲+200m、500m以内の分割タイル、地図位置復帰 | NOT TESTED |
| D05 | 🧪 GCS診断 | タイル数・POI件数・未検証状態が表示される | NOT TESTED |
| D06 | 失敗/異常応答 | 不正JSON、error、hasMore等は取得成功扱いしない | 合成PASS、実機未実施 |
| D07 | Inactive Power Spot | 参照専用であり編集対象への混入なし | 合成PASS、実機未実施 |
| D08 | 送信安全停止 | 未検証のsourceCompleteでCampsite送信不可 | 合成PASS、実機未実施 |
| D09 | 再試行・範囲変更 | 失敗時に再試行可能、古い観察が復活しない | 合成PASS、実機未実施 |
| D10 | 正式Receiver/Creative接続 | 公式GCS完全性検証・実機確認後のみ実施 | **BLOCKED** |

## E. 実機確認で共有してよい情報

- Android機種／OS／Firefoxバージョン、D01〜D09のPASS・FAIL。
- 個人情報を隠した画面スクリーンショット。
- N4パネルの「📋 匿名診断をコピー」で出力される統計JSONだけ。
- エラー表示・再試行挙動（機密情報を含まない範囲）。

**共有しない**：ログイン情報、Cookie、アクセストークン、APIヘッダー、GCS生レスポンス、他人の個人情報。匿名診断は不完全性の発見に役立つが、GCSの「全件取得」を証明するものではない。公式のAPI仕様・許可された検証証拠が必要。

## F. 切り戻しと公開停止ルール

QA用拡張機能だけを無効化または削除。公開0.3.5と保存済みProjectを変更しない。

- 未署名 → 一般Firefoxでの導入禁止
- 認証済みAndroid実機の検証なし → HOLD
- GCS sourceCompleteの真正な判定条件がない → 送信STOP
- Android→Receiver→Project→Creativeの実機E2Eとオーナー承認なし → 本番マージ・公開禁止

**参考：** PR #373（fail-closed）、#374（GCS匿名診断と合成E2E）、本QA準備PR。
