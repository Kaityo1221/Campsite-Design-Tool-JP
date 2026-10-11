# r31 機能グループと実行境界

前回監査369定義を保持。46混在/147副作用あり/176未証明を全件分類。原本関数の実行数0。未証明176件は全件実行禁止。

| 機能 | 混在件数 | 全定義 |
| --- | --- | --- |
| 起動・表示設定 | 6 | 137 |
| POI追加 | 8 | 54 |
| POI編集・移動 | 6 | 53 |
| 活動範囲・地図 | 8 | 55 |
| 保存・KMZ | 6 | 41 |
| 一覧・座標・補助 | 8 | 17 |
| アニメーション・操作 | 4 | 12 |

機能別UI抽出は元関数を呼ぶのではなく、ASTで選んだテンプレート式/CSS定数を別途検査して生成する。状態の参照はimmutable view、イベントはUI状態かrequest境界、データ変更/履歴/KMZ/保存はPART A中HOLD。timer/listener/observerは新runtimeのdisposeで解除する。

## 混在46件の依存

| 機能 | 関数 | 最終変換元 | UI | 状態参照/呼出し | イベント | データ | 保存 | timer | 処理 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 起動・表示設定 | msg | creative/base-v7.html | DOM_OR_STYLE_WRITE |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 起動・表示設定 | setHand | creative/base-v7.html | DOM_OR_STYLE_WRITE |  | false | false | true | false | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | renderLayerPanel | creative/runtime/creative-patches-v77-phase-e-ux.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | cmCircleLayerEnabled,cmToggleCircleLayer,layerDefs.forEach,map.hasLayer,map.removeLayer,polygons.filter,renderLayerPanel | true | false | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI編集・移動 | recordPopup | creative/base-v7.html | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | layerDefs.find,layerDefs.map | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | renderCreativeDesignCheck | creative/runtime/creative-patches-v5-design-check.js | DOM_OR_STYLE_WRITE | creativeAdditionalRecords | false | true | false | false | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | renderJpGuide | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE | jpAdditionalRecords | false | true | false | false | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | addDraft | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | layerDefs.find,records.push,updateNearestHint | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | openDraftForm | creative/runtime/creative-patches-v5-design-check.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | creativeAdditionalRecords,layerDefs.find,records.push | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI編集・移動 | beginMove | creative/runtime/creative-patches-v5-design-check.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | updateNearestHint | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | ensurePolyAction | creative/runtime/creative-patches-v67-activity-range-wording.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | updatePolyPreview | creative/runtime/creative-patches-v67-activity-range-wording.js | DOM_OR_STYLE_WRITE | map.removeLayer | false | false | false | false | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | beginRuler | creative/runtime/creative-patches-v74-tools-phase-b.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | showPolygonDeleteConfirm | creative/runtime/creative-patches-v68-activity-range-delete-history.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | polygonDeleteLayers.forEach,renderLayerPanel,x.layer.setStyle | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 活動範囲・地図 | openPolygonChoice | creative/runtime/creative-patches-v74-tools-phase-b.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | polygons.filter,polygons.find,renderLayerPanel | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 起動・表示設定 | start.onclick | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE | exportLayerCount | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 保存・KMZ | buildMyMapsKml | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | layerDefs.forEach,polygons.filter,records.filter | false | false | true | false | 原関数禁止・テンプレート/接続を分離 |
| 保存・KMZ | downloadKmzBlob | creative/base-v7.html | DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 保存・KMZ | showSaveChooser | creative/runtime/creative-patches-v73-production-visual-fixes.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | true | false | true | 原関数禁止・テンプレート/接続を分離 |
| 起動・表示設定 | cmStampWorkspaceId | creative/runtime/creative-patches-v50-add-crosshair-cleanup.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | true | false | 原関数禁止・テンプレート/接続を分離 |
| 起動・表示設定 | cmRenderRecent | creative/runtime/creative-patches-v40-recent-filename.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 起動・表示設定 | cmInstallEntryHistory | creative/runtime/creative-patches-v6-intuitive.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI編集・移動 | cmV69InstallSpacingReason | creative/runtime/creative-patches-v69-spacing-reason-flow.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI編集・移動 | textarea.oninput | creative/runtime/creative-patches-v69-spacing-reason-flow.js | DOM_OR_STYLE_WRITE |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI編集・移動 | cmOpenRecord | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | cmTypeLabel | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI編集・移動 | cmInstallMoveUi | creative/runtime/creative-patches-v36-compact-move-bar.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | cmSafeEnsureNearestWarning,cmSafeUpdateNearestWarning | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | cmShowUndo | creative/runtime/creative-patches-v6-intuitive.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| アニメーション・操作 | cmV46FlyStarToCount | creative/runtime/creative-patches-v46-field-feedback-polish.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | cmSafeInstallAddBar | creative/runtime/creative-patches-v76-radius-reference-ui.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | cmSafeEnsureNearestWarning,cmSafeUpdateNearestWarning | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | cmInstallFab | creative/runtime/creative-patches-v6-intuitive.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | cmRenderListPage | creative/runtime/creative-patches-v6-intuitive.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | cmActiveNew,records.filter | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | cmOpenList | creative/runtime/creative-patches-v6-intuitive.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | cmCopy | creative/runtime/creative-patches-v6-intuitive.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | cmOpenCoords | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | cmActiveNew,cmTypeLabel,nearestRecord | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 保存・KMZ | cmOpenSaveMenu | creative/runtime/creative-patches-v64-google-form-coordinates.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 保存・KMZ | cmOpenStandaloneSave | creative/runtime/creative-patches-v64-google-form-coordinates.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| 保存・KMZ | cmInstallStandaloneSave | creative/runtime/creative-patches-v43-save-standalone.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | true | true | true | 原関数禁止・テンプレート/接続を分離 |
| アニメーション・操作 | flashAdd | creative/runtime/creative-patches-v45-unified-map-ui.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| アニメーション・操作 | cmV46FlyStarToCount | creative/runtime/creative-patches-v48-comet-a-arc.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | ensurePanel | creative/runtime/creative-patches-v51-coordinate-jump.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | openPanel | creative/runtime/creative-patches-v51-coordinate-jump.js | DOM_OR_STYLE_WRITE |  | true | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | applyCoordinate | creative/runtime/creative-patches-v51-coordinate-jump.js | DOM_OR_STYLE_WRITE |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| 一覧・座標・補助 | bindBar | creative/runtime/creative-patches-v51-coordinate-jump.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | true | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | setKeyboardMode | creative/runtime/creative-patches-v52-existing-new-placement.js | DOM_OR_STYLE_WRITE |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | integratedConfirm | creative/runtime/creative-patches-v52-existing-new-placement.js | DOM_OR_STYLE_WRITE |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| POI追加 | decorate | creative/runtime/creative-patches-v52-existing-new-placement.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM | syncPanelOpenState,syncSourceFromActiveLayer | true | false | false | true | 原関数禁止・テンプレート/接続を分離 |
| アニメーション・操作 | cmV46FlyStarToCount | creative/jp-creative-patch.js | DOM_OR_STYLE_WRITE,DYNAMIC_DOM |  | false | false | false | true | 原関数禁止・テンプレート/接続を分離 |

147副作用あり/176未証明の全経路・曖昧呼出しはqa/r31/functional-groups.jsonに記録。名前ベース解析は安全証明ではないので原関数のdenyを維持する。
