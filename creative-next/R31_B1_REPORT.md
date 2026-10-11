# Creative Next r31 PART B1（2026-10-12）

B1はローカル・リモート専用CIの全ゲートPASS。実装はここで停止する。進捗85% / Phase 1 HOLD。B2/B3/B4、保存・復元、公開配信、main反映は未実施。iPhone Safari実機未検証。

## 凍結基準

PART Aソース109a1b0a6a66dc95ae88de72091f45a3fb611aab、証跡f271cf82d13bcf0b5fe01069cc3a8d0c3318967b、CI38149500935を固定。fingerprint f206ea51801e3a74e69cf7156a6fff803422ebe5af57a500fcb4d1a2ecae75ff。part-a-freeze.jsonでPART A表示ソース・最終証跡・CI設定・既存engine/integration群のSHAを検査。PART Aの原本と証跡JSONを変更しない。

## 変更ファイルと接続

- original-ui-r31-b1/adapter.mjs: 専用POI Adapter。既存Command Boundary/Read Followerをimportし、明示注入された単一の既存Isolated Sessionを使用。Store/履歴/編集engineは複製しない。
- original-ui-r31-b1/ui-runtime.mjsとindex.html: build.cjsで凍結表示controllerへ6接続hookを付けた生成物。HTML/CSS/画像/templateは基準と同じ。元PART A runtimeは未変更。
- original-ui-r31-b1/README.md: 起動・明示確定・拒否・停止契約。
- qa/r31-b1/: freeze/build、6単体検査、3幅実編集、派生表示156場面/333回帰/17監査、まとめ判定と証跡。
- .github/workflows/creative-next-r31-b1.yml: B1限定CI。合成データだけ、配信jobなし。

## 実装済みコマンド

add、edit(title/memo)、move、change-kind、delete、undo、redo。座標の新規確定もaddへ接続。既存/不明/削除済みPOIへの全変更はAdapterで拒否。入力中はdraft、名前Enterまたはfield changeで確認しtrueの時だけedit。確認取消・位置preview・取消は無変更。種類/削除/Undo/Redoは明示clickで確定。

接続にはsourceIsolated、active、pendingなし、revision:null、history0/0の新しい検査済Sessionと単一UI mapを要求する。B1 UIはSession/KMZを自動ロードせず、入口はHostの明示注入だけ。初期ページ単独はHOLD。

request IDを接続期間中保持し二重送信を拒否。確定1件につき履歴1件、follower更新1回。単一Session/Leaflet/履歴、同じrendererでmarker数と状態を検査。外部Session変更と描画失敗は安全停止。描画失敗でengineが変更済みの場合はchanged:trueとHOLDを明示し、成功表示・自動Undo/retryをしない。

## ローカル検証

Windows Edge、390/393/1366pxの合成NEW_V1・独立context・通信遮断・memory storage・force click0。

- B1単体6件PASS: 実Session/store/boundary/follower、既存POI拒否、取消、重複、外部変更、描画失敗、既存上限/文字数/不正field、座標新規のみ。
- 接続後の実操作を3幅でPASS: 追加→名前編集→移動→Undo→Redo→種類変更→削除→Undo、メモ編集、編集確認取消。
- 正常時は初期表示1回+確定9回=表示更新10回。marker2（既存1、新規1）、map生成1、Session1。重複要求拒否、既存record全体不変、保存/復元/KMZ/area要求HOLD。
- 旧関数実行0、保存アクセス0、pageerror0。dispose後UI/map/listener/timer/raf/animation/observerとAdapter listener/draft/Session接続0。
- 描画失敗を実DOM欠落で注入: 変更済みHOLD表示、以降Undo拒否でstate不変。取消フラグを閉じた対象sheetに限定し、次sheetの明示確認を妨げないことも検査。
- B1派生表示codeに対するUI156/156、＋独立9/9、既存333/333、監査17/17 PASS、7グループPASS。これは未接続HOLD fixtureによる表示回帰であり、接続後実編集は別検査。旧PART A JSONはbyte単位で復元し、結果はB1に別保存。

B1 fingerprint: 10dbce16800ef64531a278752625c6a9f0fda80ed209f857fcf91a45e18bf61a
UI派生SHA: 2e829851263ea43109cc5ce2d38a56fdc7472941382623b257d496e2d05d5764

## CIとコミット

検証ソースcommit: 937e00cf15d97528cfbb7e6966b9b602b3c10daa（codex/original-ui-r31へpush済み）。

- [B1専用CI run 38175029950 / attempt 2](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38175029950/attempts/2): SUCCESS。unit6、実編集3幅、UI156/156、＋9/9、回帰333/333、監査17/17、7グループPASS。成果物のsource fingerprintはローカルと一致。
- [凍結PART A専用CI run 38175029888](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38175029888): SUCCESS。
- B1 attempt 1は390px fab-tap-after-dragのDOM比較でHOLD。展開CSS transitionの終端直前（scale 0.999988、位置約0.002px）の測定差。画像差0でもFAILを保持。同一commit・同一code・同一テスト/待機/判定値の全ゲート再実行でattempt 2はPASS。初回FAILと最終CI実測はqa/r31-b1/final-ci-evidence.jsonに別保存。アニメーション終端の測定タイミング依存は残課題。
- 既存のpreview-poi-controls-layout-v2-once.yml / preview-poi-controls-layout-once.ymlはjob未開始のfailure（run38175028302/38175028977）。本変更で修正していないため、repository全CIが緑とは報告しない。

最終CI証跡commitはこの検証済みソースへの報告書/JSON追記だけ。アプリ・検査codeは変更しない。

## 残課題・停止範囲

実データ入力/KMZ prepare・accept・export、保存/復元、活動範囲データ編集、申請理由applicationCommentは未接続HOLD。B2/B3/B4を開始しない。Hostへの実Session供給は今回UIに追加しない。Safari実機/IME/モバイル確認dialogと実ネットワーク画像取得は未検証。PART Aの承認済み＋2段階仕様と9件の参照FAILは保持する。公開preview URLなし。
