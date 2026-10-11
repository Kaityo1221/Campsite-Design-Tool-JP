# r31 PART A 最終受入仕様（2026-10-11）

対象branch: codex/original-ui-r31。検証基点05fb48953e335f2438996bac5b480e1b02cc196e、証跡基点37ba2595e4f0cb405e6723aea139b98e352a5997。

## 承認済み操作例外

ID: R31-PLUS-2STEP-2026-10-11。今回のPO指示で承認。

＋の最初の通常タップは3種類の選択メニューだけを開く。POI種類の選択、位置プレビュー、データ変更要求を発生させない。次の明示的な種類タップでのみ、その種類の位置プレビューを開始する。確定は別操作であり、PART A中はHOLD/changed:falseとする。

現行Creative Modeのpointerupと後続clickによるPowerSpotの意図しない自動選択は継承しない。例外はこの＋入力経路だけで、他の操作・DOM・CSS・位置・色・画像・距離・保存・解除検査を緩和しない。＋の外観は従来の厳密比較を継続する。

## 証拠と検証

既存9 FAILはreference-plus-diagnostic-baseline.jsonへ原判定・入力trace・classesをそのまま保存し、元commitにも残す。再測定の参照診断はreference-plus-diagnostic.jsonへ分離。これらをPASSに書き換えない。

plus-acceptance.cjsは候補r31のみを新しい隔離contextで検査し、390/393/1366pxそれぞれで3種類の通常tapを実行する。第一段階でmenuのみ、第二段階で指定種のpreviewのみ、確定HOLD、取消・view不変、保存0/旧実行0/単一map/解除0を確認する。参照診断の失敗を根拠に候補の受入を省略しない。

7グループの実測判定は、現在fingerprintの156場面比較、幅別必須操作、独立＋受入、承認例外ID、未承認差0、回帰333/監査17、隔離/全データ要求HOLD/正常解除をすべて必須とする。参照診断の内容欠落や例外外の診断名もHOLD。画素色差2・異なる画素0、force click0の既存条件を維持する。

## 停止境界

PART A全ゲートPASS時点で停止。PART B/保存機能有効化/隔離preview配信/main反映は行わない。iPhone Safari実機はNOT_TESTED。進捗85% / Phase 1 HOLDのまま。PART A表示受入PASSを編集・保存・実機・公開PASSへ拡張しない。
