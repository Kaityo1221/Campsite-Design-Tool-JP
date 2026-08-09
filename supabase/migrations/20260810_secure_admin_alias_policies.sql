-- Issue #51: 管理者レビュー操作を admin-alias-access へ移した後に適用する。
-- 注意: フロント切替前に本番へ適用すると、現行mainの管理者レビューが動かなくなる。

-- alias_review_queue
-- 一般利用から未分類候補を送るINSERTは現状維持する。
-- 管理者向けSELECT / UPDATEはEdge Function(service_role)へ限定する。
drop policy if exists "Allow anon select alias review queue" on public.alias_review_queue;
drop policy if exists "Allow anon update alias review queue" on public.alias_review_queue;
drop policy if exists "alias_review_queue_select_pending_for_review" on public.alias_review_queue;
drop policy if exists "alias_review_queue_update_review_result" on public.alias_review_queue;

revoke select, update on table public.alias_review_queue from anon;
grant insert on table public.alias_review_queue to anon;

-- alias_master
-- 一般機能のPOI辞書判定に active=true の公開読込が必要なので、
-- active-only SELECT は残す。管理者のINSERT / UPDATEはEdge Functionへ移す。
drop policy if exists "Allow anon insert alias_master" on public.alias_master;
drop policy if exists "Allow anon update alias_master" on public.alias_master;
drop policy if exists "Allow anon select alias_master" on public.alias_master;

revoke insert, update on table public.alias_master from anon;
grant select on table public.alias_master to anon;

-- `Allow public read alias_master` (active = true) は意図的に残す。
