# Creative Next U2 地図中心UI表示専用版 / 2026-10-10

## 判定
- **隔離UIシェル U2: Chromium自動検査PASS**（iPhone Safari実機・編集/保存接続のPASSではない）。
- 正規Creativeの既存地図UIを参照し、地図中心・全画面・フローティング＋/道具箱/レイヤー・2分割下部操作・ルールカルーセルを独立パスに追加。
- 既存Creativeのランタイムを丸ごとiframe/複製していない。旧ランタイムの二重保存・二重履歴を防ぐため、**実編集機能・保存/復元・KMZ・Wayfarerデータ受渡しは未接続**。
- PO承認の地図UI方針と参照実装: `UI_BASELINE_MAP_FIRST_2026-10-10.md` / `UI_ADAPTER_BOUNDARY_2026-10-10.md`。

## 実装
- `creative-next/map-ui-preview/index.html`
- `creative-next/map-ui-preview/ui.css`
- `creative-next/map-ui-preview/ui.js`
- `creative-next/map-ui-preview/assets/{gym,pokestop,powerspot}.png`（既存のCreativeアイコンGit blobを再利用）
- `creative-next/qa/map-ui-preview-gate.py`
- `.github/workflows/creative-next-map-ui.yml`

## GitHub検査
- PASS: [Creative Next Map First U2 isolated UI #38047146347](https://github.com/Kaityo1221/Campsite-Design-Tool-JP/actions/runs/38047146347)
- 検査対象ソース: `863114e37a93d767e594f708a751318de2df093d`。
- Chromium mobile 375/390/430pxでの起動・Map First切替、レイヤー・POI・道具箱・ヘルプパネル、参照POIアイコン3点の画像読込、基本タッチ領域、Safari相当のWeb履歴操作、preview localStorage非書込を確認。
- **検査用ViewportはSafariそのものではない**。デザイン見た目はPOのiPhone Safari実機確認待ち。

## 隔離配信
- URL: https://kaityo1221.github.io/campsite-creative-next-preview/map-ui-r15/index.html
- GitHub Pages r15は上記成功ソースに固定（pin）。r9〜r14の旧版ソース・保存領域はそのまま。
- 画面上に「UIデザイン確認専用」「編集・保存は未接続」と明示。データの偽保存成功は表示しない。
- 以前の起動背景は既存Creativeと同じ別リポジトリの固定リビジョン画像への参照。配信後の実機背景表示・視認性はPO確認を要する。

## 次の工程 U3
1. POによるiPhone実機の画面レビュー。配信SUCCESSだけでUI承認とはしない。
2. 旧Creative UIの操作DOMとr14 `createIsolatedEditorSession`を一機能ずつ接続し、状態と保存の単一正本を維持。
3. Wayfarer Map→Creative→Campsite Design Tool結合差分X-01〜X-07は別ゲートHOLD。
4. 保存成功はlocalStorageジャーナル検証とstrict IndexedDB両方が成功した場合のみ。
5. PC/Android完成版・旧本番UIは変更しない。本番mainへはPO明示承認までマージしない。

## 進捗表現
- iPhone内部機能工程は前回 **85%**、現在 **85%（±0）** を維持。
- 既存のr13安全性85%ゲートPASSを取り消さず、UIは90%まで未達。
- U2の達成をCreative全機能完成または本番使用可能と誤認させない。
