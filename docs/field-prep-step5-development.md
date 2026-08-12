# Field Prep STEP 5 開発記録

## 目的

現地モードから保存するKMZを提出用完成形へ近づけるため、距離円を整理する。

- 40m円 = 基本距離として自動
- 30m円 = 必要な新規POIだけ明示的にON

## ブランチ

`agent/field-complete-kmz-05`

## UI

新規POIを選択した時だけ距離円パネルを表示する。

- 40m 基本
- `30m調整円：追加しない`
- ON時 `30m調整円：追加する ✓`

新規POI作成時の初期値は `include30mCircle=false`。

## 30m選択の端末保存

既存 `campsite-field-session` のDB versionは上げない。

既存セッション本体の `current` レコードへ項目追加もしない。

同じ `state` storeの別キー `circle-options-v1` を使用し、元ファイルの署名ごとに30m選択だけを保存する。

元ファイル署名:

`name:size:lastModified`

新規POI識別:

`poiType|name|originalLat|originalLng`

この方式により、既存 `FieldModeSession` の保存・復元構造を変更せずに30m選択を復元する。

## KMZ出力

通常保存と活動範囲込み保存の両方で同じ規則を使用する。

### 40m

すべての新規POIに出力する。

正式フォルダ:

`40m円（基本距離）`

### 30m

`record.include30mCircle === true` の新規POIだけ出力する。

正式フォルダ:

`30m円（調整用）`

初期状態では30m円は0件。

## STEP 4で発見した既存保存競合

活動範囲を作成した場合でも通常KMZ保存のcapture listenerが先にイベントを止め、combined exporterへ到達しない競合がWebKitテストで判明した。

STEP 4で最小修正し、活動範囲が存在する時だけ通常保存側が処理を譲るようにした。

この修正後、通常保存・活動範囲込み保存の両方で正式POIレイヤーと活動範囲がGREENになった。

## テスト

WebKitで次を確認する。

- 新規POIは40m円を必ず出力する
- 30m円は初期状態で出力しない
- 30mをONにした1件だけ30m円を出力する
- 30m選択がページ再読込・現地作業復元後も残る
- 活動範囲込み保存でも30m選択が維持される
- 正式POIレイヤーを維持する
- 調査範囲Polygonを出力しない

## 次段階

STEP 6では全体のハードニングを行う。

- CSV → 調査範囲 → 直接handoff → 現地編集 → KMZ保存を通しでE2E
- 完成KMZの正式フォルダを全件検査
- 調査範囲非出力を最終確認
- 旧KML/KMZ手動入力経路の回帰確認
- CA向け説明書どおりに操作できるか受入テスト

Google Formは対象外のままとする。
