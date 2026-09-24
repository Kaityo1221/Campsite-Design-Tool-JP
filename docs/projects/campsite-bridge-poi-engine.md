# Campsite Bridge POI Engine Project

## 目的

WFMM本体を必須にせず、Campsite Bridge単体でWayfarerのPOIを取得・判定し、Pokémon GO上の種別に応じて地図上へ正確に色分け表示する。

対象表示:

- PokéStop: 青
- Gym: 赤
- Power Spot: 紫
- Not in Game / inactive: 非表示

Bridgeの本来機能であるPOI自動記録・重複排除・Campsite送信は継続する。

## プロジェクト方針

WFMMのコードを直接コピーして依存するのではなく、必要な振る舞いをBridge側で独自実装する。

特に重要なのは次の3層。

1. Wayfarer GCS取得
2. Pokémon GO entity判定
3. Google Map座標系へのネイティブ描画

既存WFMMがある環境ではWFMMを優先し、Bridge独自描画は競合させない。

## 現時点でできていること

- iPhone SafariでWayfarer GCS URLをPerformance Resource Timingから取得できる
- GCS replayでPOIを累積取得できる
- GUIDによる重複排除ができる
- PokéStop / Gym / Power Spotの分類ができる
- BridgeからCampsiteへ送信する既存経路がある
- PC/Android向けBridgeコードにもWFMM優先判定がある

## 今回やめるもの

iPhoneで使用中の、画面固定の擬似POI色丸レイヤーを最終方式にはしない。

理由:

- パンに対して後追いが出る
- ピンチズーム時に縮尺同期が難しい
- Wayfarerのsample表示切替で古い丸が残りやすい
- 地図本体と別レイヤーなので慣性移動に弱い

## 最終アーキテクチャ

```text
Wayfarer
  ↓
GCS Observer / Replay
  ↓
POI Parser
  ↓
Pokémon GO Classifier
  ├─ POKESTOP
  ├─ GYM
  ├─ POWERSPOT
  └─ HIDDEN
  ↓
Bridge POI Store
  ├─ GUID dedupe
  ├─ cumulative session store
  └─ latest viewport store
  ↓
Native Map Renderer
  ├─ Google Maps OverlayView / native map pane
  ├─ pan sync
  ├─ zoom sync
  └─ viewport clipping
  ↓
Bridge UI / Campsite Sender
```

## WFMM共存ルール

### WFMMあり

- 既存WFMMを最優先
- WFMMのMapインスタンスを利用できる場合は利用
- Bridge独自POI色丸は描画しない
- Bridgeは記録・送信を担当
- WFMM設定には触らない

### WFMMなし

- Bridge POI Engineが分類と描画を担当
- Userscripts/Tampermonkeyを必須にしない

### 二重起動防止

検出対象:

- `window.WFMM`
- WFMM固有DOM
- WFMM map API

## プラットフォーム

### iPhone

入口: Campsite Bridge Shortcut

- ShortcutからBridge runtime起動
- GCS取得は既存のPerformance Resource Timing方式を継続
- 最重要課題はGoogle Map本体またはOverlayView projectionの安定取得
- ネイティブMap Rendererが取れない場合のみ記録専用へフォールバック

### Android

入口: 無料Bridge配布

- Firefox系Bridge拡張または既存Android Bridge
- 既存WFMMがあれば優先
- WFMMなしでもBridge POI Engineで描画

### PC

入口: Campsite Bridge拡張

- Chrome/Edge/Firefox系
- Google Map capture + OverlayViewで描画
- 最も先にネイティブ描画の基準実装を完成させる

## 1週間MVP工程

### Day 1: Core整理

- classifierを共通モジュール化
- POI Storeを `cumulative` と `latest viewport` に分離
- WFMM detectionを共通化
- 既存iPhone擬似描画を切り離せる構造にする

完成条件:

- 同じGCS fixtureをiPhone/Android/PC共通classifierへ通して同じ結果になる

### Day 2: PC Native Renderer

- Google Map instance取得
- OverlayView projection接続
- PokéStop/Gym/Power Spotを地図pane上へ描画
- pan/zoom追従

完成条件:

- 地図を動かしても色丸がWayspot位置からズレない

### Day 3: Android移植

- 共通classifier/rendererをAndroid Bridgeへ統合
- WFMMあり/なし両方の分岐
- Android実機でpan/zoom確認

完成条件:

- WFMMなしでも正しい色付け
- WFMMありでは二重描画なし

### Day 4: iPhone Map Capture集中

- Angular context / Google Maps internals / DOM referenceの再調査
- native map capture成功経路を固定
- OverlayView projection取得

完成条件:

- iPhoneで `mapCaptured=true` / `projectionReady=true`

### Day 5: iPhone Native Renderer

- 画面固定fallbackからnative rendererへ切替
- pan/zoom/pinch/慣性移動
- sample表示切替

完成条件:

- 色丸が地図に貼り付いたまま動く
- 古いviewportの丸が残らない

### Day 6: 統合テスト

ケース:

- WFMMあり
- WFMMなし
- 初回起動
- Wayfarerリロード
- 大きなパン
- 小さなパン
- ピンチズーム
- 日本全体sample表示
- 通常表示復帰
- Reset
- Campsite送信

完成条件:

- 二重描画なし
- stale markerなし
- 累積記録は保持

### Day 7: 導入簡略化・MVPリリース

- iPhone Shortcut導入導線
- Android無料導入導線
- PC無料導入導線
- 診断表示を一般ユーザー向けに簡略化
- CAテスター向け説明

MVP完成条件:

- WFMMなしで3プラットフォームすべてPOI分類・色表示・Bridge送信が可能
- 既存WFMMユーザーは既存環境を壊さない

## 1週間での現実的な完成ライン

1週間で狙うのは「実用MVP」。

含む:

- POI分類
- 正しい色付け
- pan/zoom追従
- 自動記録
- Campsite送信
- WFMM共存
- iPhone / Android / PCでの基本実機動作

1週間に含めない可能性があるもの:

- ストア配布
- 完全自動アップデート
- あらゆるWayfarer UI変更への耐性
- 全端末・全OS版の長期互換性検証
- 高度なWFMM機能の再現

## 最大リスク

最大リスクはiPhone SafariでGoogle Map / OverlayView projectionを安定して取得できるか。

PCとAndroidは既存の拡張コンテキストから実装しやすい。
iPhoneだけMap captureが取れない場合は、MVP時点で「記録は完全対応、ネイティブ色表示のみ実験機能」として切り分ける可能性がある。

ただしGCS取得・POI分類・累積記録は既に解決しているため、プロジェクト全体が失敗するリスクは低い。

## Definition of Done

- WFMMなしでもPokéStop/Gym/Power Spotを正しく分類できる
- Not in Gameを表示しない
- 色丸が地図座標へ固定される
- pan/zoom/pinchでズレない
- viewport外の古い色丸を残さない
- 累積POIはResetまで保持する
- Campsiteへ送信できる
- WFMMありではBridge独自色丸を止める
- iPhone / Android / PCで同じclassifierを使う

## プロジェクト名

**Campsite Bridge POI Engine**

位置づけ:

Campsite Bridgeの共通POI判定・描画エンジン。WFMMの代替そのものではなく、Campsiteに必要なPOI分類・色表示だけを独立実装する。
