# r31 PART A UI分離試作 — HOLD

配信対象ではない。進捗は85% / Phase 1 HOLD。PART B未接続。旧プレビューと本番の入口から参照しない。

## ソースと境界

- index.html: 正式PATCH_FILES 65本と通常JP変換を適用した完成HTMLから、旧scriptとinlineイベントだけを除いた原ソースHTML/CSS。baseは原画像の参照位置を維持するため追加。
- source-templates.mjs: source-ui-compiler.cjsが元ソースからASTで選んだ20個の表示式、動的CSS2個、DOM記述子を出力。元関数の実行許可ではない。手編集禁止。
- ui-runtime.mjs: 新規接続コード。immutable viewを読んで表示し、表示設定・プレビュー・開閉だけを扱う。元records/履歴/保存/KMZ/描画エンジンとNext Sessionの能力を持たない。
- データ操作はrequest観測境界に到達して必ずHOLD/changed:false。観測者の返値によって成功にしない。保存/復元は別ゲート。
- Leafletは表示専用の1インスタンス。重複mount拒否。disposeでmap/DOM/listener/timer/raf/外部参照を解除。

## 再現

リポジトリ直下から:

    node creative-next/qa/r31/functional-groups.cjs
    node creative-next/qa/r31/source-ui-compiler.cjs
    node --test creative-next/qa/r31/source-audit.test.cjs creative-next/qa/r31/source-ui-compiler.test.cjs
    node creative-next/qa/r31/ui-runtime-comparison.cjs
    node creative-next/qa/r31/part-a-status.cjs

QA依存: jszip3.10.1, @xmldom/xmldom0.9.8, acorn8.15.0, leaflet1.9.4, pngjs7.0.0, playwright。CIはChromiumをインストール。WindowsローカルはR31_BROWSER_CHANNEL=msedgeを使用した。

比較側は合成KMZだけを新規ブラウザcontextで読む。元UIはこの隔離した参照側だけで実行する。memory storage、固定タイル、外部通信abort、Service Worker禁止。初期保存状態EMPTYを固定するため参照側のsnapshot/cmPersistCurrent intervalだけを止める。候補側は旧scriptを含まず、保存アクセス0・旧runtimeリクエスト0を検査する。

比較はDOM/CSS/座標/サイズと画像領域を検査する。通常clickのみ。左右利きとsheet表示の一部は表示APIで準備するため、非表示ボタンのタップや地図marker選択のPASSとは扱わない。画像比較のため無限animationを固定するので演出全体のPASSでもない。

## 未完成

活動範囲と地図ツール、全保存chooser、一覧/座標カード、演出/gesture全経路は未分離または未検証。Gym追加バー/ルール等の画像差と移動距離0.1m差が残る。地図全体の距離円・polygon描画一致は未PASS。Safari実機未検証。完全UIゲートがHOLDの間、Part Bと配信を実行しない。
