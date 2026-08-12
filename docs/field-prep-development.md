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

## 次段階: field-prep-02-survey-area

予定:

- 調査範囲Polygonを準備画面専用で作成
- 調査範囲は `FieldModeArea` と完全分離
- loaded / inside / outside を表示
- 範囲外POIは削除せず、現地モードへの引き継ぎ対象から外す
- 調査範囲は完成KMZへ出力しない
- 準備状態は既存DBとは別のIndexedDBへ保存する

候補DB名: `campsite-field-prep`

## 説明書運用

各ブランチで必ず次をセットで行う。

1. 実装
2. 動作確認
3. `docs/field-prep-ca-guide.md` 更新
4. 説明書どおり操作できるか確認

CA向け説明書には、IndexedDB・内部KML・エクスポータ内部構造など開発者向け語彙を出さない。
