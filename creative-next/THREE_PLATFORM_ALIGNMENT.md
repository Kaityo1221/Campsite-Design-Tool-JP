# 3プラットフォーム統合仕様・差分管理（設計ドラフト）
**2026-10-10 / isolated development only / PO review required**

対象：**Wayfarer Map → Creative Mode → Campsite Design Tool**。
単独プラットフォームのPASSは、3者結合E2EのPASSではない。この文書は合意済み仕様を参照し、差分を可視化するための統合チェックリスト。未合意の点は実装仕様として確定しない。

## 参照元と優先順位

1. [Wayfarer Observe Flow v1](../docs/wayfarer-observe-flow-spec-v1.md): WM-0でFROZEN（新フローの所有権、再観察、参照POI等）。
2. [Creative Next共通仕様](SPECIFICATION.md): Creative Next隔離編集・KMZ・保存・安全性の要約正本。2026-10-10更新。
3. [実KMZ受入記録](phase-1b/REAL_KMZ_ACCEPTANCE_2026-10-10.md): 葛西・光が丘のコピーに対する例外とiPhone報告。実KMZのGitHub公開は禁止。
4. 最終判断は PO の明示承認。文書間に食い違いがあれば **差分としてHOLD** し、コードの偶然の挙動で決定しない。

## 3者の責務（WM-0の合意を維持）

| 担当 | 役割 | 正本データ | 編集可能性 |
| --- | --- | --- | --- |
| Wayfarer Map | 最初の設計ポリゴンを作成し、拠点+200mを観察、完全性と観察時点を記録 | Wayfarer観察スナップショット（観察根拠） | 初回はポリゴン作成。Campsite受渡し後に戻る場合はポリゴン**参照のみ** |
| Creative Mode | 既存UI→records→refresh→Adapter→Geometry→Unified Scene→keyed Renderer→Leaflet の編集導線 | 編集中の `records` と Campsiteの最新ポリゴン | 検証済みで許された操作だけ編集。外周参照POIは読取専用 |
| Campsite Design Tool | プロジェクト境界・正本ポリゴン管理、次の観察に必要な状態・差分の受渡し | `campsiteProject.v1` / project schema 1.0。初回受渡し後はCampsiteの最新ポリゴンが正本 | 観察スナップショットを無断で上書きせず、ユーザー確認のもと更新 |

> **名称と責務の確認:** 「Campsite Design Tool」はアプリ全体の名称でもある。上の3分割は論理的な機能境界であり、3個の独立した実装・保存マスターを新設する指示ではない。

## 3者共通データ契約（突き合わせ項目）

| キー | Wayfarer Map | Creative Mode | Campsite Design Tool | 結合検証 |
| --- | --- | --- | --- | --- |
| プロジェクト同一性 | `campsiteProject.v1`と受渡し対象 | 同じプロジェクトを継承 | project schema 1.0を保持 | 同一IDでの移動・更新・再開 |
| ポリゴン | 初回作成、受渡し後は参照 | Campsite側で編集 | 初回受渡し後の**正本** | 変更→予備取得範囲判定→再観察、既存作業維持 |
| 観察範囲 | ポリゴン+200m。画面ズーム・viewportに依存させない | 内部+外周100m可視、100–200m予備は非表示 | 結果・取得時刻・coverageを保持 | 3ゾーン分類の件数一致 |
| POI識別 | GUID/poiIdを安定IDとして受渡し | 元POIと新規候補を分離 | リモート基準スナップショットと編集中状態を分離 | 同名・座標変更でも誤マージしない |
| POI種類 | PokéStop/Gym/Active・Inactive PowerSpot | PowerSpot2状態保持、表示は同じ紫菱形 | 状態保持、`NOT_IN_GAME`は新フロー表示対象外 | active/inactiveの区別が往復で失われない |
| 外周参照POI | 取得し識別 | +0–100m:薄く表示、**移動/削除/改名不可**、50m円のみ | 独立した参照セット | `records`に無理に混ぜずUI表示と距離警告に参加 |
| 再観察 | 明示的「🔭 拠点内を観察」、完全性検査 | 編集を保持したまま差分レビュー | snapshot2回連続欠落で削除候補化 | 取得失敗で消失カウントを増やさない |
| 距離警告 | 50m対象POIを取得 | 50m未満は**警告のみ**、配置は禁止しない | 同じ意味の状態を維持 | 既存/新規/外周で距離再計算 |
| ファイル交換 | 観察由来のデータと完全性情報 | `NEW_V1` KMZの保存/書出と source-aware 保護 | `campsiteProject.v1`とKMZの変換/再開境界 | ID,座標,役割,円owner/半径,エリアを無損失で橋渡し |
| 保存・復旧 | 未完了draftを成功handoffまで維持 | 2世代SHA-256 + Web Locks + strict IDB | 正本プロジェクトが勝手に旧保存と混ざらない | タブ競合/クラッシュ後/容量不足の3者一貫性 |

## 仕様差分（重要、PO判断・設計証明までHOLD）

| ID | 差分 | 根拠 | 決めること | 初期扱い |
| --- | --- | --- | --- | --- |
| X-01 | WM-0: **1プロジェクト1ポリゴン・3～30頂点** / Creative Next: **複数活動範囲64・3～512頂点** | WM-0 §4 と Creative Next §2.2 | 「設計正本ポリゴン」と「追加活動範囲」の型を分離し、どちらをWM-0の30頂点制限対象とするか | **未統合/HOLD**。無断で頂点数切捨てしない |
| X-02 | Wayfarer再観察で同一GUIDの座標変更 / Creative既存POIの座標ロック | WM-0 §16–18 と Creative Next §2.2 | 観察ベースの位置更新と手動編集不可ルールを区別する更新トランザクション | **HOLD**。手動編集ロックを緩めない |
| X-03 | 外周0–100m参照POIを表示し距離警告する設計 / 現隔離プレビュー中心の単一KMZ編集モデル | WM-0 §11–13 | 参照POI専用adapter/sceneと非保存モデル、選択UI、所有者を確定 | **未結合/HOLD** |
| X-04 | `campsiteProject.v1` 1.0 / `NEW_V1` KML ExtendedData | WM-0 §1, Creative Next §2.1 | 意味的なversion・identity・polygon・状態・観察の双方向マッピング/失敗処理 | **未結合/HOLD** |
| X-05 | 新規Gym上限8 / 光が丘旧ファイルに新規Gym9 | Creative Next §2.2 と実KMZ受入記録 | 既存9件の保持、新たな10件目や種類変更禁止。UIと全出口で一致するか | 既存9件維持。合成回帰対象、最終ゲート別 |
| X-06 | WM-0の再観察・欠落2回/90日閾値 / r10–r12の実機PASS範囲 | WM-0 §15–18 と実KMZ受入記録 | end-to-end再観察差分が未試験であること | **E2E未PASS** |
| X-07 | プレビューは独立保存名前空間 / 既存Creativeは旧保存 | Creative Next §3 | 本番統合時のユーザー同意、migration、破損/競合時切戻し | **本番接続禁止** |

## 整合手順（3つを別々にPASSして完了扱いしない）

1. **仕様差分判定**: X-01～X-07を1項目ずつ PO と確認、採用/修正/HOLDを記録。
2. **インターフェース契約**: `campsiteProject.v1`と`NEW_V1`、source ID、外周参照、更新/消失状態の情報損失のないadapterを仕様化する。
3. **隔離3者E2E**: Wayfarerポリゴン作成→範囲+200m完全取得→POI表示→Campsiteへ受渡し→Creative編集→保存→再開→Wayfarer再取得→差分承認まで確認。
4. **回帰**: 旧Creative Mode、Campsite Design Tool本番導線、保存/復旧/ブラウザ戻る、iPhone/PC、実KMZ原本・生成出力を個別に検証。
5. **公開ゲート**: 実装レビュー、CI、原本の非公開管理、明示的PO承認、切戻し手順の確認。承認前に`main`反映しない。

## 2026-10-10 時点の実証範囲

- Creative Next r10のiPhone基本編集/保存復元/不正KMZ拒否と、r12の葛西・光が丘の**承認済み変換用コピー**に対する変換→出力→再取込は**ユーザー報告PASS**。
- ブランチの隔離CIは複数回PASS。公開本番の3者結合はまだ未実施。
- Vercel追加ビルドには頻度制限の報告があるため、追加デプロイを無断で連打しない。
- 残りの安全性異常系、UI整合、全体E2E、公開切替は未合格。開発進捗80%は**工程ベース推定**で、3者統合の完成度を独立評価した値ではない。
