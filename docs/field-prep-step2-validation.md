# Field Prep STEP 2 検証記録

## 目的

自動handoffへ進む前に、準備画面で生成するKMLが既存の現地モードへそのまま入力できることをWebKitで確認する。

## 確認内容

- 調査範囲のpoint-in-polygon内外判定
- Polygon境界上のPOIを範囲内として扱う
- 正式フォルダ名を持つKMLを生成する
- 範囲内POIの50m目安円を生成する
- 30m・40m参考円の正式な空フォルダを用意する
- 調査範囲PolygonをKMLへ出力しない
- 準備専用IndexedDBへ保存・読込できる
- 準備画面が生成したKMLを既存 `field-mode.html` の通常ファイル入力へ渡し、現地モードが読み込み完了できる

## 判定

この互換性テストがGREENになった後に、STEP 3の自動handoffへ進む。
