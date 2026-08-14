# 現地モード準備 開発記録

## 目的

Campsite Lab内の実験として、CSVから現地モードへ直接つなぐ準備フローを段階的に構築する。

最終目標は以下。

CSV → 調査範囲で絞り込み → 現地モード → 現地設計 → 提出用完成KMZ

既存のメインツールと現地モードを壊さないことを最優先とする。

## 第1段階: field-prep-01-csv

### 対象ブランチ

`agent/field-prep-01-csv`

### 実装範囲

- 独立したLab実験ページ `field-prep.html` を追加
- 複数CSV選択
- 既存 `js/util.js` の `parseCSV()` を再利用
- 既存 `removeDuplicate()` を再利用
- CSV別の読み込み結果を保持
- 読込件数 / 重複件数 / 重複整理後件数を表示
- ポケストップ / ジム / パワースポット件数を表示
- CA向け説明書 v0.1 を同時追加
- 第1段階専用の静的チェックとiPhone/WebKit E2Eテストを追加

### この段階で変更しないもの

- `index.html`
- `lab.html`
- `field-mode.html`
- `js/field-mode-session.js`
- `js/field-mode-export.js`
- `js/field-mode-area.js`
- 既存 `campsite-field-session` IndexedDB
- 通常KMZ生成フロー

### データの扱い

第1段階はページメモリ上のみ。

サーバー送信、Supabase保存、既存IndexedDBへの保存は行わない。

各POIには読み込み時に `sourceName` を追加し、どのCSV由来か追跡できるようにする。

### 重複整理

既存 `removeDuplicate()` の規則をそのまま使用する。

優先順位:

1. guid
2. id
3. 緯度経度を小数7桁に丸めた座標
4. JSON文字列

### POI種別

既存コードとの互換性のため、画面側の表示分類では次を吸収する。

- `power`
- `power_spot`
- `Power Spot`

どれも画面上では「パワースポット」とする。

CSVの `type` / `gameStatus` に明示された Gym / Power Spot / Pokestop を準備画面側で先に判定し、必要な場合だけ既存分類処理へフォールバックする。

既存util側のenumは第1段階では変更しない。

### テスト

第1段階では、既存現地モード用チェックとは別に `Field Prep Safety Check` を追加した。

確認する代表ケース:

- CSVを2個まとめて読み込める
- 合計4件のうち同一GUID 1件を重複として整理できる
- 整理後3件になる
- ポケストップ / ジム / パワースポットが各1件と集計される
- 選択クリアで準備結果が消える

初回E2Eで Gym / Power Spot がポケストップへ寄る種類判定不具合を検出し、準備画面側の明示判定へ修正した。

修正後:

- `Field Prep Safety Check`: GREEN
- 既存 `Field Mode Safety Check`: GREEN

## 第2段階: field-prep-02-survey-area

### 対象ブランチ

`agent/field-prep-02-survey-area`

### 実装範囲

- Leaflet地図を準備ページに追加
- CSVから整理したPOIを地図表示
- 地図中央の十字を使った調査範囲Polygon作成
- point-in-polygonで範囲内 / 範囲外を判定
- 準備対象 / 範囲内 / 範囲外の件数を表示
- 確定後、範囲外POIを薄く表示
- 調査範囲と準備状態を専用IndexedDBへ保存
- 同じ端末・ブラウザで準備状態を復元
- 範囲内POIのみを収録した暫定KMLを保存
- CA向け説明書をv0.2へ更新

### 調査範囲と活動範囲の分離

調査範囲は既存 `FieldModeArea` と完全に分離する。

- field-modeのグローバルundo / redoへ入れない
- `活動範囲` としてエクスポートしない
- 完成KMZへ出力しない
- 現地モードへ渡すPOIを選別するためだけに使う

### IndexedDB

既存DB `campsite-field-session` は変更しない。

準備ページ専用DBを新設する。

- DB名: `campsite-field-prep`
- version: 1
- store: `state`
- key: `current`

保存内容:

- CSV由来の準備済みPOI
- 重複件数
- CSV別読み込み結果
- 調査範囲Polygon

### 暫定KML

自動引き継ぎ前のアダプタ検証として、現地モード用KMLを手動保存できるようにする。

KMLに用意する正式フォルダ:

- `既存のポケストップ`
- `既存のジム`
- `既存のパワースポット`
- `追加希望ポケスト`
- `追加希望ジム`
- `追加希望パワスポ`
- `活動範囲`
- `50m円（目安）`
- `40m円（参考距離）`
- `30m円（参考距離）`

この段階では、範囲内の既存POIと50m目安円を生成する。追加希望・活動範囲・30m・40m参考円は空フォルダとして用意する。

**調査範囲PolygonはKMLに含めない。**

### 既存機能への影響防止

第2段階でも次は変更しない。

- `index.html`
- `lab.html`
- `field-mode.html`
- `js/field-mode-session.js`
- `js/field-mode-area.js`
- `js/field-mode-export.js`
- `js/kmz.js`
- 既存 `campsite-field-session` IndexedDB

## 次段階: field-prep-03-handoff

予定:

- 手動保存KMLが既存field-modeで安定することを先に確認
- 自動引き継ぎ用handoff IDを準備DBへ保存
- `field-mode.html?handoff=<id>` 方式を候補にする
- 通常のKML/KMZファイル入力経路は残す
- field-mode側の変更は最小限にする

## 説明書運用

各ブランチで必ず次をセットで行う。

1. 実装
2. 動作確認
3. `docs/field-prep-ca-guide.md` 更新
4. 説明書どおり操作できるか確認

CA向け説明書には、IndexedDB・内部KML・エクスポータ内部構造など開発者向け語彙を必要以上に出さない。
