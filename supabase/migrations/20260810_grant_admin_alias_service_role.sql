-- Issue #51
-- 管理者POIレビューを Edge Function + service_role 経由で行うための権限。
-- anon / authenticated への権限追加は行わない。

grant select, update
on table public.alias_review_queue
to service_role;

grant select, insert, update
on table public.alias_master
to service_role;
