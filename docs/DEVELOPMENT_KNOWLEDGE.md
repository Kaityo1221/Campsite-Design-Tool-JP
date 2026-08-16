# Campsite Design Tool 開発ナレッジ

## キャッシュ更新ルール

### 原則
JS / CSS を変更した場合は、コード変更だけで完了としない。
そのファイルを読み込む HTML 側のクエリパラメータ `?v=` も必ず更新する。

例：

```html
<script src="js/distance-map.js?v=1"></script>
```

を変更対象の JS 更新後は、

```html
<script src="js/distance-map.js?v=2"></script>
```

のように上げる。

CSS も同様。

```html
<link rel="stylesheet" href="css/distance.css?v=41">
```

を変更した場合は `v=42` などへ更新する。

### 変更完了の定義
以下をすべて終えて初めて「本番反映完了」とする。

1. 対象 JS / CSS の修正
2. 対象ファイルを読み込む HTML の `?v=` 更新
3. main へ反映
4. GitHub Pages の最新ビルド完了確認
5. iPhone Safari を含む実機で再読み込みして確認

### 2026-08-16 の事例
距離チェック画面で Leaflet のロード失敗対策を `js/distance-map.js` に追加したが、`index.html` 側が `js/distance-map.js?v=1` のままだった。
そのため iPhone Safari が旧 JS をキャッシュし続け、修正後も「地図ライブラリを読み込めませんでした。」が表示された。

教訓：

**JS / CSS の変更とキャッシュバージョン更新は必ずセットで行う。**

### 補足
CDN や外部ライブラリの読み込み失敗対策を入れた場合でも、対策コード自体がキャッシュで古いままなら意味がない。
特に iPhone Safari では再読み込みだけで古い静的ファイルが残ることがあるため、クエリパラメータ更新を優先する。
