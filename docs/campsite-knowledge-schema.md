# Campsite知見データ仕様 v1.1

Campsite Design Toolで使う固定ルールと、管理者が実際の完成KMZを確認して得た観察を、後から安全に診断へ組み込める形で管理するための仕様です。

## 目的

利用者向けアドバイスは、次の2種類に分けます。

- `required`：必須確認
- `recommended`：推奨

利用者画面に「経験則」という独立カードは表示しません。

知見を増やすために全国CAへ自由記述のアンケートを依頼する運用も基本としません。

代わりに、管理者がデータベースに保存された実際の完成KMZを確認し、繰り返し現れる設計傾向を観察します。同じ傾向が複数の事例で確認でき、一般化して問題ないと管理者が判断したものだけを、正式な `recommended` 項目へ昇格させます。

AIによる自由生成は初期方式にしません。登録済みで説明可能なデータだけを利用します。

## 利用者向け知見の必須項目

```js
{
  id: "recommended-example-id",
  level: "recommended",
  category: "traffic",
  targetCondition: {
    type: "siteCondition",
    key: "bottleneck"
  },
  advice: "表示するアドバイス本文",
  importance: 2,
  evidence: "この助言の根拠",
  sourceType: "fixed_rule",
  sourceRef: "campsite-design-tool",
  confirmedAt: "2026-08-10",
  regionalVariation: true,
  publicationAllowed: true
}
```

### `level`

- `required`：距離、追加POI上限、レイヤー分けなど、提出前に必ず確認するもの
- `recommended`：回遊性、待機場所、通行への配慮など、現地条件に合わせて考えるもの

### `category`

例：

- `distance`
- `poi-count`
- `layer`
- `traffic`
- `route`
- `waiting`
- `rest`
- `safety`
- `density`
- `other`

### `targetCondition`

その知見を表示する条件です。

自由文ではなく、できるだけ構造化します。

例：

```js
{ type: "siteCondition", key: "bottleneck" }
```

```js
{ type: "addedPoiCount", operator: ">", value: 25 }
```

### `advice`

利用者へ表示する短い助言です。

合否を断定する表現より、「何を確認するか」「何を意識するか」が分かる文章を優先します。

### `importance`

- `3`：高
- `2`：中
- `1`：補足

### `evidence`

その知見の根拠です。

例：

- 現行ツールの固定ルール
- 管理者が複数の完成KMZで同じ傾向を確認
- 現地下見やレビュー結果で繰り返し同じ修正が発生

### `sourceType`

- `fixed_rule`：現行ツールで既に確定している方針
- `kmz_review`：管理者による完成KMZレビューから得た知見

### `sourceRef`

根拠を追跡するための内部参照です。

固定ルールなら管理元、KMZレビューならレビュー記録IDや案件IDなどを保持します。

### `confirmedAt`

最後に内容を確認した日です。`YYYY-MM-DD`形式を基本とします。

### `regionalVariation`

地域差や会場差が大きい場合は `true`。

全国共通の固定条件として扱えるものは `false`。

### `publicationAllowed`

利用者画面へ表示してよい内容だけ `true` にします。

## KMZレビュー観察データ

管理者がデータベースから完成KMZを確認して見つけた傾向は、すぐ利用者向けアドバイスにはしません。

まず内部観察として記録します。

```js
{
  id: "review-observation-001",
  category: "traffic",
  observation: "入口付近へ追加POIが集中する事例が複数ある",
  evidence: "完成KMZレビュー3件で同様の配置を確認",
  sourceType: "kmz_review",
  sourceRef: "review-batch-202608",
  confirmedAt: "2026-08-10",
  regionalVariation: true,
  promotionStatus: "candidate"
}
```

### `promotionStatus`

- `candidate`：観察中。利用者には表示しない
- `promoted`：十分な根拠があり、推奨へ昇格済み
- `rejected`：一般化しないと判断

## 推奨へ昇格する流れ

1. 管理者がデータベースから実際の完成KMZを確認する
2. 気になる配置や繰り返し現れる傾向を観察メモとして残す
3. 別のKMZでも同じ傾向が起きているか確認する
4. 地域差・会場差が大きすぎないか確認する
5. 一般化して利用者へ案内する価値があるか管理者が判断する
6. 採用する場合だけ、`recommended` の正式知見として登録する

## 重要な原則

- KMZレビュー観察は利用者画面へ直接表示しない
- 1件のKMZだけで全国共通の推奨へ昇格しない
- 地域差のある傾向を必須ルールへ自動変換しない
- 管理者判断なしで自動昇格しない
- 未確認の自由記述をそのまま利用者へ表示しない
- AIによる自由生成から始めない
- AIを将来使う場合も、登録済み知見の検索・整理を補助する用途から始める

## 初期状態

KMZレビュー観察データは空の状態から開始します。

知見を集めるための新しい作業をCAへ課すのではなく、通常の管理者レビューの中で自然に見つかったパターンだけを蓄積していきます。
