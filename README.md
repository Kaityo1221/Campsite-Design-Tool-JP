# 葛西臨海公園 POIレビュー比較ページ v10

## 変更点

- 前回方式に合わせ、Supabase送信は `window.campsiteSupabase` を利用します。
- `review-test.js` に Publishable key を直接持たせません。
- `review.html` の読み込み順を以下にしました。

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="js/lab-supabase.js"></script>
<script src="js/review-test.js"></script>
```

## 上書き対象

- `review.html`
- `css/review-test.css`
- `js/review-test.js`
- `js/lab-supabase.js`

## 注意

`js/lab-supabase.js` には Publishable key のみを入れています。
Secret key / service_role は絶対に入れないでください。


## v10
送信失敗時に Supabase の message / code / details / hint を画面に表示します。


## v11 修正

- `source_queue_id` を UUID 形式に変更しました。
- Supabase の `source_queue_id` カラムが uuid 型でも送信できます。
- `onConflict: test_batch_id,source_queue_id,reviewer_name,reviewer_type` はそのまま使います。
