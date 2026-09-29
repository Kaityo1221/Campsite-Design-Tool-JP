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

Phase 4-D2: Phase 4-D1で確定したReference分類を変更せず、Coloring Engineで表示可否と表示色だけを決定する。

```text
Fixture (9 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> LAB State Engine (active State + Reference Kind classification)
  -> LAB Coloring Engine (State / Reference Kind -> visibility + Marker style)
  -> Map Renderer (Coloring Engineが渡した表示対象だけを描画)
  -> Leaflet 1.9.4
```

State Engineの分類はPhase 4-D1から変更しない。

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

Phase 4-D2の表示ルール:

```text
POKESTOP
  -> visible
  -> blue #2F80ED

GYM
  -> visible
  -> red #E53935

POWERSPOT
  -> visible
  -> purple #8E44AD

NOT_IN_GAME / INACTIVE_POWERSPOT
  -> visible
  -> light purple #C9A7EB

NOT_IN_GAME / NOT_IN_GAME
  -> hidden

UNKNOWN
  -> hidden
```

重要:

- `INACTIVE_POWERSPOT`はStateではなくReference subtypeのまま維持する。
- `UNKNOWN != NOT_IN_GAME`を維持する。
- State EngineのActive優先順位`GYM > POKESTOP > POWERSPOT`は変更しない。
- Coloring Engineが表示可否とMarker色を決定する。
- RendererはStateやReference Kindを解釈しない。
- RendererはColoring Engineから渡された`pois[]`だけを描画する。
- DiagnosticsではColoring Engineの全decisionを表示し、非表示POIはLeaflet列を`HIDDEN`とする。
- Pan / Zoom / resize後も、表示中MarkerのLeaflet `getLatLng()`とData Layer座標の一致を維持する。
- 再描画はRenderer専用LayerGroupだけをclearし、Map本体を再初期化しない。

Fixture:

- `poi-a`: `POWERSPOT ACTIVE + POKESTOP ACTIVE` -> `POKESTOP` -> visible blue
- `poi-b`: `POWERSPOT ACTIVE + POKESTOP ACTIVE + GYM ACTIVE` -> `GYM` -> visible red
- `poi-c`: `POWERSPOT ACTIVE` -> `POWERSPOT` -> visible purple
- `poi-d`: `POWERSPOT INACTIVE` -> `NOT_IN_GAME / INACTIVE_POWERSPOT` -> visible light purple
- `poi-e`: game objectなし -> `NOT_IN_GAME / NOT_IN_GAME` -> hidden
- `poi-f`: `sourceGameObjects`なし -> `UNKNOWN / null` -> hidden

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
Visible: 4
Hidden: 2
Rendered: 4
```

地図上の期待Marker:

```text
blue: 1
red: 1
purple: 1
light purple: 1
```

このPhaseでは以下を扱わない。

- State Engineの分類変更
- Active / Reference / Unknownの混在優先テスト
- Marker形状変更
- live Wayfarer通信、XHR / fetch監視
- Bridge通信、WFMM連携
- storage / 50m / S2 / Candidate
- Popup / Tooltip / fitBounds / auto pan

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
