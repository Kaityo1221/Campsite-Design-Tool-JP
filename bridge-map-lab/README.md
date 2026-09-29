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

Phase 4-C3: Phase 4-C2のData Layer / State Engine / Coloring Engine / Renderer分離を維持した、複数Active entity混在時のState優先順位実証。

```text
Fixture (6 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> LAB State Engine (POKESTOP / GYM / POWERSPOT / UNKNOWN)
  -> LAB Coloring Engine (State -> Marker表示情報)
  -> Map Renderer (LAB専用LayerGroup + CircleMarker)
  -> Leaflet 1.9.4
```

- Raw 6件、不正座標2件、GUID重複1件、Data Layer出力3件を維持する。
- `poi-a` は `POWERSPOT + POKESTOP` の複数Active entityを持ち、優先順位により `POKESTOP` となる。
- `poi-b` は `POWERSPOT + POKESTOP + GYM` の複数Active entityを持ち、優先順位により `GYM` となる。
- `poi-c` は `POWERSPOT` のみを持ち、`POWERSPOT` となる。
- State Engineの優先順位 `GYM > POKESTOP > POWERSPOT` 自体はPhase 4-C1実装から変更しない。
- Coloring Engineの色仕様はPhase 4-C2のまま、POKESTOP=青、GYM=赤、POWERSPOT=紫を維持する。
- RendererはState判定・State別色判定を行わず、Diagnostics用に入力の`sourceGameObjects`を透過的に返すだけとする。
- Pan / Zoom / resize後もLeafletの`getLatLng()`とData Layer座標の一致を維持する。
- 再描画はRenderer専用LayerGroupだけをclearし、Map本体を再初期化しない。

期待結果:

```text
Raw: 6
Invalid: 2
Duplicate: 1
Data Layer: 3
POKESTOP: 1
GYM: 1
POWERSPOT: 1
UNKNOWN: 0
Rendered: 3
```

このPhaseでは以下を扱わない。

- State Engineの判定ロジック変更
- Coloring Engineの色仕様変更
- `NOT_IN_GAME` / `INACTIVE_POWERSPOT`
- UNKNOWN / NOT_IN_GAMEの非表示処理
- live Wayfarer通信、XHR / fetch監視
- Bridge通信、WFMM連携
- storage / 50m / S2 / Candidate
- Popup / Tooltip / fitBounds / auto pan

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
