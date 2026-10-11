# r31 PART A 表示専用runtime — 実測ゲート

配信対象ではない。進捗は85% / Phase 1 HOLD。PART B未接続。旧プレビューと本番の入口から参照しない。

## ソースと境界

- index.html: 正式PATCH_FILES 65本と通常JP変換を適用した完成HTMLから、旧scriptとinlineイベントだけを除いた原ソースHTML/CSS。baseは原画像の参照位置を維持するため追加。
- source-templates.mjs: source-ui-compiler.cjsが元ソースからASTで選んだ32個の表示式、動的CSS2個、DOM・style定数を出力。現行unified表示のアイコンも純表示式だけを抽出する。元関数と旧rendererの実行許可ではない。手編集禁止。
- ui-runtime.mjs: 新規接続コード。immutable viewを読んで表示し、表示設定・プレビュー・開閉だけを扱う。元records/履歴/保存/KMZ/描画エンジンとNext Sessionの能力を持たない。
- データ操作はrequest観測境界に到達して必ずHOLD/changed:false。観測者の返値によって成功にしない。保存/復元は別ゲート。
- Leafletは表示専用の1インスタンス。重複mount拒否。disposeでmap/DOM/listener/timer/raf/外部参照を解除。

## 再現

リポジトリ直下から:

    node creative-next/qa/r31/functional-groups.cjs
    node creative-next/qa/r31/source-ui-compiler.cjs
    node creative-next/qa/r31/run-part-a.cjs

QA依存: jszip3.10.1, @xmldom/xmldom0.9.8, acorn8.15.0, leaflet1.9.4, pngjs7.0.0, playwright。CIはChromiumをインストール。WindowsローカルはR31_BROWSER_CHANNEL=msedgeを使用した。

比較側は合成KMZだけを新規ブラウザcontextで読む。元UIはこの隔離した参照側だけで実行する。memory storage、固定タイル、外部通信abort、Service Worker禁止。初期保存状態EMPTYを固定するため参照側のsnapshot/cmPersistCurrent intervalだけを止める。候補側は旧scriptを含まず、保存アクセス0・旧runtimeリクエスト0を検査する。

比較はPC/390px/393pxで52場面ずつ。DOM/CSS/子要素/SVG属性/実カメラと可視領域の全画面画像を比較する。Google pinは取得元・SHA付きの実画像fixture、タイルは固定合成画像。通常click/tapとCDPのネイティブtouchによるswipe/pinchを使い、強制clickは使わない。左右利きは現行v58の設定ボタンが非表示のため表示APIで準備する。markerは表示された現行アイコンを通常clickする。無限animationの位相固定と、時刻を揃えたstar/startupの独立検査を区別する。

半透明パネルと重なる通知は文言・位相を記録し、両側の実フェード完了後の安定した画面を比較する。画像差の許容値は前回と同じ色差2、異なる画素数0。地図の内部DOMにある参照専用の非表示旧レイヤーは移植せず、地図全体の画像と可視図形/操作を比較する。

旧関数実行はブラウザのprecise coverage、保存アクセスは独立storage監視、listenerはEventTarget監視、map生成は独立L.map監視で測る。compileされたscript whitelist/式の再静的検査と369定義のdenyも実施。判定には現ソースfingerprintの一致と333回帰・17監査の実測結果が必要。古い/不足/失敗証拠はHOLD。

## HOLDと禁止範囲

現行で到達可能な活動範囲・物差し・背景/円/レイヤー、保存chooser、一覧/座標、演出/gestureを分離した。活動範囲のdraftとdraft undo/redoは表示状態だけ。確定/削除/描き直し、POI編集、保存/出力、統合座標確定はHOLD/changed:false。保存内容やNext Sessionへ接続しない。disposeはanimationとLeafletのDOM listenerも解除する。

参照の#saveと手動workspace保存は現行で非表示。退役したcmOpenSaveMenuには未定義cmKmzExported依存があるため復活させず、現行standaloneメニューとchooserだけを継承する。

参照側の通常touchで「＋」のpointerupがメニューを開いた直後、合成clickがPowerSpotへ入る問題を記録している。r31はtouchではclick時に開くことで二重入力を防ぐ。この操作差は未承認としてHOLDする。テスト継続用の通常UIリセットは失敗結果をPASSへ変えない。原本・main・旧previewへ修正しない。Safari実機未検証。詳細と最新CIはR31_PART_A_COMPLETION_REPORT.md。

## 最終判定の仕様追加（2026-10-11）

＋の二重イベント防止だけをPO承認済みの操作例外として検査する。R31_PART_A_SPECIFICATION.mdとR31_OPERATION_DIFFERENCES.mdを参照。旧HOLD記録と9 FAILは保持し、独立＋受入および全7グループを現在fingerprintで再測定する。PART A PASSでもPart B/保存/配信は停止し、進捗85% / Phase 1 HOLDを維持する。

最終再測定の結果はR31_PART_A_FINAL_VERDICT.mdを参照。過去のHOLD記述は当時の記録であり、進捗85% / Phase 1 HOLDとPART A表示受入判定を区別する。
