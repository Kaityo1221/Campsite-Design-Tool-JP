# Field Prep STEP 3 開発記録

## 目的

STEP 2でWebKit互換性を確認した「準備KML → 既存現地モード」の経路を、自動引き継ぎにする。

CAの主操作は次の3段階にする。

1. CSVを読み込む
2. 調査範囲を囲む
3. `現地モードを開始` を押す

## ブランチ

`agent/field-prep-03-handoff`

## 実装方針

既存現地モードのKMLパーサー、エクスポート、自動保存を別経路として作り直さない。

準備ページで作った内部KMLを一時的に `campsite-field-prep` IndexedDBへ保存し、handoff IDだけをURLへ渡す。

`field-mode.html?handoff=<id>` を開いた後、現地モード側で内部KMLから `File` を生成する。

そのFileを `DataTransfer` で既存 `#fieldModeFile` へ設定し、通常の `change` イベントを発火する。

これにより既存の次の処理をそのまま通す。

- `readKmlText()`
- `renderKml()`
- `FieldModeExport` の元ファイル取得
- `FieldModeSession` の元ファイル保存
- 通常の現地モード自動保存

## handoffデータ

DBはSTEP 2と同じ `campsite-field-prep` version 1を使う。

新しいobject storeやDBバージョンアップは行わない。

既存 `state` storeへ `handoff:<id>` キーで一時保存する。

保存内容:

- version
- id
- createdAt
- sourceName
- pointCount
- kml

正常に現地モードで読み込み完了した後、handoffデータは削除する。

## 通常ファイル入力の維持

既存 `#fieldModeFile` は削除しない。

自動引き継ぎが失敗した場合、CAは従来どおりKMZ / KML / ZIPを手動選択できる。

STEP 2の実験用KML保存も、当面フォールバックとして残す。

## 調査範囲

STEP 3でも調査範囲Polygonは現地モードへ渡さない。

現地モードへ渡すのは、調査範囲内に絞り込んだPOIと正式レイヤー構造、50m目安円だけ。

正式な `活動範囲` は現地モード内で別に作成する。

## 検証方針

WebKit E2Eで次を確認する。

- handoff IDから準備KMLを取得できる
- 既存ファイル入力のchange経路で読み込める
- 現地モードの読み込み完了表示になる
- `FieldModeSession.hasSource()` がtrueになる
- 成功後にhandoffパラメータがURLから消える
- 成功後に一時handoffデータがIndexedDBから削除される
- 不正handoffでも通常ファイル入力が残る
- 既存Field Mode Safety CheckもGREENのまま

## 次段階

STEP 4では新規POIを種類に応じて正式な追加希望レイヤーへ自動振り分けする。

- pokestop → `追加希望ポケスト`
- gym → `追加希望ジム`
- power / power_spot → `追加希望パワスポ`

30m・40m参考円の必要時だけの追加と提出用完成KMZは、さらに後のSTEP 5で扱う。
