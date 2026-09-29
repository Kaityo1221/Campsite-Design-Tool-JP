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

Phase 4-D3: Gate C / D1 / D2で確定した分類・表示ロジックを変更せず、Active / Reference / Unknownが同一Fixture内および同一POI内で混在した場合の優先順位を最終実証する。

```text
Fixture (10 POIs)
  -> LAB Data Layer (validation -> valid GUID first-wins dedupe -> normalization)
  -> LAB State Engine (active State + Reference Kind classification)
  -> LAB Coloring Engine (State / Reference Kind -> visibility + Marker style)
  -> Map Renderer (Coloring Engineが渡した表示対象だけを描画)
  -> Leaflet 1.9.4
```

State Engineのルールは変更しない。

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

Coloring Engineの表示ルールもPhase 4-D2から変更しない。

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

D3で確認する優先順位:

```text
Active > Reference
Active > malformed/ambiguous fallback
GYM > POKESTOP > POWERSPOT
INACTIVE_POWERSPOT > generic NOT_IN_GAME reference
UNKNOWN != NOT_IN_GAME
```

重要:

- `INACTIVE_POWERSPOT`はStateではなくReference subtypeのまま維持する。
- Activeが確定したGUIDをReference channelとして扱わない。
- malformed GMOが併存してもsupported Active entityが確定していればActiveを優先する。
- Coloring Engineが表示可否とMarker色を決定する。
- RendererはStateやReference Kindを解釈しない。
- Diagnosticsでは全7 decisionを表示し、非表示POIはLeaflet列を`HIDDEN`とする。
- Pan / Zoom / resize後も、表示中MarkerのLeaflet `getLatLng()`とData Layer座標の一致を維持する。
- 再描画はRenderer専用LayerGroupだけをclearし、Map本体を再初期化しない。

期待結果:

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

地図上の期待Marker:

```text
blue: 1
red: 2
purple: 1
light purple: 1
```

Phase 4-D3 PASS条件:

1. 上記カウントが一致する。
2. `poi-a/b/c/g`がActiveとして表示され、Referenceにならない。
3. `poi-d`だけが`INACTIVE_POWERSPOT`として薄紫表示される。
4. `poi-e`と`poi-f`は非表示になる。
5. 表示中5 MarkerのData Layer座標とLeaflet `getLatLng()`が一致する。
6. Pan / Zoom / resize後も上記を維持する。

Phase 4-D3 PASSをもって、Phase 4のData Layer / State Engine / Coloring Engine / Renderer / Reference State検証を完了とする。

このPhaseでは以下を扱わない。

- live Wayfarer通信、XHR / fetch監視
- Bridge実データ接続
- WFMM共存
- storage / 50m / S2 / Candidate
- Popup / Tooltip / fitBounds / auto pan
- Map open / close / reopen lifecycle

Production baseline: `314a7bf7bb2bdb24741c93ff0dcf1af93caa2143`
