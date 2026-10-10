# Creative Next: 一般向けCreative Mode UI復帰方針（2026-10-10）

状態: **POが「以前の新フロー用Creative Modeデザインに戻す」ことを承認**。本書はコード照合済みUI基準と実装境界を固定したもの。**UI新実装・iPhone実機90% PASS・3機能E2E・本番切替は未実施**。

## 0. 何を復帰するか

2026-10-10 r14 `creative-next/phase-2-preview/index.html` は機能・保存安全性を検証する**開発者用フォーム画面**。一般ユーザー向けの正式UIにしない。検証画面・専用URL・保存名前空間は維持する。

一般向けのUI基準は、すでに存在する地図主体のCreative Mode体験。実装参照（変更はしない）:
- 起動/既存アプリ入口: `creative/index.html` / `creative/runtime/runtime-vnext.html`
- 全画面地図/下部操作/地図UI: `creative/runtime/creative-patches-v45-unified-map-ui.js`
- 統合レンダラー/地図操作: `creative/runtime/creative-patches-v55-unified-visible.js`、`v56-unified-interaction.js`
- 前回の保存あり案内: `creative/runtime/creative-patches-v61-saved-session-hint.js`
- ルール「?」: `creative/runtime/creative-patches-v59-help-button.js`、`v60-rules-carousel.js`
- 一般向けPOI種類選択・上限: `creative/runtime/creative-patches-v75-poi-add-phase-c.js`
- 50/40/30m参考円表示: `creative/runtime/creative-patches-v76-radius-reference-ui.js`
- 活動範囲がない場合の案内: `creative/runtime/creative-patches-v77-phase-e-ux.js`
- 既存POI表示形状とKMZ保存パネル: `creative/runtime/creative-patches-v73-production-visual-fixes.js`

**注意**: `js/field-mode-map-first.js` / `css/field-mode-map-first.css` は別のField ModeのUI資産。類似名称を理由に今回のCreative Mode UI全体と置き換えない。実装を流用するなら個別レビュー必須。

## 1. PO確認済みの一般向け体験

### 起動画面
- 従来の風景イメージ、タイトル「CREATIVE MODE」、コピー「新しい世界の幕開けへ。」を維持。
- 「創作をはじめる」「ゲームスポット元データを選択」「メインツールへ」の既存導線。
- 保存データが見つかった場合だけ「↓ 前回のデータがあるみたい」の案内と確認式再開。保存の無断移行や無断置換はしない。
- Wayfarer/Bridgeからの受渡しがある場合に**改めてKMZ選択を必須にしない**。データ契約が不完全なら黙って続行せずHOLD。

### 編集画面
- **Map First**: 地図を主役に全画面に広げる。縦並びの「01 KMZ検査→02 POI編集→03 活動範囲→04 保存」は正式UIに使わない。
- 上部: 戻る、地図切替/レイヤー。現在地ボタンは以前の削除方針を維持し、無断復活させない。
- 下部: 保存、中央「＋」、道具箱を主な操作導線とし、Undo/RedoをSafariの下端操作と干渉しない位置に置く。両利き・セーフエリアを配慮。
- フローティング操作UIは先行合意の約85%視覚サイズを参照。ただし**タッチ領域は約44px以上**を維持。
- ＋からPOI種類（PokéStop/Gym/PowerSpot）を選択。設置中は選択中の種類を名前・画像で表示。最大25（種類別12/8/5）は安全ロジックが最終判定する。
- 地図上の種類表示: 既存PokéStop青、Gym赤六角形、PowerSpot紫菱形、Inactive PowerSpot薄ピンク菱形、追加候補オレンジ。旧二重丸は出さない。
- 新規POIの位置決めは地図＋中心照準と明示的確定。既存POIは手動で動かせない。
- 距離円は50mを配置基準、40/30mは参考表示。50m未満は警告・理由の導線を示すが、それだけで無条件に設置禁止にはしない。
- 活動範囲なしの場合はレイヤーと「活動範囲」の案内を強調。詳細ルールは「?」→カルーセル/シートに分離。常時長文を地図上に出さない。
- 選択中POIの強調、POI名/種類/既存・新規の分かりやすい表示を維持。
- 保存/失敗/復元確認は地図を覆う恒常的フォームではなく必要時の明示的シートで案内し、成功と未完了を厳密に区別する。

## 2. 内部機能の責務を分離

- `creative-next/phase-2-preview/` のr14は安全性・異常系試験基準として凍結。検証URLと旧世代保存名前空間を保持。
- 一般UIを別の隔離パス（将来のr15等）で設ける際は**既存Creative UI/ビジュアルを再利用**し、保存/KMZ/活動範囲ロジックをコピーして再発明しない。
- 既存UIの `records → refresh() → Candidate Adapter → Geometry → Unified Scene → keyed Renderer → Leaflet` の**read-following**方針を維持。表示コンポーネントが二重の編集正本を持たない。
- r14の `createIsolatedEditorSession` の保存・KMZ安全性を参照する**新しい結合境界**はまだ未確定。従来UIの旧保存とr14の保存を同じURL/namespaceで黙って混ぜない。
- 本番の `creative/index.html`、旧Creative Mode、Bridge/Field Mode、`main`、PC/Android完成版、実KMZ原本は変更しない。
- 2026-10-05 PO方針: 新フローは一般ユーザー非表示で完成させ、**管理者切替OFF=現行、ON=新フロー**を公開承認後に適用。自動ONにしない。
- Wayfarer→Creative→Campsite Design Toolの連携 X-01〜X-07 は `THREE_PLATFORM_ALIGNMENT.md` に従い、未解決項目はHOLD。特に正本ポリゴン/追加活動範囲、既存座標、外周参照、`campsiteProject.v1`と`NEW_V1`を混同しない。

## 3. 実装順とゲート

1. **U1: 基準固定（この文書）**: 既存UIのDOM・CSS・イベント導線とr14セッションAPIを一覧化。既存UIファイルには手を加えない。
2. **U2: 表示専用隔離シェル**: 既存UIを参照・再利用する新フロー画面を隔離パスに作り、Map Firstの見た目と起動導線を確認。ダミーの保存成功/実データ同期は絶対に表示しない。
3. **U3: 編集アダプター**: POI/活動範囲、Undo/Redo、保存、復旧、KMZを一機能ずつ単一ストアに接続。失敗はHOLD、安全性未確認の自動移行禁止。
4. **U4: iPhone Safari UI実機**: 375/390/430幅、キーボード、Safariナビゲーション、地図・道具・保存シート、長いPOI名。CI PASSと実機PASSを別に記録。
5. **U5: Android差分判断と3機能結合E2E**: PC/Androidは基準維持。必要な変更のみ台帳と承認を経て反映。
6. **公開ゲート**: PO明示承認、管理者切替と切戻し手順が揃うまで一般公開不可。

## 4. 進捗管理

- **既存のiPhone内部機能工程: 85%（安全性r13正式PASS）を維持**。新しい一般向けUIは未完成であり、85%という数字を公開UI完成度と表現しない。
- **次の目標90%の要件を修正**: フォーム型r14の見た目PASSだけでは達成とみなさず、Map First型の一般ユーザー向けUIとiPhone Safari操作性の実機PASSが必要。
- r14の自動CSSゲートと既往iPhone安全性試験は引き続き有効な証跡。無意味に再試験しない。
- この仕様の作成はUI実装や本番公開を意味しない。
