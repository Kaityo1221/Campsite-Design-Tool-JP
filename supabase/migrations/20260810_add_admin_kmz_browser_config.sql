-- 管理者専用KMZブラウザの認証設定テーブル
-- 実際の管理者コードのSHA-256値はリポジトリへ記載せず、
-- Supabase側で管理者が設定する。

create table if not exists public.admin_kmz_browser_config (
  config_key text primary key,
  value_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.admin_kmz_browser_config enable row level security;

-- Public/anon/authenticatedへは読み取り権限を付けない。
-- Edge Functionがservice role経由でのみ参照する。
grant select on table public.admin_kmz_browser_config to service_role;
