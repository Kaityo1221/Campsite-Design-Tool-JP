# Creative Next 共通仕様書（正本）
**版**: 2026-10-10 / device-platform parity & functional-integration readiness v4  
**リポジトリ**: `Kaityo1221/Campsite-Design-Tool-JP`  
**開発ブランチ**: `feature/creative-next-kmz-phase1b-20261009`  
**状態**: PO申告では**PC版完成 / Android版完成（iPhone制作で判明する差分は後日追加） / iPhone版制作中**。Creative Next単体のPC隔離回帰PASS、r10 iPhone基本機能・保存/復旧テストおよびr12 葛西/光が丘の承認済みコピーのKMZ変換往復はユーザー報告PASS。**PC/Android/iPhoneの最終仕様整合とWayfarer Map→Creative Mode→Campsite Design Toolの機能間結合E2Eは別途未PASS**。Phase 1-B全体はHOLD、公開・mainマージは未承認。

## 0. 正本と履歴の扱い
この文書を現時点のCreative Next仕様とゲート状態の**唯一の要約正本**とする。個別の`PHASE2_*.md`、`phase-1b/README.md`、`phase-2-preview/README.md`は実装経緯・当時の検証記録を保持するため、「未実装」「ブラウザ未PASS」など古い記述が残る。競合する場合は**本仕様書＋最新のGitHub Actions実行ログ＋実コード**で判定する。承認済みPhase 1-A原本は無断変更しない。以前合意された42項目の完全な原表は本書に再掲していないため、**本書を根拠に42項目すべての最終合格とは宣言しない**。

## 0.1 新フローの3機能間連携ゲート（2026-10-10追加）

- [Wayfarer Map → Creative Mode → Campsite Design Toolの機能間連携・差分台帳](THREE_PLATFORM_ALIGNMENT.md) を**機能連携の付属書**とする。この3つは「3プラットフォーム」ではない。
- Wayfarer Map の基礎仕様は [Wayfarer Observe Flow v1](../docs/wayfarer-observe-flow-spec-v1.md) の凍結事項を尊重する。双方が競合する場合は差分台帳 X-01～X-07 として扱い、合意なしで片方へ寄せない。
- 同じ「ポリゴン」でも、WM-0のプロジェクト正本1個（最大30頂点）とCreative Nextの追加活動範囲（最大64個、各512頂点）を**同一制限とみなさない**。実際の変換ルールは未合意。
- Creative Next単体のKMZ互換性PASSと、`campsiteProject.v1` / Wayfarer観察を含む3機能間連携PASSは**別ゲート**。さらにPC/Android/iPhone環境別のPASSとも別に記録する。
- 実公園KMZの例外整理とユーザー報告PASSは [実KMZ受入記録](phase-1b/REAL_KMZ_ACCEPTANCE_2026-10-10.md) に記録。原本は変更・GitHub公開しない。

## 0.2 PC・Android・iPhone 3プラットフォーム仕様整合ゲート（PO方針 2026-10-10）

- **3プラットフォームとはPC版・Android版・iPhone版**であり、新フローの3機能（Wayfarer/Creative/Campsite）とは別軸。
- [PC・Android・iPhone 共通仕様・差分台帳](PLATFORM_PARITY_PC_ANDROID_IPHONE.md) を**端末/OS別の正規付属書**とする。
- **PC版: 完成**。現在の完成版を基準とし、無断で作り直さない。
- **Android版: 完成**。iPhone制作中に確定した仕様差分・改善点について、必要な項目だけ後から追加する。完成という状態と、iPhone差分がすべて反映済みであることは同義ではない。
- **iPhone版: 制作中**。r10/r12の範囲限定PASSを保持し、残りの安全性・UI・回帰試験を継続。
- 最終ゲート: iPhone→Android差分台帳の採否判定、PCベースラインとの突合、3環境での共通シナリオ回帰を経て、POが承認する。
- 以前の**80%はiPhone/Creative Nextの工程ベース暫定進捗**であり、完成したPC/Androidを含む3プラットフォーム整合率を算出した数値ではない。

## 1. 開発境界と権限
- 新フロー専用: `creative-next/`。CI設定だけは`.github/workflows/creative-next-native-browser.yml`で隔離ブランチのみ対象。
- 実装・検証は隔離ブランチ上。公開`main`、旧Creative Mode、`creative/base-v7.html`、Bridge、Field Mode、DB、既存`next-lab-creative-v7`保存キーは変更・移行・参照しない。
- ユーザー（PO）が仕様/方向性とiPhone実機試験開始・一般公開をそれぞれ明示的に判断する。PC PASSから実機試験やマージ・公開を自動開始しない。
- 実KMZ原本・変換出力・個人情報・認証情報はGitHub/Actions/公開ZIPへ上げない。PC CIで使うKMZは合成テストデータに限る。
- 曖昧な入力や復旧状態は`HOLD / REJECT`、競合は保存拒否。安全性より編集の継続を優先しない。

## 2. 機能と現在の実装
### 2.1 KMZ取込とデータ保護
- KMZ選択→検査（`READY / HOLD / REJECT`）→内容レビュー→**明示的な置換確認**後に初めて隔離編集セッションへ反映。選択・ステージングだけで編集中データを置換しない。
- KML/KMZのパス、CRC、展開容量、Placemark/geometry/metadata、重複ID、所有関係を検証。安全性を証明できない独自構造・穴・高度・不正ポリゴンなどは拒否。
- 葛西旧Creative KMZは**監査可能な形だけ**独立候補へ変換。原座標表記、説明文、未編集XML、ZIP内リソースを保持し、元のアーカイブそのものは変更しない。
- 新形式: NEW_V1。KML 2.2 `ExtendedData`の`campsite.creative.*`、POI内部ID、円のowner/radius、活動範囲`object=activity-area`とarea-idを分離する。元データ由来と新規オブジェクトの識別を維持。
- 編集後KMZはsource-awareに出力し、**出力結果を再ステージング・再診断してからダウンロード**。未知の添付リソースや未変更の元情報を黙って削除しない。
- 新規プロジェクト用のfresh NEW_V1 writerは、元情報を持つ既存データを紛れ込ませない。

### 2.2 POI、距離円、活動範囲
- 既存POIの座標は変更不可。タイトル、メモ、許可された種類の変更をサポート。種類変更は旧layer/Folder/styleの一致を検証できる場合のみ許可。
- 新規POIは追加/移動/削除とUndo/Redo、確認付き地図位置提案。新規POIには所有者付き**50m距離円**を作成。元からある30/40/50m等の所有円はオブジェクトの所有関係に従い連動し、POI削除時は対象円のみ非出力。
- 上限: 既存アクティブPOI **700**、新規アクティブPOI **25**、新規の種類別 **12 / 8 / 5**（ストアで検証）。閾値超過は切り捨てず停止。
- 活動範囲は距離円と別種。検証済みポリゴンの頂点移動・追加・削除、活動範囲丸ごとの新規作成・削除、Undo/Redoをサポート。新規作成は**3～512頂点**、活動範囲数の隔離プレビュー上限は**64**（暫定値）。
- Leaflet 1.9.4 + OpenStreetMapタイル。POI・距離円・活動範囲を独立表示切替。表示OFFはデータ変更ではない。新規POIの地図タップは座標候補だけで未確定変更なし。活動範囲頂点ドラッグはユーザー確認と幾何検査を通す。Leaflet未使用時は簡易位置図/数値入力にフォールバックし、基図と誤称しない。
- 戻る/進むを含むiPhone操作性は実機試験で別途確認。PC Chromium成功をSafariの合格に流用しない。

## 3. 保存・復旧・異常系
- 隔離localStorage名前空間: `campsite-creative-next-v1-preview:*`。2世代スナップショット、SHA-256 checksum、読み返し検証、世代revision、既存POI不動/トゥームストーン保護。
- 保存時は**expectedRevision必須**。複数タブはWeb Locks排他制御、競合する古いrevisionは拒否。Web Locks/暗号/保存領域が不足する環境では、ブラウザ向け保存を安全停止。
- 破損ポインタ時は有効世代の候補を**読むだけ**。利用者が候補を選択・確認した場合のみ、排他ロック下でポインタ復旧。無断採用しない。
- 追加の耐久性チェックポイントはIndexedDBに別格納（`campsite-creative-next-v1-strict-checkpoints`）。`durability:'strict'`を要求し、transaction完了と読返しを確認する。隔離UIはlocalStorageの世代保存後、IndexedDBチェックポイントまで完了して初めて保護された保存成功を案内する。
- IDBが使えない場合は保護保存を停止。出力KMZで独立バックアップを推奨。IndexedDB `strict`は耐久性の**ヒント**であり、絶対保証ではない。ブラウザごとに検証する。
- IndexedDBが`READY`で、通常のlocalStorageジャーナルが`EMPTY`、編集中/取込保留がない場合のみ「バックアップから復元」を表示。ユーザーの確認と元KMZ/POI/エリアの再検証を済ませて復元。キャンセルは無変更。
- localStorageの2世代とIndexedDBの別々の書込は**単一の原子トランザクションではない**。片側失敗や容量不足は完全成功と案内しない。独立KMZ書出とユーザー確認を優先する。
- **2026-10-10の保存競合追加対策**: IndexedDBはSHA-256を検証した事前読取エンベロープ全体とreadwrite取引内の現物を比較し、同じrevisionでもbody/checksum/保存構造が変われば`IDB_CONFLICT`で停止。検証後の破損を無断で上書きしない。専用の実Chromiumレース注入ゲートおよびトランザクション中断注入ゲートを隔離CIに追加（後者のCI合否は最新Actionsログで確認）。iPhone Safari実機では未検証。
- **iPhone隔離検証版 r13（2026-10-10）**: 既存r9/r10/r11/r12の配信ソースおよび保存名前空間を保持し、専用 `iphone-safety-r13/` と `campsite-creative-next-v1-iphone-safety-r13` を追加。さらに独立した `*-r13-lab` 名前空間だけで合成データを用いて、破損ポインタの読取専用保護、模擬容量不足、実Web Locks競合、localStorage実保存、strict IndexedDB保存・再読込を一括検査する。詳細とCI結果は [iPhone r13安全性検証引き継ぎ](IPHONE_R13_SAFETY_ACCEPTANCE_2026-10-10.md) を参照。Chromium自動検査PASSはiPhone Safari実機PASSと別扱い。

## 4. 実証エビデンス（検証種別を混同しない）
### 4.1 葛西原本の非公開ローカル検証
- SHA-256: `1c57f66d8658515ec6959af55044423189fdf5b4c5941d84b9a5466f0ef5d162`。
- **6本の専用回帰スクリプトPASS**。既存188、新規25、距離円213、活動範囲1、付属リソース3件を検証。POI位置保護、追加/削除/種類変更、距離円連動、活動範囲編集/再作成、Undo/Redo、保存/再開、KMZ再出力を確認。
- 原本はprivate扱い。GitHub Actionsへ実ファイルをアップロードしていない。

### 4.2 GitHub Actions 実Chromium・合成KMZ
- 最終PC CI成功: https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/37909258314
- **Node 249件PASS / 0 FAIL**。
- Leaflet本体と実タイル、地図タップ、編集操作、レイヤー切替、POI/距離円/活動範囲、Undo/Redo、localStorage/strict IndexedDB保護保存、復旧、2タブWeb Locks競合、`QuotaExceededError`保存失敗時の元版維持がPASS。
- Chromiumの別プロファイルでIndexedDB strict取引完了後の強制SIGKILL→再起動を**0秒・0.1秒・1秒**で検査しPASS。従来localStorage単独では保存直後SIGKILLで消失した例あり。この観測だけで他ブラウザやあらゆる状況の耐久保証はしない。
- PC操作を一連で実行: 合成KMZ取込→編集→保存→リロード→実KMZ書出→**独立した別ブラウザコンテキスト**で再読込、幅1366px・ページJSエラーなしPASS。
- **PC総合回帰PASS**は「合成KMZの実ブラウザ操作＋葛西原本の別の非公開回帰」という範囲の判定。葛西原本をiPhoneでE2E操作したPASSではない。

## 5. 未判定・現行ゲート（2026-10-10時点）

- **iPhone Safari実機:** r10基本編集、Undo/Redo、保護保存・再開、不正データ拒否はユーザー報告PASS。r12は葛西・光が丘のユーザー承認済み整理コピーに対する旧形式変換→書出→再取込をユーザー報告PASS。ユーザー報告の範囲を越える全面合格宣言はしない。
- **実公園KMZ例外:** 葛西は所有者不明50m円1件、光が丘は50m円完全重複211件を**変換用コピーのみ**から除外。原本や一般のKMZに自動適用しない。詳細は実KMZ受入記録。
- **公開プレビュー:** GitHub Pagesの隔離r9/r10/r11/r12は各試験版を保つ。本番Creative Modeへの接続ではない。Vercel追加ビルドに頻度制限があり、無断連打しない。
- **安全性の残り:** 想定外中断、復旧破損、複数タブ競合等をさらに陰性テストし、実Safariで検証済みでない状況は未PASSと明記する。
- **3プラットフォーム整合:** PC完成・Android完成・iPhone制作中。iPhoneで見つけた差分をAndroidへ後追い反映するため、PC/Android/iPhoneの最終仕様比較・共通回帰は未PASS。詳細は端末/OS別付属書。
- **3機能間連携:** `Wayfarer Map → Creative Mode → Campsite Design Tool` の所有権、ポリゴン、外周参照POI、再観察、保存/受渡しの仕様差分 X-01～X-07がHOLD。結合E2E未PASS。
- **本番:** Phase 1-B/Phase 2全体の正式PASS、旧Creative Mode切替、`main`マージは別途明示承認が必要。未承認。
- **STOP条件:** 元データ移動/消失、原ZIP添付の変化、保存の誤成功表示、認証/権限異常、重大なUI崩れ、不正データの黙認、設計正本の競合が生じれば隔離で修正し、再検証する。

## 6. 参照ファイルと再現
- 隔離UI: `creative-next/phase-2-preview/index.html`
- core/セッション: `creative-next/phase-1a/`、`creative-next/phase-1b/core/`、`creative-next/phase-1b/integration/`
- 保存: `phase-1b/core/journal-save.mjs`、`phase-2-preview/strict-idb-checkpoint.mjs`
- テスト: `node --test creative-next/phase-1b/test/*.test.mjs`
- 実葛西: `creative-next/phase-1b/test/verify-real-kasai*.mjs`（明示的な原本パスを与える。私有データはコミットしない）
- 実Chromium CI: `.github/workflows/creative-next-native-browser.yml`、`creative-next/qa/native-browser-gates.py`、`strict-idb-crash-gate.py`、`strict-idb-ui-gate.py`、`pc-final-regression.py`
- 詳細: `creative-next/PC_FINAL_REGRESSION_REPORT_20261009.md`、`creative-next/PRE_IPHONE_SAFARI_HANDOFF_20261009.md`

## 7. 次作業担当への必須ルール（2026-10-10更新）

1. 本仕様書、PC/Android/iPhone環境差分付属書、機能間連携付属書、実KMZ受入記録、最新CIと実コードを照合する。古いREADMEや日付付き試験レポートの「iPhone未実施」は当時の履歴として扱う。
2. 3プラットフォームとはPC・Android・iPhoneを指す。PC完成を基準とし、iPhoneの変更点は台帳へ追記し、Android完成版への反映要否を検証する。機能間の差分X-01～X-07は別途PO判断を得る。
3. iPhoneでPASSした操作と、未検証のWebKit/3者結合/本番リリースを混同しない。
4. 原本の私有KMZ、変換結果、利用者データを公開リポジトリにアップロードしない。
5. 安全性テストや統合UIは隔離ブランチで進め、POの別途承認まで本番・`main`を変更しない。
