# r31 PART A 実測報告（2026-10-11）

**判定: HOLD。85% / Phase 1 HOLDを維持。PART B未着手、保存・実KMZ出力・公開配信なし。**

指定ブランチcodex/original-ui-r31、開始HEAD 77d2961a0f8f14548cb1fab310e14dea297b7d42から作業。変更はr31専用runtime/QA/専用workflow/資料だけ。main、現行Creative Mode、既存保存データ、r16〜r30に変更なし。

## 1. UI不一致の原因と結果

| 対象 | 確認した原因と対応 | 最終Edge結果 |
| --- | --- | --- |
| ルール3幅 | 現行既定unified表示と旧Leafletアイコンの違いが半透明パネルの背後に出ていた。現行アイコンの純表示式を抽出して新runtimeで描画。PCの2枚目は未継承の取消通知も影響し、文言・実フェード完了を照合した。追加Linux検査ではsmooth scrollによるactive dot再選択でCSS遷移が再開し、固定300msでは幅・色の途中位相がずれた。実scroll停止と有限CSS遷移完了を待ってDOM/画像を同じ完了状態で読む | 全カード一致 |
| 移動393px | 286.6m対287.8mを再現。Leafletの短いpanで中心が画素単位に丸められ、中心経度がずれていた。カメラ復元をreset:trueで行う | 一致 |
| 移動1366px | 初期fitBoundsのzoomアニメーションがカメラ復元後に遅れて中心を上書き。初期配置をanimate:falseにし、参照invalidateSize完了を実条件で待つ | 一致 |
| Gym追加バー・保存メニュー・新規シート | DOM・子要素寸法・CSS・font状態は一致。要素ごとの撮影による再描画を排し、1回の全画面画像から同じ領域を切り出して比較。初期通知/半透明パネルの比較時点も揃えた | 全幅一致 |

全画面・図形・カメラまで拡張。比較は従来と同じ色差2、異なる画素数0。距離固定値の埋込、閾値緩和、強制clickは0。DOMの可視controlとSVG属性を検査し、参照専用の非表示旧レイヤーは移植しない。fonts loaded、focus、scroll、中心/zoom、通知の文言と位相を各場面に記録。

## 2. 7機能グループ

| グループ | Edge | Linux CI | 実装・検査 |
| --- | --- | --- | --- |
| 起動・表示設定 | PASS | PASS | 8必須場面、操作証拠と3幅を検査 |
| POI追加 | HOLD | HOLD | 8必須場面、操作証拠と3幅を検査 |
| POI編集・移動 | PASS | PASS | 6必須場面、操作証拠と3幅を検査 |
| 活動範囲・地図 | PASS | PASS | 16必須場面、操作証拠と3幅を検査 |
| 保存・KMZ UI | PASS | PASS | 3必須場面、操作証拠と3幅を検査 |
| 一覧・座標・補助 | PASS | PASS | 8必須場面、操作証拠と3幅を検査 |
| 演出・ジェスチャー | PASS | PASS | 6必須場面、操作証拠と3幅を検査 |

活動範囲作成/確定/取消/削除/描き直し、draft頂点・undo/redo、物差し、背景切替、距離円、レイヤー操作を表示状態として分離。現行standalone保存メニュー、出力先chooser、一覧folder/tab、座標カード/コピーを追加。起動、FAB drag、lever snap/cancel、handle swipe、marker、double tap/pinch、star演出と解除を実装。

旧#saveとworkspace手動保存は現行で非表示。未定義cmKmzExportedに依存する退役メニューは復活させずdenyを維持。保存/出力の実処理は接続しない。

## 3. 新規テスト

既存36場面から156場面へ、120場面を追加。新規の場面名（各3幅）:

- rules-distance
- rules-finish
- touch-preview-new-pokestop
- touch-preview-new-gym
- touch-preview-new-power
- add-lever-40
- coordinate-jump-open
- coordinate-jump-error
- list-new
- list-existing
- list-swipe-new
- list-row-sheet
- coordinate-cards
- coordinate-copy
- save-menu-reopen
- save-chooser
- layers-open
- layer-hidden-既存 PokéStop
- layer-hidden-新規 Gym
- circle-layer-50
- circle-layer-40
- circle-layer-30
- map-aerial
- map-street
- area-start
- area-vertices
- area-draft-undo
- area-close-preview
- activity-layer
- area-choice
- area-delete-confirm
- ruler-measured
- marker-cm-engine-candidate-icon
- marker-cm-engine-existing-icon
- move-lever-30
- fab-drag
- fab-tap-after-drag
- map-left
- addition-star
- startup-transition

操作検査は各幅32項目。通常touchの「＋」→3種類選択→位置preview、lever、座標のエラー/Enter/統合確定HOLD、一覧tab/swipe/行遷移、copy値、chooser取消、円/レイヤー、活動範囲HOLD/取消/描き直し、ruler終了、marker、sheet handle、FAB drag、map drag/double click/double tap/pinch、演出終了、通常起動ボタンHOLD、view不変を含む。

追加監査8テスト:

- 完成証拠が揃った場合の実測PASSと進捗/Part B HOLDの維持
- 欠落・古いfingerprintをHOLD
- 7機能グループの欠落を個別にHOLD
- DOM/画素差・画面幅欠落をHOLD
- 旧実行/保存/二重所有/既存編集/非HOLD応答/後始末漏れ/強制click/回帰不足をHOLD
- 表示式の動的・間接call拒否
- runtimeの旧module/保存/動的実行/計算されたglobal呼出しを拒否
- 実生成ソースの369 denyと全32式再検査

## 4. 全UI比較

Windows Edge 155.0.4283.45、Playwright 1.56.0。新規context、合成NEW_V1、memory storage、固定タイル、取得元/SHA付き実Google pin、外部通信abort、Service Worker禁止。参照だけ隔離して現行UIを実行し、候補はread-only projectionを表示。参照の保存interval2本を初期EMPTY fixture固定のため抑止。

| 幅 | DOM/画像場面PASS | 操作項目PASS |
| --- | --- | --- |
| 390px | 52/52 | 29/32 |
| 393px | 52/52 | 29/32 |
| 1366px | 52/52 | 29/32 |

操作のFAIL9件はすべて参照側の通常touch「＋」誤選択。pointerupがメニューを先に開き、続く合成clickが重なったPowerSpotへ入る。r31ではtouch時の開閉をclickで行い二重入力を防止したが、現行原本との操作差は未承認のためHOLD。後続テストを続ける通常UIリセットは、このFAILをPASSに変更していない。

Linux Chromium CI 141.0.7390.37:

| 幅 | DOM/画像場面PASS | 操作項目PASS |
| --- | --- | --- |
| 390px | 52/52 | 29/32 |
| 393px | 52/52 | 29/32 |
| 1366px | 52/52 | 29/32 |

CI Part A: HOLD。

## 5. 既存回帰

既存333件: 333 PASS / 0 FAIL / 0 SKIP。追加を含むr31監査: 17 PASS / 0 FAIL / 0 SKIP。原本freeze PASS。既存engine/回帰テストに追加変更なし。

Linux CIも既存333件、監査17件PASS。CI測定fingerprintとローカル測定fingerprintの一致を確認した。

## 6. 旧処理の隔離

369/369旧定義を全件deny。未証明176定義の実行許可0。32表示式をallowlist化し、SHA/由来/入力/置換をmanifestに記録して再静的検査。旧IIFE/保存/編集/履歴/renderer moduleは出力しない。動的import、eval/Function、文字列timer、未承認global計算call経路を拒否する。

各幅でcandidateのprecise coverageによる旧関数実行0、旧runtime/engine request0、storageアクセス0、L.map生成1（重複mount拒否）、既存編集要素0、pageerror0。48件のデータ要求は全件HOLD/changed:false、view不変。dispose後のmap/owned DOM/listener/timer/raf/animationは0、独立EventTarget監視も0。元関数を個別移植・安全化したという主張ではない。

Linux CIの各幅も旧関数実行数 0/0/0、旧保存アクセス数 0/0/0、map生成数 1/1/1。全48データ要求のHOLD/changed:false: PASS。全幅のdispose後資源/独立listener 0: PASS。CI隔離静的監査: PASS。

## 7. PART A判定

**HOLD**。固定HOLDを撤廃し、全グループの場面と操作、現在のソースfingerprint、回帰、監査、coverage/保存/単一所有/readonly/解除の実測から判定。どれか欠落・古い・FAILならHOLD。成功fixtureがPASSできることと、違反fixtureがHOLDになることを監査で確認。

残る障害は参照「＋」touchの誤選択とr31で防止した操作との差。原本の修正禁止と未承認差0条件があるため、修正方針または差の承認をPO/ChatGPTで判断するまでPASSにしない。

専用CI全体はHOLDゲートによってfailureになる。画面比較・回帰・隔離の成功だけでCIやPART AをPASSとは報告しない。

## 8. ソース・CI

- ソースSHA: 05fb48953e335f2438996bac5b480e1b02cc196e
- fingerprint: e2f610a9b7f7724e763646846e247b4e9659159632412af46723b6116883b753
- CI: https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38148075025
- 詳細: qa/r31/ui-runtime-comparison.json、part-a-status.json、regression-result.json、audit-test-result.json、isolation-audit.json。CI artifactはr31-part-a-measured-evidence。

## 9. PART B前の残課題

1. 参照「＋」touchの誤選択への対応またはr31の差をPO/ChatGPTで判断し、同じ操作テストをPASSにする。現行原本の変更には今回の禁止範囲を越える指示が必要。
2. PART A PASS後に停止・レビュー。レビュー承認前にNext engine/保存/KMZ実処理/preview配信へ接続しない。
3. Safari実機、実地図/外部画像の取得状態を別途確認。参照の固定コミット起動画像URLは直接取得時404、今回のoffline比較は同じfallback表示であり実画像取得成功の証明ではない。

進捗は85% / Phase 1 HOLDのまま。
