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

## Status

**Phase 4 COMPLETE ✅**

2026/09/30 00:59 JST、iPhone実機でPhase 4-D3最終回帰をPASS。

完了Gate:

- Gate A: WFMM / Map挙動解析 PASS
- Gate B: Leaflet地理座標固定 PASS
- Gate C: State Engine / Coloring Engine / 混在State優先順位 PASS
- Gate D: Reference State分類 / 表示ルール / Active・Reference・Unknown混在 PASS

Phase 4で確定したアーキテクチャ:

```text
Fixture / 将来Bridge実データ
  -> Data Layer
  -> State Engine
  -> Coloring Engine
  -> Renderer
  -> Leaflet 1.9.4
```

責務:

```text
Data Layer
  -> validation / dedupe / normalization

State Engine
  -> POIの意味判定

Coloring Engine
  -> State / Reference Kindから表示可否と表示情報へ変換

Renderer
  -> Coloring Engineから渡された表示対象をLeafletへ描画だけ
```

## Phase 4-D3 final verification

Gate C / D1 / D2で確定した分類・表示ロジックを変更せず、Active / Reference / Unknownが同一Fixture内および同一POI内で混在した場合の優先順位を最終実証した。

```text
Fixture (10 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> LAB State Engine (active State + Reference Kind classification)
  -> LAB Coloring Engine (State / Reference Kind -> visibility + Marker style)
  -> Map Renderer (Coloring Engineが渡した表示対象だけを描画)
  -> Leaflet 1.9.4
```

State Engineの確定ルール:

```text
Active entity priority:
GYM > POKESTOP > POWERSPOT

Active entityが1件でも確定した場合:
  -> Active Stateを採用
  -> referenceKind=null

Activeなし + INACTIVE POWERSPOT:
  -> state=NOT_IN_GAME
  -> referenceKind=INACTIVE_POWERSPOT

Activeなし + safely classifiable non-active:
  -> state=NOT_IN_GAME
  -> referenceKind=NOT_IN_GAME

Activeなし + malformed / ambiguous metadata:
  -> state=UNKNOWN
  -> referenceKind=null
```

Coloring Engineの確定表示ルール:

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

Phase 4-D3 Fixture:

- `poi-a`: `POWERSPOT ACTIVE + POKESTOP ACTIVE + POWERSPOT INACTIVE` -> `POKESTOP / null` -> visible blue
- `poi-b`: `POKESTOP ACTIVE + GYM ACTIVE + POWERSPOT INACTIVE` -> `GYM / null` -> visible red
- `poi-c`: `POWERSPOT ACTIVE + POWERSPOT INACTIVE` -> `POWERSPOT / null` -> visible purple
- `poi-d`: `POWERSPOT INACTIVE` -> `NOT_IN_GAME / INACTIVE_POWERSPOT` -> visible light purple
- `poi-e`: game objectなし -> `NOT_IN_GAME / NOT_IN_GAME` -> hidden
- `poi-f`: `sourceGameObjects`なし -> `UNKNOWN / null` -> hidden
- `poi-g`: `GYM ACTIVE + malformed GMO` -> `GYM / null` -> visible red

D3で確認した優先順位:

```text
Active > Reference
Active > malformed/ambiguous fallback
GYM > POKESTOP > POWERSPOT
INACTIVE_POWERSPOT > generic NOT_IN_GAME reference
UNKNOWN != NOT_IN_GAME
```

最終実機結果:

```text
Raw: 10
Invalid: 2
Duplicate: 1
Data Layer: 7
POKESTOP: 1
GYM: 2
POWERSPOT: 1
NOT_IN_GAME: 2
UNKNOWN: 1
Reference NOT_IN_GAME: 1
Reference INACTIVE_POWERSPOT: 1
Visible: 5
Hidden: 2
Rendered: 5
```

地図上のMarker:

```text
blue: 1
red: 2
purple: 1
light purple: 1
```

最終確認済み:

1. 上記カウントが一致。
2. `poi-a/b/c/g`がActiveとして表示され、Referenceにならない。
3. `poi-d`だけが`INACTIVE_POWERSPOT`として薄紫表示。
4. `poi-e`と`poi-f`は非表示。
5. 表示中5 MarkerのData Layer座標とLeaflet `getLatLng()`が一致。
6. Pan / Zoom後も地理座標固定を維持。
7. Phase 4全差分は`bridge-map-lab/`配下だけで、本番Creative Mode / Bridge / workflow / WFMM / productionコードへの変更なし。

## Phase 4で扱わなかったもの

次Phase以降で扱う。

- Campsite固有Map機能（50m / Candidate / 必要なS2）
- Fixture卒業 / live Bridge・Wayfarer実データ接続
- Map lifecycle（open / close / reopen / cleanup）
- WFMM共存
- 長時間・大量POI・端末試験
- Feature Flag付き本番統合
- Popup / Tooltip / fitBounds / auto pan

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
