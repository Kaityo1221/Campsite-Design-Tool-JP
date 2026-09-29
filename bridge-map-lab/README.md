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

Phase 4-B: Leaflet 1.9.4の地理座標固定を維持したData Layer / Renderer分離の最小実証。

```text
Fixture (6 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> Map Renderer (LAB専用LayerGroup + uniform gray CircleMarker)
  -> Leaflet 1.9.4
```

- Fixtureは`guid`、`lat`、`lng`だけを持つ。
- Data Layerは不正座標2件とGUID重複1件を除外し、正規化済み3件を返す。
- RendererはData Layer出力だけを受け取り、検証や判定を行わない。
- Pan / Zoom / resize後もLeafletの`getLatLng()`とData Layer座標の一致を画面で確認できる。
- 再描画はRenderer専用LayerGroupだけをclearし、Map本体を再初期化しない。

このPhaseでは以下を扱わない。

- State Engine / Coloring Engine
- live Wayfarer通信、XHR / fetch監視
- Bridge通信、WFMM連携
- PokéStop / Gym / Power Spot等の判定や色分け

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
