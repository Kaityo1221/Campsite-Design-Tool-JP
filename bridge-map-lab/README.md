# Campsite Bridge Map LAB

次世代Campsite Bridge / Campsite Mapの実験専用領域。

## Scope

- 本番Creative Modeとは完全分離する。
- 本番Bridgeへ反応させない。
- LABの失敗を本番ユーザーへ波及させない。
- WFMMコードを直接コピーしない。
- WFMM内部変数、DOM、storage、Marker、Circle、Overlayを書き換えない。
- `main` へ直接LAB実装を入れない。

## Namespace policy

LAB固有のDOM ID、class、storage key、event、global variable、script名は、可能な限り以下のprefixを使う。

- `campsiteLab_*`
- `bridgeMapLab_*`

## Current phase

Phase 4-A: Leaflet 1.9.4 single-marker geographic anchor proof.

- LAB定数 `[35.7148, 139.7731]` に `L.circleMarker` を1個だけ表示する。
- Pan / Zoom / resize後も `getLatLng()` がLAB定数と一致することを画面上で確認する。
- OpenStreetMap tileとattributionを表示する。

まだ以下は未実装。

- Bridge Data Layer
- State / Coloring Engine
- Not in game filter
- WFMM compatibility
- XHR / fetch monitoring
- Campsite layers

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
