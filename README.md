# Campsite-Design-Tool-JP
## 最高の遊び場をつくろう
### Pokémon GO Community Ambassador向け  
### キャンプサイト設計支援ツール

## 概要

WayfarerのCSV / MyMapのKML・KMZを読み込み、  
以下を自動生成します。

- 既存ポケストップ / ジム / パワースポットの分類
- 40m円（基本距離）
- 30m円（調整用）
- KMZ出力（MyMapインポート用）

## 特徴

- 複数CSV対応
- guidによる重複削除
- 設計ガイド・チェックリスト内蔵
- ブラウザのみで動作（インストール不要）

## 使い方

1. Wayfarer Mapから「Nearby Wayspots」→ Export CSV
2. 本ツールにCSV / KML / KMZを読み込む
3. KMZを生成
4. Google My Mapsにインポート

## 設計ルール

- POI作成時は40mで統一（調整余地確保）
- 配置が厳しい場合のみ30mまで調整
- 追加POIは最大25個

## 注意

- スポンサーPOIはWayfarerに表示されないため、MyMap上で手動追加してください
- CA限定での利用を想定しています

---
