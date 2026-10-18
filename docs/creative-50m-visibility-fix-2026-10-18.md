# PC Chrome: 50m円の表示制御修正

Phase 1 HOLD維持。独立ブランチ `fix/creative-50m-layer-visibility-20261018` のレビュー用修正。マージ・本番反映なし。

## 対象ページと新Creative Modeの関係

- 対象: `creative/index.html?campsiteProject=bridge`。
- 調査基点: `main` の `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`。既存作業のcheckoutを切り替えず、別worktreeで実施。
- このページは `runtime/runtime-vnext.html` → `base-v7.html` にCreativeパッチを適用し、Bridge経路では `wayfarer-reference-layer-patch.js` を適用する既存の実行経路。
- PR #368は `creative-next` のr31 Project保存LAB。対象ページとは別経路。調査時の先端は `818e779600b59cf30dd5f991e5097af3dd7cfcea`、変更43ファイルとの重複は0。
- 2026-10-18に公開URLのindex.htmlと参照レイヤーパッチを読み取り、調査基点と一致することを確認。公開index.html SHA-256: `0d7c2df950f15de5f6736f8c64643424634846d278c79b018342ad2ef1cc0ab1`。

## 原因

1. `creative-patches-v38-circle-layer-import.js` の `cmToggleCircleLayer(50)` は `circleExtras` を更新する。メニューの `active` / `aria-pressed` も同じ状態を参照。
2. `creative-patches-v54-coordinate-memo-reason.js` の `cmCandidateShadowDisplayState()` はその状態を `radii` として返す。v55/v57のUnified描画と既存の再描画フックは編集対象POIの円に反映していた。
3. `wayfarer-reference-layer-patch.js` の `cmWm3cReferenceScene()` は別途参照シーンを作ってマージする。`wayfarer-reference-scene-builder.js` が各参照POIに常時生成する `circle-50` をそのまま返しており、トグル状態を参照していなかった。
4. そのため編集対象の円は消えても、Wayfarer観察のINTERIOR / REFERENCE_100由来のオレンジ円だけが残った。再描画漏れではなく、参照シーンでの表示条件の欠落。

## 差分

実行コードは `creative/wayfarer-reference-layer-patch.js` の1箇所のみ（3行追加・1行削除）。既存の表示状態に50が含まれない場合、返却する参照シーンから `layerKey === 'circle-50'` の項目だけを除外する。

マーカー、参照geometry、観察元データ、records、活動範囲、距離計算は保持。40m/30mや保存形式を変更しない。`js/bridge-distance-project.js`、承認済r31 UI、新保存フロー、`creative/runtime`、main、本番サイトには差分なし。

追加差分は回帰試験・専用Chrome設定・試験サーバー・本報告のみ。既存の統合試験fixtureには表示状態を追加し、OFFで円だけが消え、ONで元のシーンに戻ることを検証。

## 試験結果

Windows上のインストール済みGoogle Chrome **155.0.8059.80**、headless、1440×900、ja-JP。Playwrightの `channel: 'chrome'` を使用。

- 修正前: 編集対象2地点＋参照2地点で、50m OFF後も参照円2個が残ることを実描画レイヤーで再現（期待0、実測2）。
- 修正後: Chrome **11/11 PASS、skip 0、flaky 0**。
- 観察データあり／なし、ON/OFF反復、40m/30mの独立制御、パン・ズーム・明示refresh・観察更新イベント・自動保存後の非再出現。
- 新規候補0、既存1＋参照301の計302地点（PokéStop/Gym/PowerSpot/非アクティブPowerSpot）で、50m円302→0、マーカー302を保持。
- 既存POI・活動範囲・観察情報の不変、50m未満の参照距離警告の不変。
- 既存回帰: Unified/legacy描画、BFCache復帰、編集・移動・Undo/Redo・削除、参照POIのrecords非混入、追加・選択中の距離警告。
- 構文生成、参照Adapter/Scene/Renderer/Creative統合、WM6B距離、WM4Aライフサイクル、WM3C配布パッケージ、距離stale判定、`git diff --check` もPASS。

テストは合成Projectを独立ブラウザーcontextへ投入。CDNライブラリはローカル依存に置換し、認証をテスト用stub、背景タイルを空応答にした。ユーザーの実データ／ログイン済みChrome profileでは未試験。実機手動確認は以下を使用。

## 再実行・実機確認方法

ブランチを別checkoutへ取得し、リポジトリ直下で依存を導入後、インストール済みGoogle Chromeを使って実行:

```sh
npm ci
npx playwright test --config=playwright.creative-circles.config.mjs
```

手動確認は同じcheckoutで `node tests/helpers/creative-circle-server.mjs` を起動し、PC Chromeで `http://127.0.0.1:4186/bridge-gateway.html` から通常のBridgeプロジェクト読込手順を使う。テスト用プロジェクトに活動範囲内と周囲100mの観察参照POIを含める。公開サイトのデータは自動移行されない。

1. 遷移先がローカルの `creative/index.html?campsiteProject=bridge` であることを確認。
2. レイヤー → 50m円をOFF。グレー表示と同時に編集対象・参照POIすべてのオレンジ50m円が消えることを確認。
3. パン・ズーム、数秒待機、観察情報の再読込後も円が復活しないことを確認。
4. ONで円が戻ること、OFF/ONの反復で重複しないことを確認。
5. 40m/30m、既存POIマーカー、活動範囲が維持され、参照POIから50m未満の候補には引き続き距離警告が出ることを確認。

再ロード時の初期円設定やエクスポート仕様は今回の対象外。既存仕様を変更していない。
