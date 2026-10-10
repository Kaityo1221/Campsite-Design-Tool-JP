# Creative Next: 現行Creative Mode完全UI互換ゲート（2026-10-10）

**POの正式方針：PC/Android/iPhone共通で、Creative Modeの表面的なUIは現行のまま。iPhoneだけ独自デザインにしない。**

## 1. r15（map-ui-r15）判定：**デザイン不採用・隔離サンプルとして保管**

- r15は `creative-next/map-ui-preview/` に独自DOMと独自CSSを作ったため、現行UIの正確な複製ではなかった。
- 背景に `creative-mode-opening.png` を利用していたが、現行の `creative/runtime/creative-patches-v58-new-entry-current-map.js` が指定するのは **`../assets/creative-mode-opening-final.webp`**。画像が違う。
- r15独自の＋・道具箱・レイヤー・ルールパネル位置や寸法も現行と異なる。
- 2026-10-10にr15隔離ブランチへ作成した「パネル小型化案」は**採用しない**。一般向けUIへのデプロイ禁止。既存試験用r9〜r14と保存領域は保持。
- r15の写真背景をiPhoneで表示できたことは一工程の描画試験であり、現行UIとのデザイン同等性PASSを意味しない。

## 2. 現行コードを唯一のビジュアル正本とする

GitHub `main` から2026-10-10に実コード・Git blob SHAを照合済み。
- 起動エントリ: `creative/index.html` + `creative/runtime/runtime-vnext.html`
- **現行背景**: `assets/creative-mode-opening-final.webp`（blob `fa340c1f0e88f6f1d072d75cfa25905637616d3b`）
- 起動/画面の表示: `creative/runtime/creative-patches-v58-new-entry-current-map.js`
- 地図の全画面レイアウト/下部UI: `creative/runtime/creative-patches-v45-unified-map-ui.js`
- ヘルプとルール: `v59-help-button.js`, `v60-rules-carousel.js`
- 前回データ案内: `v61-saved-session-hint.js`
- POI形状/ボタン/保存UI寸法: `v73-production-visual-fixes.js`
- 道具箱、追加、参考円、活動範囲の案内: `v74`, `v75`, `v76`, `v77`
- その他パッチも `creative/index.html` の適用順を厳守する。パッチの一部だけを模写・抽出して完成UIと呼ばない。

確認した主要UIファイルは現在の開発用 `feature/creative-next-kmz-phase1b-20261009` と現行 `main` のGit blob SHAが一致。新UIの接続はそこを出発点にする。

## 3. **変更禁止**（会長のUI承認なし）

- 背景画像・タイトル・起動演出・アイコン・POI表現・地図タイルの基本表示
- ボタンの位置・幅・高さ・色・角丸・フォント・順序・タッチ位置
- ＋メニュー、道具箱、レイヤー、保存、戻る、やり直し、ルールカルーセルの開閉位置と見た目
- 追加/削除済みのボタンを勝手に復活させない（現在地含む）
- 新フロー用を理由にiPhoneだけカード・大型モーダル・新しい下部ドックなどを導入しない

文章・エラー表示は安全性のため必要なら変更可能だが、長文化でレイアウトがずれないよう個別監査する。

## 4. 変更対象は内側だけ

- 新エンジンのPOI・活動範囲・Undo/Redo・保存・復元・KMZの堅牢化を**既存UIイベントの内側に接続**する。
- `records → refresh() → Candidate Adapter → Geometry → Unified Scene → keyed Renderer → Leaflet` のread-following方針と単一正本を維持する。
- 既存の旧保存キーとr13/r14ジャーナルを暗黙に混ぜない。自動移行・無断上書き禁止。
- フロー統合（Wayfarer Map → Creative Mode → Campsite Design Tool）は別E2Eゲート。
- 旧Creative Modeの本番コード自体には触れず、隔離ランタイムに接続層を置く。一般公開OFFのまま。
- 見た目を維持して機能を接続できない場合は**STOP**、代替UIへ独断で切り替えない。

## 5. 自動検査と受入基準

`node creative-next/qa/current-creative-ui-source-parity.cjs` は現行ビジュアルの主要ソースと背景・演出画像のGit blobを比較し、改変にFAILする。

ただし、**同一blob＝同一画面の保証ではない**。新しい隔離ランタイムで動作した結果のピクセル差・表示寸法/タップ領域/パネル位置/重なりは現行UI実機と比較する。

90%判定には、現行UIとのビジュアル一致をiPhone Safariで会長が確認すること、かつ内部操作導線が正常であることが必要。旧r13安全性85%正式PASSは維持。

開発進捗：**85%（±0）**。次目標90%。本番mainマージ・一般公開・Vercel不要デプロイはPO明示承認まで禁止。
