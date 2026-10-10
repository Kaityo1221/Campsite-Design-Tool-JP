# Creative Next 共通仕様書（正本）
**版**: 2026-10-10 / protected-preview readiness v2  
**リポジトリ**: `Kaityo1221/Campsite-Design-Tool-JP`  
**開発ブランチ**: `feature/creative-next-kmz-phase1b-20261009`  
**状態**: PC総合回帰PASS。Vercel限定プレビューはSSO有効かつデプロイREADY。iPhone Safari実機E2Eは未PASS。公開・mainマージは未承認。

## 0. 正本と履歴の扱い
この文書を現時点のCreative Next仕様とゲート状態の**唯一の要約正本**とする。個別の`PHASE2_*.md`、`phase-1b/README.md`、`phase-2-preview/README.md`は実装経緯・当時の検証記録を保持するため、「未実装」「ブラウザ未PASS」など古い記述が残る。競合する場合は**本仕様書＋最新のGitHub Actions実行ログ＋実コード**で判定する。承認済みPhase 1-A原本は無断変更しない。以前合意された42項目の完全な原表は本書に再掲していないため、**本書を根拠に42項目すべての最終合格とは宣言しない**。

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

## 5. 未判定とSTOP条件
- **iPhone Safari実機: 未開始・未PASS**。IndexedDB durability、保存容量、タッチ/スクロール、地図ドラッグ、戻る/進む、KMZファイルUI、実機性能は未確認。
- 実機用Vercel限定プレビュー `campsite-creative-next-private-preview` は**作成済み**。2026-10-10時点の隔離ブランチcommit `1d9eed610d785837a5f4a85dd4c12debf2288966` のデプロイ `dpl_42USmXjGcugNXrGH7x98jdYkfv5H` は **READY**、Vercel Authentication (SSO) は有効。候補URL: `https://campsite-creative-next-private-preview-e94khjeg7-kaityo1222.vercel.app/creative-next/phase-2-preview/index.html`。ただし認証後の実ページ到達・iPhone Safari起動成功は**未確認**。このURLは一般公開承認を意味しない。
- Phase 1-B / Phase 2 **全体の正式PASS未判定**。外部My Maps完全往復・全入力形式・42項目網羅は確認できたと断言しない。
- プレビューのテストは、POの明示承認を受けるまで開始しない。公開`main`へのマージ、旧Creative Mode切替、本番デプロイも別の明示承認が必要。
- 実機テスト中に既存データ移動/消失、元ZIP添付の変化、保存の誤成功表示、認証/権限異常、重大画面崩れが生じたら**STOP**し、機密ファイルを公開せず隔離ブランチで修正→PC再試験。
- プレビューの候補URLとSSO保護は確認済み。安全な試験対象KMZ・手順・戻し方とともに、認証後のページ到達から順にiPhone Safari実機を確認する。認証失敗・404・起動エラーならそこでSTOP。

## 6. 参照ファイルと再現
- 隔離UI: `creative-next/phase-2-preview/index.html`
- core/セッション: `creative-next/phase-1a/`、`creative-next/phase-1b/core/`、`creative-next/phase-1b/integration/`
- 保存: `phase-1b/core/journal-save.mjs`、`phase-2-preview/strict-idb-checkpoint.mjs`
- テスト: `node --test creative-next/phase-1b/test/*.test.mjs`
- 実葛西: `creative-next/phase-1b/test/verify-real-kasai*.mjs`（明示的な原本パスを与える。私有データはコミットしない）
- 実Chromium CI: `.github/workflows/creative-next-native-browser.yml`、`creative-next/qa/native-browser-gates.py`、`strict-idb-crash-gate.py`、`strict-idb-ui-gate.py`、`pc-final-regression.py`
- 詳細: `creative-next/PC_FINAL_REGRESSION_REPORT_20261009.md`、`creative-next/PRE_IPHONE_SAFARI_HANDOFF_20261009.md`

## 7. 次作業担当への必須ルール
1. **この仕様書、引き継ぎ、最新実コード、最新CIを照合**。古い歴史的READMEの未実装表現を現在の事実として引用しない。
2. 現在の状態は「**SSO付き限定プレビューの配信確認済み、iPhone Safari実機E2E未PASS**」。認証後の起動確認までは判定を上げない。開発側の追加作業・本番変更はPOの指示に従う。
3. 限定プレビューの候補・権限・公開範囲・ロールバックを提示し、**POの明示承認の範囲だけ**iPhone試験を実施。動作未検証のURLをPASSとして扱わない。
4. 実機でPASSしても本番マージ/公開は別ゲート。別途POの明示承認なしに実施しない。
