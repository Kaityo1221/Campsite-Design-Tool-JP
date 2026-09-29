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

Phase 4-C1: Phase 4-Bの地理座標固定とData Layer / Renderer分離を維持した、LAB専用State Engineの最小実証。

```text
Fixture (6 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> LAB State Engine (POKESTOP / GYM / POWERSPOT / UNKNOWN)
  -> Map Renderer (LAB専用LayerGroup + uniform gray CircleMarker)
  -> Leaflet 1.9.4
```

- Fixtureの正常POIは`sourceGameObjects`を持つ。
- Data Layerは不正座標2件とGUID重複1件を除外し、`sourceGameObjects`を解釈せず保持した正規化済み3件を返す。
- State EngineはData Layer出力だけを受け取り、`ACTIVE`かつ対応entity、かつ`HOLOHOLO`または空/absent brandのデータだけを分類する。
- 複数の対応active entityは`GYM > POKESTOP > POWERSPOT`の優先順位で分類し、安全に分類できないデータは`UNKNOWN`とする。
- RendererはState Engine出力だけを受け取り、検証やState判定を行わない。
- State別の見た目は適用せず、全Markerを同一のグレーCircleMarkerとして描画する。
- Pan / Zoom / resize後もLeafletの`getLatLng()`とData Layer座標の一致を画面で確認できる。
- 再描画はRenderer専用LayerGroupだけをclearし、Map本体を再初期化しない。

このPhaseでは以下を扱わない。

- Coloring Engine、State別の色・形状
- `NOT_IN_GAME` / `INACTIVE_POWERSPOT`
- live Wayfarer通信、XHR / fetch監視
- Bridge通信、WFMM連携

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
