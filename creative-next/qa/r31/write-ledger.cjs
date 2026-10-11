const fs=require('node:fs'),path=require('node:path');
const {ROOT}=require('./production-source.cjs');
const x=JSON.parse(fs.readFileSync(path.join(__dirname,'source-inventory.json'),'utf8'));
const rows=[
 ['静的HTML/CSS','creative/base-v7.html','HTML, .entry, .panel, .bottom-bar','内包scriptにSTORE・records・履歴・map起動','DOM + 計算済みCSS + ピクセル比較'],
 ['通常起動','creative/index.html; runtime/runtime-vnext.html','PATCH_FILES, runtime文字列変換','認証は比較から除外、Bridgeは別ゲート','runtime→65本→JPの順序'],
 ['動的CSS','creative/runtime/creative-patches-v6-intuitive.js','cmAddStyle / #cmStyle','cmInstallUiから旧保存・メタデータ更新','style生成 + シート/FABの計算済みCSS'],
 ['＋/3種類POI','creative/runtime/creative-patches-v6-intuitive.js; v13,v33,v45,v75','cmInstallFab, cmOpenAddMenu, cmStartAdd, cmEnableFabDrag','捕捉click/pointerup、旧追加先・上限・描画','通常タップ、3 bubble、展開、左右配置、容量境界'],
 ['POI編集シート','creative/runtime/creative-patches-v6-intuitive.js; v69,v71; creative/jp-creative-patch.js','cmOpenRecord, cmCloseSheet, cmSheetSwipe','r.title/memo/layer/deleted、snapshot、cmPersistCurrent','既存閲覧専用、新規30/50文字、種類・削除、スワイプ'],
 ['POI移動','creative/runtime/creative-patches-v32-poi-move-isolated.js; v34,v36,v70','cmBeginMove, cmInstallMoveUi, cmEndMove','旧位置・pushHistory・snapshot・marker','プレビュー不変、確定1回、取消、Undo/Redo'],
 ['追加位置プレビュー','creative/runtime/creative-patches-v34-placement-core.js; v75,v76','cmSafeInstallAddBar, cmSafeEnsureAddCircle, cmSafeBindAddLever','旧コマンド・Leaflet・captureイベント','crosshair、レバー、確定/取消、二重送信なし'],
 ['距離円/参考円','creative/runtime/creative-patches-v20-radius-gauge-save-return.js; v21-v30,v38,v76','cmSetGuideRadius, cmSafeSetAddRadius, cmReadImportedCircleLayers','旧KMZ所有円と表示参考円の区別','owner円保持、参考円独立、元データ不変'],
 ['活動範囲','creative/base-v7.html; runtime/runtime-vnext.html; v68,v74,v77','openPolygonChoice, beginCrosshairPolygon, finishPolygon, showPolygonDeleteConfirm','polygons.push/deleted、旧履歴・snapshot・描画','draft確定/取消、削除・履歴、幾何HOLD'],
 ['ツール/物差し','creative/base-v7.html; creative/runtime/creative-patches-v74-tools-phase-b.js','selectTool, renderTools, clearRuler','mapイベント・旧描画の解除','開閉、2点、終了時listener解除'],
 ['ヘルプ','creative/runtime/creative-patches-v59-help-button.js','#cmV59HelpButton / runtime','DOM生成後v60でhandler更新','DOM存在、位置・タップ領域、ルール開閉'],
 ['ルールカルーセル','creative/runtime/creative-patches-v60-rules-carousel.js','#cmV60RulesPanel / track / dots','スクロール・クリック・開閉listener','3枚、ドット、横スワイプ、閉じる'],
 ['保存メニュー','creative/runtime/creative-patches-v6-intuitive.js; v20,v41-v43,v63-v65,v73','cmOpenSaveMenu, cmInstallStandaloneSave, showSaveChooser','旧exportKmz・snapshot・cmPersistCurrent','元DOM、保護保存HOLD、出力誤成功なし'],
 ['前回データ案内','creative/runtime/creative-patches-v6-intuitive.js; v58,v61','cmInstallEntryHistory, cmRenderRecent, resume.onclick','cmMigrateLegacyStore、旧キーget/set、restore','旧保存アクセス0、新保存の検証と明示承認'],
 ['起動演出/遷移','creative/runtime/creative-patches-v58-new-entry-current-map.js; assets/*.webp','cmV58NewEntryTransition / #cmV58StartTransition','旧snapshot→beginEditor、旧復元','1550ms、同じ画像、reduced-motion、実DOM'],
 ['追加アニメーション','creative/runtime/creative-patches-v48-comet-a-arc.js; creative/jp-creative-patch.js','cmAnimateMarker / comet animate','marker座標、件数、finish、timer','合成POI、終了後DOM/timer cleanup'],
 ['左右利き','creative/base-v7.html; creative/runtime/creative-patches-v13-draggable-fab.js; v45','setHand / cmEnableFabDrag','HAND旧キーread/write、pointer/touch listener','左右body class、配置、旧キーアクセス0'],
 ['地図/レイヤー','creative/base-v7.html; creative/runtime/creative-patches-v55-unified-visible.js; v56,v57; runtime/map-engine/*.js','drawAll, renderLayerPanel, cmCandidateShadowPublish','records/groups/renderer所有権、二重描画','Session→state→Follower→Scene→KeyedRenderer→単一Leaflet'],
 ['Undo/Redo','creative/base-v7.html; runtime/runtime-vnext.html; v68','undo, redo, hist, pushHistory','旧undoStack/redoStack、draft/確定履歴の区別','確定だけ履歴、取消不変、既存全編集拒否'],
 ['Safariジェスチャー','creative/runtime/runtime-vnext.html; v30,v33,v56','unsafeDoubleTapTarget, capture pointerup/click, MutationObserver','二重送信とイベント/observer解除','ダブルタップ、pinch、連続操作、解除、Safari実機別'],
 ['通常JP処理','creative/jp-creative-patch.js','applyCreativeJpPatch, cmJpFieldFollowupRuntime','上限・既存編集・申請コメント・移動の副作用','Next正式上限、既存はadapterで全編集拒否'],
 ['Bridge専用','creative/bridge-project-patch.js; creative/bridge-distance-stale-patch.js; creative/wayfarer-*.js','applyCreativeBridge* / applyCreativeWayfarer*','認証・連携・sessionStorageは対象外','通常組立inputsに含まないこと']
];
const lines=['# r31 現行UIソース台帳','',
 '基準: 2d9f0c472a0263fd4b68044b76bb2a80bb265289。PART AはHOLD。ソース調査であり、移植完了・全依存分離の証明ではない。','',
 '原本は参照専用。runtime-vnextの文字列変換→creative/index.htmlのPATCH_FILES 65本→通常JPを実際の順序で組み立てる。履歴manifestを順序の正本にしない。未掲載v72を追加しない。Bridge専用処理は実行しない。','',
 'CRLFはメモリ内でGit配信のLFへ正規化する。原本変更なし。生成するのは台帳であり、旧アプリをr31として起動しない。','',
 '## 要素別の生成元、依存、移植先、検証','',
 '| 要素 | ソース | 生成関数/DOM | 要分離依存 | 移植先/状態 | 検証 |','| --- | --- | --- | --- | --- | --- |',
 ...rows.map(r=>'| '+r.slice(0,4).join(' | ')+' | 未移植（r31 runtimeなし） | '+r[4]+' |'),'',
 'v番号略記はPATCH_FILES掲載のcreative/runtime/creative-patches-v*.jsを指す。いずれの要素もr31完成とは判定していない。','',
 '## 実適用順（通常65本）','',
 ...x.patchOrder.map((n,i)=>(i+1)+'. creative/runtime/'+n),'',
 '追加通常処理: creative/jp-creative-patch.js。','',
 '## ソース指紋','',
 '| ソース | SHA-256（Git配信LF） |','| --- | --- |',...x.inputs.map(v=>'| '+v.source+' | '+v.sha256+' |'),'',
 '## 最終documentの関数定義','',
 x.definitions.length+'定義、混在候補'+x.blockers.length+'件。関数名による保守的な伝播であり、字句スコープ・alias・動的呼出しの完全証明ではない。UNPROVENも実行を許可しない。匿名イベント、CSS文字列、外部rendererは上表と実行時比較で補完する。','',
 'sourceは関数本文の最終変換元。lineは組立後script内の位置であり、元ファイル行番号ではない。','',
 '| 関数 | 最終変換元 | script:line | 分類 | 副作用/依存 | 移植先 | 検証 |','| --- | --- | --- | --- | --- | --- | --- |',
 ...x.definitions.map(d=>'| '+d.name+' | '+d.source+' | '+d.scriptId+':'+d.line+' | '+d.classification+' | '+(d.transitiveReasons.join(', ')||'未証明')+' | 未移植 | 境界+DOM/CSS/操作比較待ち |'),'',
 '## 外部script依存','',...x.externalScripts.map(d=>'- '+d.src),'',
 '旧map-engineをそのままr31で起動しない。単一Next Session/Leafletのread-followingへ接続する際に所有権のレビューが必要。',''];
fs.writeFileSync(path.join(ROOT,'creative-next/R31_UI_SOURCE_LEDGER.md'),lines.join('\n'));
console.log('Source ledger written: '+x.definitions.length+' definitions, '+x.patchOrder.length+' ordered patches.');
