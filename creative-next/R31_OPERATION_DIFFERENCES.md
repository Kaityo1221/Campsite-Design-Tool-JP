# r31 操作差分台帳（2026-10-11）

| ID | 操作 | 現行参照の診断 | r31の受入仕様 | 承認範囲 | 状態 |
| --- | --- | --- | --- | --- | --- |
| R31-PLUS-2STEP-2026-10-11 | ＋の通常touch | pointerupでmenuが開き、後続clickが重なるPowerSpotへ入り、最初のtapで意図しない選択。3種×3幅の既存9 FAILを保持 | 第一tapは3種menuのみ。次の明示tapで指定種preview。確定は独立してHOLD | POの今回指示。二重イベント防止だけ。他操作/UI比較/安全検査は除外不可 | APPROVED・実測受入必須 |

基点ソース05fb48953e335f2438996bac5b480e1b02cc196e、証跡HEAD37ba2595e4f0cb405e6723aea139b98e352a5997。

旧9件はqa/r31/reference-plus-diagnostic-baseline.jsonにFAILのまま保存。再測定はreference-plus-diagnostic.json。候補側は独立contextのplus-acceptance.jsonで別判定し、参照FAILを候補PASSへ変換しない。

未承認操作差は0でなければHOLD。承認外の操作を参照診断へ移して免除することも禁止。完全UI比較156場面と7グループの他必須操作は維持する。
