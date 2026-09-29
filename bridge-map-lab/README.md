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

Phase 4-D1: Gate Cで確定したData Layer / State Engine / Coloring Engine / Renderer分離を維持したまま、Reference分類だけを追加する。

```text
Fixture (9 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> LAB State Engine (active State + Reference Kind classification)
  -> LAB Coloring Engine (既存State -> Marker表示情報。D1では表示ルール変更なし)
  -> Map Renderer (LAB専用LayerGroup + CircleMarker)
  -> Leaflet 1.9.4
```

State Engineの分類:

```text
ACTIVE POKESTOP
  -> state=POKESTOP
  -> referenceKind=null

ACTIVE GYM
  -> state=GYM
  -> referenceKind=null

ACTIVE POWERSPOT
  -> state=POWERSPOT
  -> referenceKind=null

Inactive Power Spot
  -> state=NOT_IN_GAME
  -> referenceKind=INACTIVE_POWERSPOT

Other safely classifiable non-active POI
  -> state=NOT_IN_GAME
  -> referenceKind=NOT_IN_GAME

Malformed / ambiguous metadata
  -> state=UNKNOWN
  -> referenceKind=null
```

重要:

- `INACTIVE_POWERSPOT`は新しい`state`ではなくReference subtypeとして扱う。
- `UNKNOWN != NOT_IN_GAME`を維持する。
- Active entity判定を先に行い、優先順位`GYM > POKESTOP > POWERSPOT`を維持する。
- D1ではColoring Engineの色仕様を変更しない。
- D1では`NOT_IN_GAME` / `UNKNOWN`をまだ非表示にしない。既存fallback表示のまま分類結果だけを検証する。
- RendererはReference分類を行わない。
- Pan / Zoom / resize後もLeafletの`getLatLng()`とData Layer座標の一致を維持する。
- 再描画はRenderer専用LayerGroupだけをclearし、Map本体を再初期化しない。

Fixture:

- `poi-a`: `POWERSPOT ACTIVE + POKESTOP ACTIVE` -> `POKESTOP`
- `poi-b`: `POWERSPOT ACTIVE + POKESTOP ACTIVE + GYM ACTIVE` -> `GYM`
- `poi-c`: `POWERSPOT ACTIVE` -> `POWERSPOT`
- `poi-d`: `POWERSPOT INACTIVE` -> `NOT_IN_GAME / INACTIVE_POWERSPOT`
- `poi-e`: game objectなし -> `NOT_IN_GAME / NOT_IN_GAME`
- `poi-f`: `sourceGameObjects`なし -> `UNKNOWN / null`

期待結果:

```text
Raw: 9
Invalid: 2
Duplicate: 1
Data Layer: 6
POKESTOP: 1
GYM: 1
POWERSPOT: 1
NOT_IN_GAME: 2
UNKNOWN: 1
Reference NOT_IN_GAME: 1
Reference INACTIVE_POWERSPOT: 1
Rendered: 6
```

このPhaseでは以下を扱わない。

- `INACTIVE_POWERSPOT`の薄い紫表示
- `NOT_IN_GAME`の非表示
- `UNKNOWN`の非表示
- Active / Reference / Unknownの混在優先テスト
- live Wayfarer通信、XHR / fetch監視
- Bridge通信、WFMM連携
- storage / 50m / S2 / Candidate
- Popup / Tooltip / fitBounds / auto pan

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
