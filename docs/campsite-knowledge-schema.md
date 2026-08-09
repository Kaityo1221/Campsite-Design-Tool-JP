# Campsite知見データ仕様 v1.0

全国CAから集める経験や、Campsite Design Toolで使う固定ルールを、後から診断へ安全に組み込める形で管理するための仕様です。

## 目的

自由記述だけを大量に集めるのではなく、アプリで条件分岐・表示・レビューができる形にそろえます。

診断コメントは次の3種類に分けます。

- `required`：必須確認
- `recommended`：推奨
- `experience`：経験則

AIによる自由生成は初期方式にしません。登録済みで説明可能なデータだけを表示します。

## 必須項目

各知見は以下の項目を持ちます。

```js
{
  id: "experience-example-id",
  level: "experience",
  category: "traffic",
  targetCondition: {
    type: "siteCondition",
    key: "bottleneck"
  },
  advice: "表示するアドバイス本文",
  importance: 2,
  evidence: "この助言の根拠や実例",
  contributor: "情報提供者または管理主体",
  confirmedAt: "2026-08-10",
  regionalVariation: true,
  publicationAllowed: false
}
```

## 項目の意味

### `id`

重複しない識別子です。一度公開したIDは、意味を変えて使い回さないでください。

### `level`

- `required`：距離、追加POI上限、レイヤー分けなど、提出前に必ず確認するもの
- `recommended`：回遊性、待機場所、通行への配慮など、現地条件に合わせて考えるもの
- `experience`：全国CAの事例をもとにした補足助言

### `category`

知見の分類です。例：

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

`level`とは別です。例えば経験則でも重要度3の事例はあり得ますが、必須ルールへ自動昇格はしません。

### `evidence`

その知見の根拠です。

例：

- 実際のイベントで起きた滞留
- 現地下見で確認した人流
- 複数CAで同じ傾向を確認
- 現行ツールの固定ルール

### `contributor`

情報提供者または管理主体です。

公開画面へそのまま氏名を表示することを意味しません。内部レビュー用の記録として保持します。

### `confirmedAt`

最後に内容を確認した日です。`YYYY-MM-DD`形式を基本とします。

### `regionalVariation`

地域差や会場差が大きい場合は `true`。

全国共通の固定条件として扱えるものは `false`。

### `publicationAllowed`

利用者画面へ表示してよい内容だけ `true` にします。

情報提供を受けた時点では、原則 `false` からレビューを始めます。

## 経験則の登録フロー

1. CAから事例を受け取る
2. 必須項目を埋める
3. 内容・根拠・地域差を管理者が確認する
4. 重複する既存知見がないか確認する
5. 必要なら表現を一般化する
6. 公開して問題なければ `publicationAllowed: true`
7. `CAMPSITE_EXPERIENCE_KNOWLEDGE` へ登録する

## 初期方針

経験則は空の状態から開始します。

Issueで例として挙げている、

- 狭い通路にジムとパワースポットを集中させない
- 入口付近に滞留ポイントを作りすぎない
- 活動エリア内に複数の回遊ルートを確保する

といった内容も、例であるだけでは実データへ自動登録しません。

実際の提供情報と根拠をレビューした後に、正式な経験則として追加します。

## 実装上の原則

- 必須確認・推奨・経験則を同じ見た目・同じ重さで扱わない
- 経験則から自動で合否判定を作らない
- 地域差のある知見を全国共通ルールへ自動変換しない
- 未確認の自由記述をそのまま利用者へ表示しない
- 情報提供者の公開可否と、知見本文の公開可否を混同しない
- 将来AIを使う場合も、登録済み知見の検索・要約から始める
