# r31 現行UIソース台帳

基準: 2d9f0c472a0263fd4b68044b76bb2a80bb265289。PART AはHOLD。ソース調査であり、移植完了・全依存分離の証明ではない。

原本は参照専用。runtime-vnextの文字列変換→creative/index.htmlのPATCH_FILES 65本→通常JPを実際の順序で組み立てる。履歴manifestを順序の正本にしない。未掲載v72を追加しない。Bridge専用処理は実行しない。

CRLFはメモリ内でGit配信のLFへ正規化する。原本変更なし。生成するのは台帳であり、旧アプリをr31として起動しない。

## 要素別の生成元、依存、移植先、検証

| 要素 | ソース | 生成関数/DOM | 要分離依存 | 移植先/状態 | 検証 |
| --- | --- | --- | --- | --- | --- |
| 静的HTML/CSS | creative/base-v7.html | HTML, .entry, .panel, .bottom-bar | 内包scriptにSTORE・records・履歴・map起動 | 未移植（r31 runtimeなし） | DOM + 計算済みCSS + ピクセル比較 |
| 通常起動 | creative/index.html; runtime/runtime-vnext.html | PATCH_FILES, runtime文字列変換 | 認証は比較から除外、Bridgeは別ゲート | 未移植（r31 runtimeなし） | runtime→65本→JPの順序 |
| 動的CSS | creative/runtime/creative-patches-v6-intuitive.js | cmAddStyle / #cmStyle | cmInstallUiから旧保存・メタデータ更新 | 未移植（r31 runtimeなし） | style生成 + シート/FABの計算済みCSS |
| ＋/3種類POI | creative/runtime/creative-patches-v6-intuitive.js; v13,v33,v45,v75 | cmInstallFab, cmOpenAddMenu, cmStartAdd, cmEnableFabDrag | 捕捉click/pointerup、旧追加先・上限・描画 | 未移植（r31 runtimeなし） | 通常タップ、3 bubble、展開、左右配置、容量境界 |
| POI編集シート | creative/runtime/creative-patches-v6-intuitive.js; v69,v71; creative/jp-creative-patch.js | cmOpenRecord, cmCloseSheet, cmSheetSwipe | r.title/memo/layer/deleted、snapshot、cmPersistCurrent | 未移植（r31 runtimeなし） | 既存閲覧専用、新規30/50文字、種類・削除、スワイプ |
| POI移動 | creative/runtime/creative-patches-v32-poi-move-isolated.js; v34,v36,v70 | cmBeginMove, cmInstallMoveUi, cmEndMove | 旧位置・pushHistory・snapshot・marker | 未移植（r31 runtimeなし） | プレビュー不変、確定1回、取消、Undo/Redo |
| 追加位置プレビュー | creative/runtime/creative-patches-v34-placement-core.js; v75,v76 | cmSafeInstallAddBar, cmSafeEnsureAddCircle, cmSafeBindAddLever | 旧コマンド・Leaflet・captureイベント | 未移植（r31 runtimeなし） | crosshair、レバー、確定/取消、二重送信なし |
| 距離円/参考円 | creative/runtime/creative-patches-v20-radius-gauge-save-return.js; v21-v30,v38,v76 | cmSetGuideRadius, cmSafeSetAddRadius, cmReadImportedCircleLayers | 旧KMZ所有円と表示参考円の区別 | 未移植（r31 runtimeなし） | owner円保持、参考円独立、元データ不変 |
| 活動範囲 | creative/base-v7.html; runtime/runtime-vnext.html; v68,v74,v77 | openPolygonChoice, beginCrosshairPolygon, finishPolygon, showPolygonDeleteConfirm | polygons.push/deleted、旧履歴・snapshot・描画 | 未移植（r31 runtimeなし） | draft確定/取消、削除・履歴、幾何HOLD |
| ツール/物差し | creative/base-v7.html; creative/runtime/creative-patches-v74-tools-phase-b.js | selectTool, renderTools, clearRuler | mapイベント・旧描画の解除 | 未移植（r31 runtimeなし） | 開閉、2点、終了時listener解除 |
| ヘルプ | creative/runtime/creative-patches-v59-help-button.js | #cmV59HelpButton / runtime | DOM生成後v60でhandler更新 | 未移植（r31 runtimeなし） | DOM存在、位置・タップ領域、ルール開閉 |
| ルールカルーセル | creative/runtime/creative-patches-v60-rules-carousel.js | #cmV60RulesPanel / track / dots | スクロール・クリック・開閉listener | 未移植（r31 runtimeなし） | 3枚、ドット、横スワイプ、閉じる |
| 保存メニュー | creative/runtime/creative-patches-v6-intuitive.js; v20,v41-v43,v63-v65,v73 | cmOpenSaveMenu, cmInstallStandaloneSave, showSaveChooser | 旧exportKmz・snapshot・cmPersistCurrent | 未移植（r31 runtimeなし） | 元DOM、保護保存HOLD、出力誤成功なし |
| 前回データ案内 | creative/runtime/creative-patches-v6-intuitive.js; v58,v61 | cmInstallEntryHistory, cmRenderRecent, resume.onclick | cmMigrateLegacyStore、旧キーget/set、restore | 未移植（r31 runtimeなし） | 旧保存アクセス0、新保存の検証と明示承認 |
| 起動演出/遷移 | creative/runtime/creative-patches-v58-new-entry-current-map.js; assets/*.webp | cmV58NewEntryTransition / #cmV58StartTransition | 旧snapshot→beginEditor、旧復元 | 未移植（r31 runtimeなし） | 1550ms、同じ画像、reduced-motion、実DOM |
| 追加アニメーション | creative/runtime/creative-patches-v48-comet-a-arc.js; creative/jp-creative-patch.js | cmAnimateMarker / comet animate | marker座標、件数、finish、timer | 未移植（r31 runtimeなし） | 合成POI、終了後DOM/timer cleanup |
| 左右利き | creative/base-v7.html; creative/runtime/creative-patches-v13-draggable-fab.js; v45 | setHand / cmEnableFabDrag | HAND旧キーread/write、pointer/touch listener | 未移植（r31 runtimeなし） | 左右body class、配置、旧キーアクセス0 |
| 地図/レイヤー | creative/base-v7.html; creative/runtime/creative-patches-v55-unified-visible.js; v56,v57; runtime/map-engine/*.js | drawAll, renderLayerPanel, cmCandidateShadowPublish | records/groups/renderer所有権、二重描画 | 未移植（r31 runtimeなし） | Session→state→Follower→Scene→KeyedRenderer→単一Leaflet |
| Undo/Redo | creative/base-v7.html; runtime/runtime-vnext.html; v68 | undo, redo, hist, pushHistory | 旧undoStack/redoStack、draft/確定履歴の区別 | 未移植（r31 runtimeなし） | 確定だけ履歴、取消不変、既存全編集拒否 |
| Safariジェスチャー | creative/runtime/runtime-vnext.html; v30,v33,v56 | unsafeDoubleTapTarget, capture pointerup/click, MutationObserver | 二重送信とイベント/observer解除 | 未移植（r31 runtimeなし） | ダブルタップ、pinch、連続操作、解除、Safari実機別 |
| 通常JP処理 | creative/jp-creative-patch.js | applyCreativeJpPatch, cmJpFieldFollowupRuntime | 上限・既存編集・申請コメント・移動の副作用 | 未移植（r31 runtimeなし） | Next正式上限、既存はadapterで全編集拒否 |
| Bridge専用 | creative/bridge-project-patch.js; creative/bridge-distance-stale-patch.js; creative/wayfarer-*.js | applyCreativeBridge* / applyCreativeWayfarer* | 認証・連携・sessionStorageは対象外 | 未移植（r31 runtimeなし） | 通常組立inputsに含まないこと |

v番号略記はPATCH_FILES掲載のcreative/runtime/creative-patches-v*.jsを指す。いずれの要素もr31完成とは判定していない。

## 実適用順（通常65本）

1. creative/runtime/creative-patches-v2.js
2. creative/runtime/creative-patches-v3.js
3. creative/runtime/creative-patches-v4.js
4. creative/runtime/creative-patches-v5-design-check.js
5. creative/runtime/creative-patches-v6-intuitive.js
6. creative/runtime/creative-patches-v9-return-main.js
7. creative/runtime/creative-patches-v10-save-labels.js
8. creative/runtime/creative-patches-v13-draggable-fab.js
9. creative/runtime/creative-patches-v14-layer-tap-layout.js
10. creative/runtime/creative-patches-v18-preview-crosshair.js
11. creative/runtime/creative-patches-v19-persistent-crosshair.js
12. creative/runtime/creative-patches-v20-radius-gauge-save-return.js
13. creative/runtime/creative-patches-v21-radius-swipe.js
14. creative/runtime/creative-patches-v23-add-mode-close.js
15. creative/runtime/creative-patches-v24-confirm-vertical-radius.js
16. creative/runtime/creative-patches-v25-radius-handle-no-preview.js
17. creative/runtime/creative-patches-v26-compact-radius-bar.js
18. creative/runtime/creative-patches-v27-dot-handle-bar.js
19. creative/runtime/creative-patches-v28-lever-handle.js
20. creative/runtime/creative-patches-v29-lever-notches.js
21. creative/runtime/creative-patches-v30-lever-gesture-lock.js
22. creative/runtime/creative-patches-v32-poi-move-isolated.js
23. creative/runtime/creative-patches-v33-action-wiring.js
24. creative/runtime/creative-patches-v34-placement-core.js
25. creative/runtime/creative-patches-v35-nearest-poi-warning.js
26. creative/runtime/creative-patches-v36-compact-move-bar.js
27. creative/runtime/creative-patches-v37-bottom-dock.js
28. creative/runtime/creative-patches-v38-circle-layer-import.js
29. creative/runtime/creative-patches-v39-layer-panel-top.js
30. creative/runtime/creative-patches-v40-recent-filename.js
31. creative/runtime/creative-patches-v41-save-output-wiring.js
32. creative/runtime/creative-patches-v42-save-button-hardbind.js
33. creative/runtime/creative-patches-v43-save-standalone.js
34. creative/runtime/creative-patches-v44-lab-update-3-lines.js
35. creative/runtime/creative-patches-v45-unified-map-ui.js
36. creative/runtime/creative-patches-v46-field-feedback-polish.js
37. creative/runtime/creative-patches-v48-comet-a-arc.js
38. creative/runtime/creative-patches-v49-remove-add-text.js
39. creative/runtime/creative-patches-v50-add-crosshair-cleanup.js
40. creative/runtime/creative-patches-v51-coordinate-jump.js
41. creative/runtime/creative-patches-v52-existing-new-placement.js
42. creative/runtime/creative-patches-v53-new-poi-auto-memo.js
43. creative/runtime/creative-patches-v54-coordinate-memo-reason.js
44. creative/runtime/creative-patches-v55-unified-visible.js
45. creative/runtime/creative-patches-v56-unified-interaction.js
46. creative/runtime/creative-patches-v57-dev-default-unified.js
47. creative/runtime/creative-patches-v58-new-entry-current-map.js
48. creative/runtime/creative-patches-v59-help-button.js
49. creative/runtime/creative-patches-v60-rules-carousel.js
50. creative/runtime/creative-patches-v61-saved-session-hint.js
51. creative/runtime/creative-patches-v62-remove-locate.js
52. creative/runtime/creative-patches-v63-remove-workspace-save.js
53. creative/runtime/creative-patches-v64-google-form-coordinates.js
54. creative/runtime/creative-patches-v65-download-label.js
55. creative/runtime/creative-patches-v66-activity-range-label.js
56. creative/runtime/creative-patches-v67-activity-range-wording.js
57. creative/runtime/creative-patches-v68-activity-range-delete-history.js
58. creative/runtime/creative-patches-v69-spacing-reason-flow.js
59. creative/runtime/creative-patches-v70-unified-move-feedback.js
60. creative/runtime/creative-patches-v71-memo-sheet-download-fixes.js
61. creative/runtime/creative-patches-v73-production-visual-fixes.js
62. creative/runtime/creative-patches-v74-tools-phase-b.js
63. creative/runtime/creative-patches-v75-poi-add-phase-c.js
64. creative/runtime/creative-patches-v76-radius-reference-ui.js
65. creative/runtime/creative-patches-v77-phase-e-ux.js

追加通常処理: creative/jp-creative-patch.js。

## ソース指紋

| ソース | SHA-256（Git配信LF） |
| --- | --- |
| creative/runtime/creative-patches-v2.js | 83de735b0ca992f72336988e67bf3191176cdb581678b437c478fa8c00c5603c |
| creative/runtime/creative-patches-v3.js | 3ba88c2f2c3734f0f110304d82410799b44e8f12f68d2c88c2f1881e4b2795db |
| creative/runtime/creative-patches-v4.js | 660fd42eef0fe3414e113da69f2aac6187330ebc624f5b2702cae2f9d531a837 |
| creative/runtime/creative-patches-v5-design-check.js | 5dc1bb49c239db0581109d151a55bdf9902037ce66256994788bd3f36e652e64 |
| creative/runtime/creative-patches-v6-intuitive.js | f501199c95c2e5385d59f9fb183948f9a22fcfd58e3b428e30af5a48869a8588 |
| creative/runtime/creative-patches-v9-return-main.js | 07a4e6807378babf015255806a5864c2989aad04f125dd3e7904822bc3032f9f |
| creative/runtime/creative-patches-v10-save-labels.js | 846aa3294e64072e135a54994cd21a56d335a90a2e3afa9008a04e22e9ac3855 |
| creative/runtime/creative-patches-v13-draggable-fab.js | 45ff49cf2a44b523ff470d9df69e898db3745e3fa2ded37915bd1fd998e8a607 |
| creative/runtime/creative-patches-v14-layer-tap-layout.js | 5de992e4f1186e5df19cc4989fd55f20da44ccdc8f5dce069bf5e5069dc688bc |
| creative/runtime/creative-patches-v18-preview-crosshair.js | d64d10c6252fe7c8699159fe3a86ef654ea0abddce4ee1d103690c8b57744a77 |
| creative/runtime/creative-patches-v19-persistent-crosshair.js | e772225891f4394a7cd8c45d2ba6b34925957baa11875200528e6dc1a813a0fd |
| creative/runtime/creative-patches-v20-radius-gauge-save-return.js | ba5ca8777310ee49c31d352fdddef2aeb237327b488795be7e59cf02c77d396d |
| creative/runtime/creative-patches-v21-radius-swipe.js | 7cd30810f924dca1abf2b73466b486c94b14f67c74a50c21cca32ec62e85671b |
| creative/runtime/creative-patches-v23-add-mode-close.js | eeb91ae52dae584694823265372502f27d5e5327bb37feac6e9eedf95d6eaa35 |
| creative/runtime/creative-patches-v24-confirm-vertical-radius.js | 6da7a7f2ebdcbfa14fe2dff9af3c602c42087cda746cbadbc01ff5440aacf50b |
| creative/runtime/creative-patches-v25-radius-handle-no-preview.js | 864cd386e2ed9b9f8be8765eb9038f89ec4f95aca806a42df8d5c5ea6d981471 |
| creative/runtime/creative-patches-v26-compact-radius-bar.js | b0e4c0fe0eed2bf31960557909d015eb6ded4aca40bf1f224b3cef8ddf195388 |
| creative/runtime/creative-patches-v27-dot-handle-bar.js | 569becab6473dfb281d601bd3157f0ddc34a6303467a91308625c145a92cd1fc |
| creative/runtime/creative-patches-v28-lever-handle.js | 507de8d8c89d8af09bc4532ae17d835d9a7b6ff0219201bdfb8a30c7013ba029 |
| creative/runtime/creative-patches-v29-lever-notches.js | d51faef98af1bf45746297b7756570bfe1f6b8547f5d48e1289089d7f64e4a89 |
| creative/runtime/creative-patches-v30-lever-gesture-lock.js | 2d30ee07aaa3f5cbc3958e16a380dda8d0205eb1817d7eaafda03f645269dd25 |
| creative/runtime/creative-patches-v32-poi-move-isolated.js | 0a58939032e0608adb428d39333af020eb9ecc58ce159a9a2738231fbdd6062c |
| creative/runtime/creative-patches-v33-action-wiring.js | 9deec795a96c96c1e945d975424a450b9df0fe7ac1c35037c364ca91e8ccee64 |
| creative/runtime/creative-patches-v34-placement-core.js | 7043ca727fd7f61c71f1cc4f9e18cfa5c6953247176997384630e3b5fc1c90d0 |
| creative/runtime/creative-patches-v35-nearest-poi-warning.js | 80d35cd1ef8b0256cd550340577934e626f63e30297cf844a877c3a18f47431c |
| creative/runtime/creative-patches-v36-compact-move-bar.js | 4997c7c59f2f263ece559d1e18d54b21b561234ccc5bb4f7fe621f97ecdd0ba2 |
| creative/runtime/creative-patches-v37-bottom-dock.js | 7a32ecf7aa08e63e472768d924341873315d911a3810469d47c24831847c8bb9 |
| creative/runtime/creative-patches-v38-circle-layer-import.js | cd4e674633b4d5e444ae2aad8b7e5d360968139e2980fa48430eb7003d611601 |
| creative/runtime/creative-patches-v39-layer-panel-top.js | 6337b681e1062bccefab866d56e634d96989ee4c19d2ac69f9c7bc7843786a26 |
| creative/runtime/creative-patches-v40-recent-filename.js | 19acda0059cf82a6b6a7c00f67981698983ae77a545de58c17e531a5e73e227b |
| creative/runtime/creative-patches-v41-save-output-wiring.js | acb9013d43177230b2df1ef8d2849b4b90825777f716f13d5b8d8b0b742e3f40 |
| creative/runtime/creative-patches-v42-save-button-hardbind.js | cf87b62d7e7d2f0fdca1628859f2e728a1b2001976b1076b25a9f66c74fdccee |
| creative/runtime/creative-patches-v43-save-standalone.js | 618ef230e45ac1f3ccd5b3bc46a203d6dbf41506e59ee55d8ae78a5886fe3c46 |
| creative/runtime/creative-patches-v44-lab-update-3-lines.js | 9e342f4d798afdb69704a84396a77654996e92b5c0ab1d430541afd1c71d5017 |
| creative/runtime/creative-patches-v45-unified-map-ui.js | 8b8c8ad27cd2399a44a7981b2f4a8b78a1c8411938974013079da71948d1df37 |
| creative/runtime/creative-patches-v46-field-feedback-polish.js | 9e94010766ccbc6b93269a36d2eb9d36e96254fe2d4b47cd2011894b9dbd028f |
| creative/runtime/creative-patches-v48-comet-a-arc.js | 2d56b72e30ef2db28ac04d6758190b022b9342835896500ceba18e21b7160257 |
| creative/runtime/creative-patches-v49-remove-add-text.js | 11c369d178757e403ded07b6f7092f67c5fe14cff2b238e5312fd4f8ca077561 |
| creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | 76fb128572e9ff2ec1eb9f3b4c007a3da7c6adfed8f9ff74a8d088d49875d6d5 |
| creative/runtime/creative-patches-v51-coordinate-jump.js | 37c0eb6ee275c44bd0dd11816821ed2072681aba1192c0b210176c518f76e523 |
| creative/runtime/creative-patches-v52-existing-new-placement.js | 61db759089ffb79097253a6a899616732a36610747fdc176b951e00f8bef30c5 |
| creative/runtime/creative-patches-v53-new-poi-auto-memo.js | c32c19ec2a8d3e7d3ca8d17fbdeab89f6e0a324dd9c4eb4bc241fecbfde1f9da |
| creative/runtime/creative-patches-v54-coordinate-memo-reason.js | e93b8378cdb9af88c6a46f034c9e9b7cbd11bb76feda73ae9927e11852a31f3e |
| creative/runtime/creative-patches-v55-unified-visible.js | 76b9f11dc7e397aef5048d8d9dfe61153a5e7bc0d2a1c8bf3df549bdd09159a9 |
| creative/runtime/creative-patches-v56-unified-interaction.js | 1507479e607e3afded081fbc83d252c594e09d3156575be8431bd61328c23aa1 |
| creative/runtime/creative-patches-v57-dev-default-unified.js | 2d9d84211b1f9c7875ab27e0d186a829a0ab8abfcb7bc15353d2a8c97ee08e92 |
| creative/runtime/creative-patches-v58-new-entry-current-map.js | 5aa3eeab6de4c0ff4cdcdbc9f1f0f6a649b9565c53272523775a488942c3c6dd |
| creative/runtime/creative-patches-v59-help-button.js | 8ab6af80daa0f6a6dc829e1efe13942734ba7e1a2e2d5b27c2cf497665fb3ff5 |
| creative/runtime/creative-patches-v60-rules-carousel.js | 484a313a7ebdc1d1e8b0c427882584387c73899310f754ee5daba5b6e124442f |
| creative/runtime/creative-patches-v61-saved-session-hint.js | f26eebbf0a9116a533352fc9a50c3fd7b84e2c556aef668d69f03b8fbbf55074 |
| creative/runtime/creative-patches-v62-remove-locate.js | f50cc65a4e55fcd4ff474af92358ed9711a2da9863391aef6d31c8840d21720e |
| creative/runtime/creative-patches-v63-remove-workspace-save.js | de8e9c98f13989531e7943bf907f6c7a7e8279fee762bcff19f5469712f79398 |
| creative/runtime/creative-patches-v64-google-form-coordinates.js | 48a6d90d76d9df8dcfd84ac717d11a7a0d022fefc5277e8f497091ccf7e223fc |
| creative/runtime/creative-patches-v65-download-label.js | 77f49d2c09e3ad998920d791b9f667bd92640750e7d2d913855c2619f625d3bc |
| creative/runtime/creative-patches-v66-activity-range-label.js | 12ce9364aabc5938f3b8033d4451963e79dc868ec63386b4bd02a645eaa2ad7c |
| creative/runtime/creative-patches-v67-activity-range-wording.js | 10f2aaaa55aab473fd329feadac126d24e11942f7da5420d28b4000dde6bd163 |
| creative/runtime/creative-patches-v68-activity-range-delete-history.js | bfad4607257a95c7e9fe93b57051cdf92e11f51095a7effd8566554f7b8ae18c |
| creative/runtime/creative-patches-v69-spacing-reason-flow.js | 0b97b5ca263a94df6e6bec456a190884cb74eadcb64bee1346390b363620b09f |
| creative/runtime/creative-patches-v70-unified-move-feedback.js | a156507f323ba9a9fdf6f841f812f32db814d78f8a747d082e856938781cb7a4 |
| creative/runtime/creative-patches-v71-memo-sheet-download-fixes.js | fadedcee37001d39ddf44b6c88cc03d256d8722550445c6de727b11f32b545a1 |
| creative/runtime/creative-patches-v73-production-visual-fixes.js | a50df3ae3258d483bf9c74dd5720525f6ce78c5a35cb145f55de5c8513daeada |
| creative/runtime/creative-patches-v74-tools-phase-b.js | 1b1b78b903b06d1263b5296d2f42835c212bea81b89e3d593f8364ea0c81005e |
| creative/runtime/creative-patches-v75-poi-add-phase-c.js | 6f8f3d4726d7de7df9a0e54db761dcdd8e06776ff323766ce6897c359540c075 |
| creative/runtime/creative-patches-v76-radius-reference-ui.js | bf39997a2823c6ef5ec7465569d33641bebf58facf8bba4ea60980a6093cc837 |
| creative/runtime/creative-patches-v77-phase-e-ux.js | ae191bb91a425cf92790caccbbc52dc425423a77ddad81e11110a6ca91400fca |
| creative/jp-creative-patch.js | 317577114919e41284eed6565281cdb61cdb630f1ed6234099697176f3e36bb7 |
| creative/base-v7.html | bdec3ee7d73223423751c3c67c59c076bafa77f4f8d47713a88c8fd5435be981 |
| creative/runtime/runtime-vnext.html | 01f71b4e8c639c212657c7b9e8cff7ce96a9429b2291c359b4c26aa3167b27fd |
| creative/index.html | 0d7c2df950f15de5f6736f8c64643424634846d278c79b018342ad2ef1cc0ab1 |

## 最終documentの関数定義

369定義、混在候補46件。関数名による保守的な伝播であり、字句スコープ・alias・動的呼出しの完全証明ではない。UNPROVENも実行を許可しない。匿名イベント、CSS文字列、外部rendererは上表と実行時比較で補完する。

sourceは関数本文の最終変換元。lineは組立後script内の位置であり、元ファイル行番号ではない。

| 関数 | 最終変換元 | script:line | 分類 | 副作用/依存 | 移植先 | 検証 |
| --- | --- | --- | --- | --- | --- | --- |
| msg | creative/base-v7.html | production-core:12 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| closeMenus | creative/base-v7.html | production-core:13 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| setHand | creative/base-v7.html | production-core:14 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:14 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:14 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| esc | creative/base-v7.html | production-core:15 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| explicitLayer | creative/base-v7.html | production-core:16 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| inferLayer | creative/base-v7.html | production-core:17 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV77SyncActivityHint | creative/runtime/creative-patches-v77-phase-e-ux.js | production-core:18 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderLayerPanel | creative/runtime/creative-patches-v77-phase-e-ux.js | production-core:26 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:38 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:57 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:70 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| recordIcon | creative/runtime/creative-patches-v73-production-visual-fixes.js | production-core:80 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| drawRecord | creative/jp-creative-patch.js | production-core:102 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| editRecordView | creative/base-v7.html | production-core:103 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:103 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| recordPopup | creative/base-v7.html | production-core:104 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:104 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:104 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:104 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| mp.onclick | creative/base-v7.html | production-core:104 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererVisible | creative/jp-creative-patch.js | production-core:106 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowDisplayState | creative/runtime/creative-patches-v54-coordinate-memo-reason.js | production-core:107 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererSyncLegacyMarkers | creative/jp-creative-patch.js | production-core:113 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererRenderLegacyCircles | creative/jp-creative-patch.js | production-core:118 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowSignature | creative/runtime/creative-patches-v54-coordinate-memo-reason.js | production-core:128 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowScene | creative/jp-creative-patch.js | production-core:135 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowPublish | creative/jp-creative-patch.js | production-core:145 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowRender | creative/runtime/creative-patches-v54-coordinate-memo-reason.js | production-core:146 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowTeardown | creative/jp-creative-patch.js | production-core:147 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowEnsure | creative/runtime/creative-patches-v56-unified-interaction.js | production-core:148 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowRefresh | creative/runtime/creative-patches-v54-coordinate-memo-reason.js | production-core:154 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| drawAll | creative/jp-creative-patch.js | production-core:155 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_MAP_RENDER, LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| circleOpts | creative/base-v7.html | production-core:156 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderRecordCircles | creative/jp-creative-patch.js | production-core:157 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| creativeAdditionalRecords | creative/runtime/creative-patches-v5-design-check.js | production-core:159 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| creativeUnder50Signature | creative/runtime/creative-patches-v5-design-check.js | production-core:160 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| creativeRefreshDesignReviews | creative/runtime/creative-patches-v5-design-check.js | production-core:161 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| ensureCreativeDesignCheck | creative/runtime/creative-patches-v5-design-check.js | production-core:162 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderCreativeDesignCheck | creative/runtime/creative-patches-v5-design-check.js | production-core:163 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpAdditionalRecords | creative/jp-creative-patch.js | production-core:167 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpTypeLimit | creative/jp-creative-patch.js | production-core:168 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpTypeCount | creative/jp-creative-patch.js | production-core:169 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpTypeLimitMessage | creative/jp-creative-patch.js | production-core:170 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpCheckTypeCapacity | creative/jp-creative-patch.js | production-core:171 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpCanAddLayer | creative/jp-creative-patch.js | production-core:172 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpCanChangeType | creative/jp-creative-patch.js | production-core:173 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpIssueSignature | creative/jp-creative-patch.js | production-core:174 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| jpRefreshReviews | creative/jp-creative-patch.js | production-core:175 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| ensureJpGuide | creative/jp-creative-patch.js | production-core:176 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderJpGuide | creative/jp-creative-patch.js | production-core:177 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| snapshot | creative/jp-creative-patch.js | production-core:178 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| pushHistory | creative/base-v7.html | production-core:179 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY | 未移植 | 境界+DOM/CSS/操作比較待ち |
| hist | creative/runtime/runtime-vnext.html | production-core:179 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| draftIcon | creative/base-v7.html | production-core:180 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| circlesAt | creative/base-v7.html | production-core:181 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| placementMode | creative/base-v7.html | production-core:182 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| updateDraftCircles | creative/base-v7.html | production-core:183 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| nearestRecord | creative/base-v7.html | production-core:184 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| updateNearestHint | creative/base-v7.html | production-core:185 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| clearDraft | creative/base-v7.html | production-core:186 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| addDraft | creative/jp-creative-patch.js | production-core:187 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| add.onclick | creative/base-v7.html | production-core:187 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| close.onclick | creative/jp-creative-patch.js | production-core:187 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_HISTORY, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| openDraftForm | creative/runtime/creative-patches-v5-design-check.js | production-core:188 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:188 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| beginMove | creative/runtime/creative-patches-v5-design-check.js | production-core:189 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| save.onclick | creative/runtime/creative-patches-v5-design-check.js | production-core:189 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| close.onclick | creative/jp-creative-patch.js | production-core:189 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| fixedPolyIcon | creative/base-v7.html | production-core:191 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| removePolyAction | creative/base-v7.html | production-core:192 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| removePolyCrosshair | creative/base-v7.html | production-core:193 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| ensurePolyCrosshair | creative/base-v7.html | production-core:194 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| ensurePolyAction | creative/runtime/creative-patches-v67-activity-range-wording.js | production-core:195 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:195 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| x.onclick | creative/runtime/creative-patches-v67-activity-range-wording.js | production-core:195 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_HISTORY, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| clearPolyDraft | creative/base-v7.html | production-core:196 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| centerHitsStart | creative/base-v7.html | production-core:197 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| refreshPolyNodes | creative/base-v7.html | production-core:198 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| updatePolyPreview | creative/runtime/creative-patches-v67-activity-range-wording.js | production-core:199 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| addPolygonPoint | creative/runtime/runtime-vnext.html | production-core:200 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_HISTORY, LEGACY_MAP_RENDER, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| beginCrosshairPolygon | creative/runtime/runtime-vnext.html | production-core:201 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| finishPolygon | creative/runtime/creative-patches-v67-activity-range-wording.js | production-core:202 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| clearRuler | creative/runtime/creative-patches-v74-tools-phase-b.js | production-core:203 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| beginRuler | creative/runtime/creative-patches-v74-tools-phase-b.js | production-core:204 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_HISTORY, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| exit.onclick | creative/runtime/creative-patches-v74-tools-phase-b.js | production-core:204 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_HISTORY, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| closePolygonToolMenu | creative/runtime/runtime-vnext.html | production-core:205 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| clearPolygonDeleteAction | creative/runtime/runtime-vnext.html | production-core:205 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| clearPolygonDeleteMode | creative/runtime/runtime-vnext.html | production-core:205 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| beginAnotherPolygon | creative/runtime/creative-patches-v74-tools-phase-b.js | production-core:205 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| showPolygonDeleteConfirm | creative/runtime/creative-patches-v68-activity-range-delete-history.js | production-core:205 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| d.onclick | creative/runtime/creative-patches-v68-activity-range-delete-history.js | production-core:205 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:205 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| beginPolygonDeleteMode | creative/runtime/creative-patches-v67-activity-range-wording.js | production-core:205 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| openPolygonChoice | creative/runtime/creative-patches-v74-tools-phase-b.js | production-core:205 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| a.onclick | creative/runtime/creative-patches-v74-tools-phase-b.js | production-core:205 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| selectTool | creative/jp-creative-patch.js | production-core:205 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderTools | creative/runtime/runtime-vnext.html | production-core:206 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_HISTORY | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:206 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:206 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:207 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:207 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:207 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:207 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| showCurrent | creative/base-v7.html | production-core:208 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| stopLocationWatch | creative/base-v7.html | production-core:209 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| startHighAccuracyLocation | creative/base-v7.html | production-core:210 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| byId | creative/base-v7.html | production-core:211 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| undo | creative/runtime/creative-patches-v68-activity-range-delete-history.js | production-core:211 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| redo | creative/runtime/creative-patches-v68-activity-range-delete-history.js | production-core:211 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| readFile | creative/base-v7.html | production-core:212 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| folder | creative/base-v7.html | production-core:213 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| child | creative/base-v7.html | production-core:213 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| parseCoordList | creative/base-v7.html | production-core:214 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| normalizePolygonPoints | creative/base-v7.html | production-core:215 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| addParsedPolygon | creative/base-v7.html | production-core:216 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| isActivityPolygon | creative/runtime/creative-patches-v67-activity-range-wording.js | production-core:217 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmReadImportedCircleLayers | creative/runtime/creative-patches-v38-circle-layer-import.js | production-core:218 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCircleLayerEnabled | creative/runtime/creative-patches-v38-circle-layer-import.js | production-core:229 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmToggleCircleLayer | creative/runtime/creative-patches-v38-circle-layer-import.js | production-core:230 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmIsCircleDummyRecord | creative/runtime/creative-patches-v38-circle-layer-import.js | production-core:238 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV71NormalizeMemo | creative/runtime/creative-patches-v71-memo-sheet-download-fixes.js | production-core:241 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| parse | creative/runtime/creative-patches-v71-memo-sheet-download-fixes.js | production-core:264 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| csvRows | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| csvPick | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| loadCsvFiles | creative/runtime/creative-patches-v2.js | production-core:265 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| exportLayerCount | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| estimatedKmlBytes | creative/runtime/runtime-vnext.html | production-core:265 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_KMZ, LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| creativeFileName | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| creativeFileType | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| isKmzFile | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| isCsvFile | creative/runtime/runtime-vnext.html | production-core:265 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV58NewEntryTransition | creative/runtime/creative-patches-v58-new-entry-current-map.js | production-core:265 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| beginEditor | creative/runtime/creative-patches-v5-design-check.js | production-core:273 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| entryFile.onchange | creative/runtime/runtime-vnext.html | production-core:273 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| start.onclick | creative/jp-creative-patch.js | production-core:273 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| restore | creative/jp-creative-patch.js | production-core:274 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| resume.onclick | creative/jp-creative-patch.js | production-core:274 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:274 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| makeEl | creative/base-v7.html | production-core:275 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| directName | creative/base-v7.html | production-core:276 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| circleCoords | creative/base-v7.html | production-core:277 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| appendDistanceFolder | creative/base-v7.html | production-core:278 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| buildMyMapsKml | creative/jp-creative-patch.js | production-core:279 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| closeSaveChooser | creative/runtime/creative-patches-v73-production-visual-fixes.js | production-core:281 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| downloadKmzBlob | creative/base-v7.html | production-core:282 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| shareableKmzFile | creative/base-v7.html | production-core:283 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| showSaveChooser | creative/runtime/creative-patches-v73-production-visual-fixes.js | production-core:284 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| choose.onclick | creative/base-v7.html | production-core:284 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| download.onclick | creative/base-v7.html | production-core:284 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| close.onclick | creative/jp-creative-patch.js | production-core:284 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| exportKmz | creative/base-v7.html | production-core:285 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_KMZ, LEGACY_PERSISTENCE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| labPill.onclick | creative/runtime/runtime-vnext.html | production-core:285 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| labClose.onclick | creative/runtime/runtime-vnext.html | production-core:285 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:285 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_KMZ, LEGACY_PERSISTENCE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmIsNew | creative/runtime/creative-patches-v6-intuitive.js | production-core:296 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmActiveNew | creative/runtime/creative-patches-v6-intuitive.js | production-core:297 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmTypeLabel | creative/runtime/creative-patches-v6-intuitive.js | production-core:298 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmJst | creative/runtime/creative-patches-v6-intuitive.js | production-core:299 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmStripRecord | creative/runtime/creative-patches-v6-intuitive.js | production-core:300 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmStripPolygon | creative/runtime/creative-patches-v6-intuitive.js | production-core:301 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmNewWorkspaceId | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:302 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmBridgeWorkspaceId | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:306 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmEnsureWorkspaceId | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:314 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmWorkspaceIdFromKml | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:319 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmStampWorkspaceId | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:330 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmWorkspacePayload | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:341 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmPersistCurrent | creative/runtime/creative-patches-v6-intuitive.js | production-core:342 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmReadCurrent | creative/runtime/creative-patches-v6-intuitive.js | production-core:343 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmReadHistory | creative/runtime/creative-patches-v6-intuitive.js | production-core:344 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmArchiveWorkspace | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:345 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmArchiveCurrent | creative/runtime/creative-patches-v6-intuitive.js | production-core:346 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmLoadWorkspace | creative/runtime/creative-patches-v71-memo-sheet-download-fixes.js | production-core:347 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRecentItems | creative/runtime/creative-patches-v6-intuitive.js | production-core:348 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRecentDisplayName | creative/runtime/creative-patches-v40-recent-filename.js | production-core:349 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRenderRecent | creative/runtime/creative-patches-v40-recent-filename.js | production-core:355 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:376 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMigrateLegacyStore | creative/runtime/creative-patches-v6-intuitive.js | production-core:380 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallEntryHistory | creative/runtime/creative-patches-v6-intuitive.js | production-core:381 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmNextSeq | creative/runtime/creative-patches-v6-intuitive.js | production-core:382 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmAutoName | creative/runtime/creative-patches-v6-intuitive.js | production-core:383 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmEnsureMetadata | creative/runtime/creative-patches-v6-intuitive.js | production-core:384 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmNearest | creative/runtime/creative-patches-v6-intuitive.js | production-core:385 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmWarning | creative/runtime/creative-patches-v6-intuitive.js | production-core:386 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmHaptic | creative/runtime/creative-patches-v6-intuitive.js | production-core:387 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmAddStyle | creative/runtime/creative-patches-v6-intuitive.js | production-core:388 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmClearSelectedCircle | creative/runtime/creative-patches-v6-intuitive.js | production-core:391 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmShowSelectedCircle | creative/runtime/creative-patches-v6-intuitive.js | production-core:392 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRecordIcon | creative/runtime/creative-patches-v6-intuitive.js | production-core:393 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| drawRecord | creative/jp-creative-patch.js | production-core:395 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderRecordCircles | creative/jp-creative-patch.js | production-core:396 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| drawAll | creative/jp-creative-patch.js | production-core:404 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCloseSheet | creative/runtime/creative-patches-v6-intuitive.js | production-core:405 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSheetSwipe | creative/runtime/creative-patches-v71-memo-sheet-download-fixes.js | production-core:406 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV69InstallSpacingReason | creative/runtime/creative-patches-v69-spacing-reason-flow.js | production-core:407 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| textarea.oninput | creative/runtime/creative-patches-v69-spacing-reason-flow.js | production-core:428 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenRecord | creative/jp-creative-patch.js | production-core:437 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| name.oninput | creative/runtime/creative-patches-v6-intuitive.js | production-core:437 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| name.onblur | creative/runtime/creative-patches-v6-intuitive.js | production-core:437 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| memo.oninput | creative/runtime/creative-patches-v6-intuitive.js | production-core:437 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:437 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:437 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:437 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:437 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMoveCrosshairElement | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:440 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmShowMoveCrosshair | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:448 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmHideMoveCrosshair | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:452 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMoveLeverOffset | creative/runtime/creative-patches-v36-compact-move-bar.js | production-core:453 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMoveSetRadius | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:454 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMoveLockSurface | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:462 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMoveUnlockSurface | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:470 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmBindMoveLever | creative/runtime/creative-patches-v36-compact-move-bar.js | production-core:474 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallMoveUi | creative/runtime/creative-patches-v36-compact-move-bar.js | production-core:491 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:496 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:497 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRemoveMoveUi | creative/runtime/creative-patches-v35-nearest-poi-warning.js | production-core:500 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmBeginMove | creative/jp-creative-patch.js | production-core:501 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmConfirmMove | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:516 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmEndMove | creative/jp-creative-patch.js | production-core:521 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCancelMove | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:527 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmClearPreview | creative/runtime/creative-patches-v19-persistent-crosshair.js | production-core:528 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmPreviewAt | creative/runtime/creative-patches-v25-radius-handle-no-preview.js | production-core:536 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmAnimateMarker | creative/runtime/creative-patches-v6-intuitive.js | production-core:537 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmShowUndo | creative/runtime/creative-patches-v6-intuitive.js | production-core:538 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:538 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV46FlyStarToCount | creative/runtime/creative-patches-v46-field-feedback-polish.js | production-core:539 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| anim.onfinish | creative/runtime/creative-patches-v46-field-feedback-polish.js | production-core:547 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmPlace | creative/jp-creative-patch.js | production-core:566 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmMapClick | creative/runtime/creative-patches-v32-poi-move-isolated.js | production-core:567 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeAddDotElement | creative/runtime/creative-patches-v34-placement-core.js | production-core:570 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeShowAddDot | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:577 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeHideAddDot | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:581 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeEnsureAddCircle | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | production-core:582 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeRemoveAddCircle | creative/runtime/creative-patches-v34-placement-core.js | production-core:593 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeLeverOffset | creative/runtime/creative-patches-v36-compact-move-bar.js | production-core:598 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeSetAddRadius | creative/runtime/creative-patches-v34-placement-core.js | production-core:599 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeLockAddSurface | creative/runtime/creative-patches-v34-placement-core.js | production-core:606 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeUnlockAddSurface | creative/runtime/creative-patches-v34-placement-core.js | production-core:614 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeBindAddLever | creative/runtime/creative-patches-v36-compact-move-bar.js | production-core:618 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeEnsureNearestWarning | creative/runtime/creative-patches-v35-nearest-poi-warning.js | production-core:636 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeUpdateNearestWarning | creative/runtime/creative-patches-v36-compact-move-bar.js | production-core:646 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeRemoveNearestWarning | creative/runtime/creative-patches-v35-nearest-poi-warning.js | production-core:674 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmPhaseCSelectedPoiMeta | creative/runtime/creative-patches-v75-poi-add-phase-c.js | production-core:678 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmPhaseCSelectedPoiHtml | creative/runtime/creative-patches-v75-poi-add-phase-c.js | production-core:685 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeInstallAddBar | creative/runtime/creative-patches-v76-radius-reference-ui.js | production-core:689 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:694 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:695 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeRemoveAddBar | creative/runtime/creative-patches-v35-nearest-poi-warning.js | production-core:698 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeHideLegacyAddUi | creative/runtime/creative-patches-v34-placement-core.js | production-core:699 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmStartAdd | creative/jp-creative-patch.js | production-core:703 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmExitAddMode | creative/jp-creative-patch.js | production-core:709 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmPhaseCSyncAddMenuCapacity | creative/runtime/creative-patches-v75-poi-add-phase-c.js | production-core:713 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenAddMenu | creative/runtime/creative-patches-v75-poi-add-phase-c.js | production-core:728 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenAddMenuBase | creative/runtime/creative-patches-v75-poi-add-phase-c.js | production-core:740 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCloseAddMenu | creative/runtime/creative-patches-v6-intuitive.js | production-core:741 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmUpdateFab | creative/runtime/creative-patches-v6-intuitive.js | production-core:742 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallFab | creative/runtime/creative-patches-v6-intuitive.js | production-core:743 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:743 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:743 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| selectTool | creative/jp-creative-patch.js | production-core:745 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| addDraft | creative/jp-creative-patch.js | production-core:746 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmUpdateCount | creative/runtime/creative-patches-v6-intuitive.js | production-core:747 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallCount | creative/runtime/creative-patches-v6-intuitive.js | production-core:748 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmListIcon | creative/runtime/creative-patches-v6-intuitive.js | production-core:749 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRow | creative/runtime/creative-patches-v6-intuitive.js | production-core:750 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRenderListPage | creative/runtime/creative-patches-v6-intuitive.js | production-core:751 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:751 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSetListPage | creative/runtime/creative-patches-v6-intuitive.js | production-core:752 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenList | creative/runtime/creative-patches-v6-intuitive.js | production-core:753 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:753 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCloseList | creative/runtime/creative-patches-v6-intuitive.js | production-core:754 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCopy | creative/runtime/creative-patches-v6-intuitive.js | production-core:755 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenCoords | creative/jp-creative-patch.js | production-core:756 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/jp-creative-patch.js | production-core:756 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| reasonInput.oninput | creative/runtime/creative-patches-v54-coordinate-memo-reason.js | production-core:756 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:756 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCloseSaveMenu | creative/runtime/creative-patches-v6-intuitive.js | production-core:757 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmShowReturn | creative/runtime/creative-patches-v20-radius-gauge-save-return.js | production-core:758 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenSaveMenu | creative/runtime/creative-patches-v64-google-form-coordinates.js | production-core:759 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:765 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_KMZ, LEGACY_PERSISTENCE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| back.onclick | creative/runtime/creative-patches-v20-radius-gauge-save-return.js | production-core:768 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| .onclick | creative/jp-creative-patch.js | production-core:771 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmClampFabPosition | creative/runtime/creative-patches-v13-draggable-fab.js | production-core:774 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmApplyFabPosition | creative/runtime/creative-patches-v46-field-feedback-polish.js | production-core:789 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmReadFabPosition | creative/runtime/creative-patches-v13-draggable-fab.js | production-core:798 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSaveFabPosition | creative/runtime/creative-patches-v13-draggable-fab.js | production-core:801 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_PERSISTENCE | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmForceHideAddUi | creative/runtime/creative-patches-v13-draggable-fab.js | production-core:804 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallAddLifecycleFix | creative/runtime/creative-patches-v13-draggable-fab.js | production-core:811 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmStartAdd | creative/jp-creative-patch.js | production-core:817 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmExitAddMode | creative/jp-creative-patch.js | production-core:825 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmDisableAddHints | creative/runtime/creative-patches-v13-draggable-fab.js | production-core:831 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmEnableFabDrag | creative/runtime/creative-patches-v14-layer-tap-layout.js | production-core:846 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallLayerTapStyle | creative/runtime/creative-patches-v14-layer-tap-layout.js | production-core:932 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmBlockPlacementForRadius | creative/runtime/creative-patches-v21-radius-swipe.js | production-core:949 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmApplyGuideRadiusLive | creative/runtime/creative-patches-v21-radius-swipe.js | production-core:952 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmEnableRadiusSwipe | creative/runtime/creative-patches-v25-radius-handle-no-preview.js | production-core:963 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmLeverOffset | creative/runtime/creative-patches-v29-lever-notches.js | production-core:968 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSetLeverVisual | creative/runtime/creative-patches-v28-lever-handle.js | production-core:972 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmBindRadiusHandle | creative/runtime/creative-patches-v30-lever-gesture-lock.js | production-core:976 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallActionWiring | creative/runtime/creative-patches-v75-poi-add-phase-c.js | production-core:1121 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSafeInstallPlacementCore | creative/runtime/creative-patches-v35-nearest-poi-warning.js | production-core:1166 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmSaveActionOnce | creative/runtime/creative-patches-v41-save-output-wiring.js | production-core:1172 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmStopSaveEvent | creative/runtime/creative-patches-v41-save-output-wiring.js | production-core:1177 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmRunKmzExport | creative/runtime/creative-patches-v41-save-output-wiring.js | production-core:1182 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_KMZ, LEGACY_PERSISTENCE, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallSaveOutputWiring | creative/runtime/creative-patches-v41-save-output-wiring.js | production-core:1196 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmHardBindSaveButton | creative/runtime/creative-patches-v42-save-button-hardbind.js | production-core:1237 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCloseStandaloneSave | creative/runtime/creative-patches-v43-save-standalone.js | production-core:1268 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmOpenStandaloneSave | creative/runtime/creative-patches-v64-google-form-coordinates.js | production-core:1271 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallStandaloneSave | creative/runtime/creative-patches-v43-save-standalone.js | production-core:1307 | MIXED_UI_REQUIRES_SEPARATION | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmInstallUi | creative/runtime/creative-patches-v43-save-standalone.js | production-core:1331 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_KMZ, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| start.onclick | creative/jp-creative-patch.js | production-core:1332 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| restore | creative/jp-creative-patch.js | production-core:1333 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| resume.onclick | creative/jp-creative-patch.js | production-core:1333 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| renderRecordCircles | creative/jp-creative-patch.js | production-core:1359 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_MAP_RENDER, LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| drawAll | creative/jp-creative-patch.js | production-core:1360 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| snapshot | creative/jp-creative-patch.js | production-core:1361 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmD11LegacyRendererRequested | creative/runtime/creative-patches-v57-dev-default-unified.js | production-core:1366 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmUnifiedRendererInteractive | creative/runtime/creative-patches-v57-dev-default-unified.js | production-core:1367 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmUnifiedRendererVisible | creative/runtime/creative-patches-v57-dev-default-unified.js | production-core:1377 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererVisible | creative/jp-creative-patch.js | production-core:1387 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmUnifiedRendererFindRecord | creative/runtime/creative-patches-v56-unified-interaction.js | production-core:1388 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmUnifiedRendererActivate | creative/runtime/creative-patches-v56-unified-interaction.js | production-core:1400 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LEGACY_HISTORY, LEGACY_MAP_RENDER, LEGACY_PERSISTENCE, LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowScene | creative/jp-creative-patch.js | production-core:1408 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererSyncLegacyMarkers | creative/jp-creative-patch.js | production-core:1423 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererRenderLegacyCircles | creative/jp-creative-patch.js | production-core:1433 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowPublish | creative/jp-creative-patch.js | production-core:1439 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowTeardown | creative/jp-creative-patch.js | production-core:1449 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateRendererSyncLegacyMarkers | creative/jp-creative-patch.js | production-core:1456 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowPublish | creative/jp-creative-patch.js | production-core:1462 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowTeardown | creative/jp-creative-patch.js | production-core:1467 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowPublish | creative/jp-creative-patch.js | production-core:1474 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmD11LegacyCandidateTarget | creative/runtime/creative-patches-v57-dev-default-unified.js | production-core:1484 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmCandidateShadowScene | creative/jp-creative-patch.js | production-core:1510 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmBeginMove | creative/jp-creative-patch.js | production-core:1523 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmEndMove | creative/jp-creative-patch.js | production-core:1530 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| v45Icon | creative/runtime/creative-patches-v45-unified-map-ui.js | cmV45UnifiedMapUiRuntime:4 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| b.onclick | creative/runtime/creative-patches-v45-unified-map-ui.js | cmV45UnifiedMapUiRuntime:27 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| flashAdd | creative/runtime/creative-patches-v45-unified-map-ui.js | cmV45UnifiedMapUiRuntime:31 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| bindFab | creative/runtime/creative-patches-v45-unified-map-ui.js | cmV45UnifiedMapUiRuntime:36 | EFFECTFUL_REQUIRES_REVIEW | LEGACY_DATA_WRITE, LISTENER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| alignAddHint | creative/runtime/creative-patches-v46-field-feedback-polish.js | cmV46FieldFeedbackRuntime:3 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| bindHint | creative/runtime/creative-patches-v46-field-feedback-polish.js | cmV46FieldFeedbackRuntime:7 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV46FlyStarToCount | creative/runtime/creative-patches-v48-comet-a-arc.js | cmV48CometAArcRuntime:30 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| parseCoordinate | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:7 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| forceMapCenter | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:17 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| findCoordinateNear | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:36 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| ensurePanel | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:53 | MIXED_UI_REQUIRES_SEPARATION | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| positionPanel | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:67 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| openPanel | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:74 | MIXED_UI_REQUIRES_SEPARATION | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| closePanel | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:84 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| applyCoordinate | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:89 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| bindBar | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:106 | MIXED_UI_REQUIRES_SEPARATION | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| button.onclick | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:112 | EFFECTFUL_REQUIRES_REVIEW | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| sync | creative/runtime/creative-patches-v51-coordinate-jump.js | cmV51CoordinateJumpRuntime:116 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| normalizeSourceType | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:7 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| emitSourceChange | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:8 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| commitSource | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:11 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| syncSourceFromActiveLayer | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:16 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| syncVisibleToggle | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:21 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| setSourceType | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:31 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| setKeyboardMode | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:42 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| toggleKeyboardMode | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:62 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| parseCoordinate | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:68 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| syncPanelOpenState | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:79 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| integratedConfirm | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:89 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| decorate | creative/runtime/creative-patches-v52-existing-new-placement.js | cmV52ExistingNewPlacementRuntime:125 | MIXED_UI_REQUIRES_SEPARATION | LISTENER_REQUIRES_TEARDOWN, TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| useNormalKeyboard | creative/runtime/creative-patches-v53-new-poi-auto-memo.js | cmV53DefaultTextKeyboardRuntime:3 | UNPROVEN | 未証明 | 未移植 | 境界+DOM/CSS/操作比較待ち |
| cmV46FlyStarToCount | creative/jp-creative-patch.js | cmJpFieldFollowupRuntime:17 | MIXED_UI_REQUIRES_SEPARATION | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |
| anim.onfinish | creative/jp-creative-patch.js | cmJpFieldFollowupRuntime:36 | EFFECTFUL_REQUIRES_REVIEW | TIMER_REQUIRES_TEARDOWN | 未移植 | 境界+DOM/CSS/操作比較待ち |

## 外部script依存

- https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
- https://unpkg.com/leaflet@1.9.4/dist/leaflet.js
- ./runtime/map-engine/existing-records-adapter.js?v=5d8
- ./runtime/map-engine/existing-records-refresh-store.js?v=5d8
- ./runtime/map-engine/existing-geometry.js?v=5d8
- ./runtime/map-engine/candidate-records-adapter.js?v=5d8
- ./runtime/map-engine/candidate-records-refresh-store.js?v=5d8
- ./runtime/map-engine/candidate-geometry.js?v=5d8
- ./runtime/map-engine/scene-builder.js?v=5d8
- ./runtime/map-engine/candidate-scene-builder.js?v=5d8
- ./runtime/map-engine/map-renderer.js?v=5d15

旧map-engineをそのままr31で起動しない。単一Next Session/Leafletのread-followingへ接続する際に所有権のレビューが必要。
