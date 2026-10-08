# Creative Mode Phase 1-A POI操作基盤

正式Phase 1の先行部分として、メモリ上のPOI操作基盤だけを実装した独立試験です。本番の正本ではありません。既存Creative、保存キー、Bridge、DB、認証、KMZ入出力への接続はありません。コード・試験・文書の新設範囲はこのディレクトリ内だけです。

基準コミット: `f5dc8d88ad3987df82c000e2cac4b8aa0bc5ed80`

作業ブランチ: `feature/creative-next-phase-1a-20261008`

正式機能仕様: Creative Mode 新フロー 正式仕様書v1.0（2026-10-08、No.01〜42）。Phase 1-Aは会長の今回の実装指示による先行範囲であり、仕様書No.41の正式Phase 1全体の完了を意味しません。

## 新設ファイル

| ファイル | 役割 |
|---|---|
| `.gitignore` | 試験結果をGit対象外にする |
| `index.html` | 最小試験画面と通信制限 |
| `bootstrap.mjs` | fixtureと操作基盤を画面へ接続 |
| `styles.css` | 試験画面専用の表示 |
| `core/poi-model.mjs` | canonical POI検証、非JSONデータ拒否、コピー |
| `core/poi-id.mjs` | 採番、旧ID対応表、重複候補診断 |
| `core/poi-limits.mjs` | 既存700、新規25、種類12／8／5の判定 |
| `core/poi-commands.mjs` | 操作の検証と共通座標・区分保護 |
| `core/poi-store.mjs` | 非公開メモリ状態、確定・置換・Undo／Redo |
| `core/history.mjs` | POI差分による操作履歴 |
| `adapters/legacy-records.mjs` | 明示された旧fixtureの非破壊変換 |
| `tests/fixtures/poi-cases.mjs` | 基本、超過、700／701、旧ID衝突fixture |
| `tests/poi-core.test.mjs` | 基盤の境界値・整合性試験 |
| `tests/isolation.test.mjs` | 依存・接続禁止・既存ファイル不変の静的確認 |
| `tests/isolation.spec.mjs` | 実ブラウザ操作と保存・通信・本番global隔離 |
| `tests/playwright.config.mjs` | 独立runnerのブラウザ設定 |
| `tests/run-browser-tests.mjs` | Chromium／WebKitの実行とJSON結果保存 |
| `tests/serve.mjs` | このディレクトリだけを扱うlocalhost試験サーバー |
| `README.md` | 範囲、契約、再実行手順、結果、残作業 |

## 正式仕様への対応

| 要件 | この先行範囲で実装したこと | この段階の対象外 |
|---|---|---|
| No.08・09 | 重複候補を保持、旧ID欠落・衝突の一対多対応、操作中の内部ID不変 | 実KMZのID格納・往復 |
| No.06 | 明確な旧record形式のコピー変換。矛盾・不明必須項目があれば全件保留 | 旧保存キー読取、永続移行、バックアップ・復旧 |
| No.10 | edit／move／履歴を通る共通更新境界で既存座標を保護 | 実KMZ・実保存移行における元座標基準 |
| No.02・11・13 | 新規25・種類12／8／5、非削除新規の集計、追加と種類変更の別判定 | 本番＋メニュー・書出警告 |
| No.12 | 最小試験画面の＋は上限時も開き、追加不可理由を表示 | 本番Creativeへの接続 |
| No.15・16・22 | 明示確定、取消・失敗・無変更では履歴不変。POI編集／移動／削除の履歴 | 地図での仮配置・位置調整、活動範囲編集、Safari履歴 |
| No.23・33 | 499／500／700／701判定、701全件反映拒否、新規超過の保持 | 実KMZ読込、描画最適化、実機メモリ・保存復旧 |
| No.40・41 | 独立入口・独立テスト、既存ファイル保護 | 限定公開、一般公開、正式PhaseのPASS判定 |

## 基盤契約

POIは`id`, `role: existing|new`, `kind: pokestop|gym|power`, `title`, `memo`, `lat`, `lng`, `deleted`, `guid`, `poiId`, `metadata`を持ちます。`guid`と`poiId`は外部識別情報で、同じ値を持つ複数POIも内部IDでは区別します。座標は丸めません。

採番は`crypto.randomUUID()`を利用します。内部IDを持つ受理済みデータはそのIDを保持します。欠落・不正形式・衝突の旧IDは新IDへ対応付けます。旧IDだけをキーにしたMapではなく、入力位置を含む対応表を返します。既存IDと、後から入力に現れるIDを予約して衝突を避けます。

`createPoiStore(records)`は受理済みcanonicalデータを保持します。`snapshot()`と`importReport()`は独立コピーを返します。外部から変更しても内部状態は変わりません。

`execute(command, {confirmed:true})`だけが確定操作です。confirmed省略・falseは取消として状態・履歴を変えません。typeは`add`, `delete`, `edit`, `change-kind`, `move`です。追加は新規だけを受け付け、内部IDは基盤が採番します。既存の名称・メモ・種類・削除は操作可能ですが、座標は変更できません。ID・区分の変更は禁止です。

新規合計25と対象種類の空きが両方ある場合だけ追加できます。種類変更は総数を変えないため、25到達時でも対象種類に空きがあれば可能です。import済みの新規26件以上や種類超過は削除せず保持します。編集・削除・Undo／Redoが可能で、削除Undoで元の超過状態を復元することを追加制限で拒否しません。725を絶対的な全レコード上限にはしていません。

履歴は各POIのbefore／after差分です。Undo後の新規確定操作でRedoを破棄します。失敗・取消・無変更では両stackを維持します。受理した全件置換と`resetHistory()`で履歴は空になります。拒否した置換は元のPOI・履歴・versionを維持します。

### 監査修正：全件置換時の同一ID保護（2026-10-08）

`replace()`も、現在保持するPOIと取込候補の間で内部IDが一致する場合は同一個体とみなし、全件確定前に`protectTransition()`で区分と既存座標を検証します。同じIDの区分変更または既存座標変更が1件でもあれば、取込候補の**全件を拒否**します。拒否時は既存POI・Undo／Redo・version・直前のimportReport・採番済みIDを変更しません。結果には問題レコードの`index`、`id`、`code`、`message`を返します。

対象が別個体で同一IDを偶然共有する場合、現時点で自動的な同一性判定はできないため安全側に保留します。別データの全件置換は、重複のない内部IDであれば引き続き可能です。受理済みの旧ID重複は従来どおり個別IDに対応付けて保持します。実KMZ／旧保存移行での同一性確認・ID再対応付け・元座標の外部根拠は正式Phase 1の未決事項であり、この修正では勝手に補完しません。
再読込ではメモリ状態が失われ、初期fixture・空履歴から開始します。

### 技術選択として限定した点

基盤の既存件数判定は、渡されたexisting recordを全件数えます（非表示・重複・削除済みも保持データとして計上）。新規件数は削除済みを除外します。この保守的なfixture判定を、未確定の旧保存tombstone・Wayfarer参照／reserveの実移行ルールとして固定していません。正式Phase 1で入力形式と計数対象を確認する必要があります。

旧変換は明示的な6種類の`layer`、`role`、`kind`／`gameEntity`、`title`／`name`、`latlng`／`lat`・`lng`だけを用います。併記された値が矛盾する場合は保留します。名称・アイコン・`source:true`から区分を推測しません。入力座標の文字列を数値へ自動補正しません。`currentPois`が明示されていれば空配列でも優先し、無効なcurrentPoisから別の配列へフォールバックしません。

不明フィールドは`metadata.legacyRecord`と保管用`preservedEnvelope`にコピーして残します。preservedEnvelopeは原資料の複製であり、旧履歴を含んでも基盤の履歴へ適用しません。実保存やBridgeへの書戻しはありません。旧現座標と原取得座標の優先規則は未決であり、外部原取得座標へ戻す処理は実装していません。

## 再実行

このリポジトリのルートから、利用するNode実行ファイルで次を実行します。既存package.json・依存・テスト設定は変更しません。

```text
node --test creative-next/phase-1a/tests/poi-core.test.mjs creative-next/phase-1a/tests/isolation.test.mjs
node creative-next/phase-1a/tests/serve.mjs
```

試験画面は`http://127.0.0.1:4178/`です。このサーバーはlocalhostだけで待受け、このディレクトリのHTML・JS・CSS・JSONだけを配信します。Ctrl+Cで停止できます。

ブラウザ試験は、利用可能なPlaywrightモジュールの絶対パスを指定します。

```text
node creative-next/phase-1a/tests/run-browser-tests.mjs --playwright-module=/absolute/path/to/playwright/index.mjs
```

必要に応じて`--chromium-channel=msedge`、`--webkit-executable=/absolute/path/to/Playwright.exe`を追加できます。Node・Playwright・ブラウザは既存ランタイムを使い、新規インストールはしていません。結果はGit対象外の`test-results/browser-results.json`へ保存します。

## この作業での試験結果

- Node自動試験28件: すべてPASS、skipなし。
- Chromium（既存Edgeをheadless起動、390×844）: 画面操作・隔離PASS。
- WebKit（既存webkit-2359、390×844）: 画面操作・隔離PASS。
- 両ブラウザで保存APIアクセス0、旧localStorage／sessionStorage検査値不変、外部通信0、本番runtime・認証globalアクセス0、console／page error 0。
- 画面はこの試験ディレクトリの静的ファイルだけを読み込みました。ネットワーク禁止関数の呼出しもありません。
- 既存trackedファイル差分0、ステージ済み変更0、新設ソースはこのディレクトリ内だけ。

初回WebKitは期待ブラウザ版と既存版が違い起動できませんでした。既存実行ファイルの明示指定で起動しました。その後、画面取得を含めた試験でCSPのスタイル警告を検出しました。画面取得を機能・隔離試験から分離し、CSPを維持した状態で全操作を再試験してPASSを得ました。警告を無視するフィルターは追加していません。

これは自動ブラウザ試験であり、iPhone Safari実機試験ではありません。701拒否はfixtureデータの判定試験であり、実KMZ読込試験ではありません。

## 正式Phase 1へ残る作業

実KMZの全件診断・中止・遅延結果無効化・置換確認、専用メタデータと版、問題POI抽出／診断TXT、IDと正確な座標を保つKMZ出力・往復、安全な自動保存・旧保存移行・破損救出・バックアップ・切替・復旧、実入力での700判定対象を残しています。

地図描画・グループ化、活動範囲、距離円、10層表示、トップ・Safari履歴等は正式Phase 2へ残ります。No.37〜39の実ファイル往復、iPhone Safari実機・Wayfarerからの通し試験、切戻しと一般公開判定は正式Phase 3へ残ります。DB・認証・Bridge接続は追加していません。

現在の切戻しは試験サーバー停止・新設ディレクトリの取り消しだけで、保存データの逆移行や削除を必要としません。将来の永続保存導入後の切戻しは未実装です。

mainのPagesワークフローはリポジトリ全体を公開対象にするため、このディレクトリをmainへ追加するだけでも直接URLで公開される可能性があります。noindexや独立ディレクトリは限定公開の認証にはなりません。

コミット・push・PR作成・マージ・デプロイ・一般公開は行っていません。会長のPASS判定を待つ状態で停止します。
