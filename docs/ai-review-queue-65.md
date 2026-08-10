# AI要確認レビューキュー 65件

2026-08-10 のAI一次判定で、人間確認へ回した未分類POI 65件を `alias_review_queue.suggested_category = AI_REVIEW` として識別する管理者レビュー補助です。

## 動作

- 管理者の「未分類レビュー」に `🤖 AI要確認` / `🧩 すべての未分類` の切替を追加
- 初期表示は `AI要確認`
- AI要確認の残件数を表示
- 既存の分類ボタンと保存処理をそのまま利用
- 人間が分類すると `suggested_category` が実カテゴリへ更新されるため、AI要確認件数から自動的に減る
- 通常の未分類レビューへいつでも切替可能

## データ安全

- 新規テーブルなし
- 既存の `review_status = pending` を維持したまま `suggested_category` に一時タグを設定
- 辞書への自動反映なし
- AI判定を正式判定として保存しない

## 検証

- Supabase上で `review_status = pending AND suggested_category = AI_REVIEW` が 65件であることを確認済み
