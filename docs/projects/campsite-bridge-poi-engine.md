# Campsite Bridge POI Engine Project

## 0. 最上位要件

このプロジェクトは **Campsite Bridge単体で完結する**。

WFMMは必須依存にしない。WFMMのコード・API・内部状態が無くても、Bridgeだけで次を行えることを完成条件とする。

- WayfarerからPOI情報を取得
- Pokémon GO上の種別を判定
- PokéStop / Gym / Power Spotを色分け表示
- Not in Game / inactiveを非表示
- 地図のpan / zoom / pinch / 慣性移動へ追従
- POIを累積記録
- Campsiteへ送信

一方、既にWFMMを利用しているユーザーの環境は壊さない。

**WFMMを検知した場合は、WFMMの表示を優先してBridge独自の色描画だけ停止する。Bridgeの記録・分類・送信はWayfarerから独立して継続する。**

Bridge CoreはWFMM APIへ依存しない。

---

## 1. 目的

WFMM全体を再現するのではなく、Campsiteに必要な次の技術だけをBridge側で独自実装する。

1. Wayfarer POI取得
2. Pokémon GO POI判定
3. 地図座標への正確な色描画

表示仕様:

- PokéStop: 青
- Gym: 赤
- Power Spot: 紫
- Not in Game / inactive: 非表示

---

## 2. 設計原則

### A. Bridge単体が本体

`WFMMなし` を標準テストケースとする。

WFMMが無い状態で全機能が成立しなければMVP完成とはしない。

### B. WFMMは「互換対象」であって「依存先」ではない

既存WFMMを検知したら:

- WFMMのPOI表示をそのまま残す
- Bridge独自の色丸だけ描画しない
- BridgeはWayfarer通信から独自にPOIを記録する
- Bridge classifierは通常通り動く
- Campsite送信は通常通り動く
- WFMM設定・DOM・キャッシュを書き換えない
- WFMMをアンインストール・無効化させない

### C. 二重描画禁止

同じPOIにWFMMとBridgeの色表示が重なる状態を禁止する。

### D. WFMMコードをコピーしない

WFMMが実現している「結果」を参考にし、Bridge側で独立実装する。

---

## 3. モード

### Standalone Mode

条件: WFMMなし

```text
Wayfarer
  ↓
GCS Observer / Replay
  ↓
Bridge POI Parser
  ↓
Pokémon GO Classifier
  ↓
Bridge POI Store
  ↓
Bridge Native Map Renderer
  ↓
Bridge UI / Campsite Sender
```

Bridgeだけで完結する。

### WFMM Compatibility Mode

条件: WFMM検知

```text
Wayfarer
  ├─ WFMM → WFMMの地図表示
  └─ Bridge → 記録 / 分類 / Campsite送信
```

Bridge Native Map Rendererだけ停止する。

Bridgeのデータ取得処理はWFMMに依存しない。

---

## 4. WFMM検知

複数シグナルで判定する。

候補:

- `window.WFMM`
- WFMM固有DOM
- WFMM固有class / id

検知は「描画抑止」のためだけに使用する。

WFMMのMapインスタンスや内部APIをBridge Coreの必須経路にはしない。

起動直後の読み込み競合対策として短時間監視を行い、途中でWFMMが現れた場合もBridge独自描画を停止する。

---

## 5. POI Engine内部構成

```text
bridge-poi-engine/
├ classifier
│  ├ POKESTOP
│  ├ GYM
│  ├ POWERSPOT
│  └ HIDDEN
├ gcs-parser
├ store
│  ├ cumulative
│  └ latestViewport
├ wfmm-detector
├ map-adapter
├ renderer
└ diagnostics
```

### cumulative store

Resetまで取得済みPOIを保持する。
GUIDで重複排除する。
Campsite送信はこちらを使用する。

### latestViewport store

現在表示範囲の描画専用。
古いviewportのPOIを残さない。

この2つを混ぜない。

---

## 6. 現在すでに解決している部分

- iPhone SafariでWayfarer GCS URLをPerformance Resource Timingから検出
- GCS replay
- POI累積取得
- GUID重複排除
- PokéStop / Gym / Power Spot分類
- Campsite送信経路
- WFMM存在判定の基礎

最大の未解決点は **iPhone SafariでMap本体 / projectionを安定取得し、画面固定ではない地図ネイティブ描画にすること**。

---

## 7. 廃止する最終方式

現在のiPhone画面固定POIレイヤーは、検証用途を除き最終方式にはしない。

理由:

- pan後追い
- pinch同期の難しさ
- 慣性移動
- sample表示切替
- stale marker

最終版は地図座標系へ直接載せる。

---

## 8. プラットフォーム

### iPhone

入口: Campsite Bridge Shortcut

必須:

- Bridge単体起動
- GCS取得
- classifier
- native map renderer
- WFMM検知時は独自描画停止

### Android

入口: 無料Bridge配布

必須:

- Bridge単体で分類・色描画
- 既存WFMMが同じブラウザで動いていれば独自描画停止
- 記録・送信は継続

### PC

入口: Campsite Bridge拡張

必須:

- Bridge単体で分類・色描画
- Chrome / Edgeを基準実装
- WFMMありでも二重描画なし

---

## 9. 1週間MVP工程

### Day 1: Core分離

- GCS parser共通化
- classifier共通化
- `cumulative` / `latestViewport` store分離
- WFMM detector共通化
- fixtureテスト

完了条件:

- 同じGCS fixtureを3平台で同じ分類結果へ変換
- WFMM無しでもclassifierが完全動作

### Day 2: PC Native Renderer

- Google Map instance取得
- OverlayView / projection接続
- 青 / 赤 / 紫描画
- viewport clipping
- pan / zoom追従

完了条件:

- WFMMなしPCで色丸がWayspot位置からズレない

### Day 3: Android

- 共通POI Engine統合
- native renderer統合
- WFMM detector統合
- WFMMあり/なしテスト

完了条件:

- WFMMなしでBridge単体色表示
- WFMMありで二重描画なし

### Day 4: iPhone Map Capture

最重要日。

- Angular context
- Google Maps internals
- DOM reference
- OverlayView projection
- Shortcut実行コンテキスト

を再検証し、Bridge単体でMap captureする。

完了条件:

- `mapCaptured=true`
- `projectionReady=true`
- WFMMなしで成立

### Day 5: iPhone Native Renderer

- 画面固定fallbackからnative rendererへ切替
- pan
- zoom
- pinch
- 慣性移動
- sample表示
- 通常表示復帰

完了条件:

- 色丸が地図座標へ固定
- stale markerなし

### Day 6: 共存・統合テスト

全平台で:

- WFMMなし
- WFMMあり
- WFMM遅延起動
- 初回起動
- Wayfarer reload
- 大小pan
- pinch zoom
- sample表示
- Reset
- Campsite送信

完了条件:

- WFMMなしでBridge単体完結
- WFMMありでWFMM表示へ干渉しない
- Bridge記録は継続
- 二重描画なし

### Day 7: MVPリリース

- iPhone無料導線
- Android無料導線
- PC無料導線
- 一般向け診断簡略化
- テスター説明
- 回帰テスト

---

## 10. MVP Definition of Done

以下をすべて満たしてMVP完成とする。

- WFMMをインストールしていなくても動く
- Bridge単体でPokéStop / Gym / Power Spotを判定
- Not in Game / inactive非表示
- Bridge単体で地図上へ正しく色付け
- pan / zoom / pinch / 慣性移動でズレない
- latest viewport以外の古い丸を残さない
- POI累積記録はResetまで保持
- Campsiteへ送信できる
- WFMMを検知できる
- WFMM検知時はBridge独自色描画を停止
- WFMM設定や表示に干渉しない
- WFMMが途中から起動しても二重描画しない
- iPhone / Android / PCが同じclassifierを使用

---

## 11. 1週間での見込み

**実用MVPは1週間を目標にできる。**

ただし最大リスクはiPhone Safariのnative map capture。

Day 4終了時点でiPhoneのprojection取得が成立しない場合は、その場で方式を再評価する。

PC / Androidだけ完成してiPhone問題を隠したまま「完成」とはしない。

---

## プロジェクト名

**Campsite Bridge POI Engine**

位置づけ:

WFMMの代替製品ではない。
Campsite Bridgeが必要とするPOI判定と地図描画を、Bridge単体で実現するための独立エンジン。