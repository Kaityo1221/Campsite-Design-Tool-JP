-- Issue #51: 管理者パスワードをフロントJSから外し、
-- サーバー側セッション認証へ移行するための内部テーブル。

create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  revoked_at timestamptz null
);

create index if not exists admin_sessions_expires_at_idx
  on public.admin_sessions (expires_at);

alter table public.admin_sessions enable row level security;
revoke all on table public.admin_sessions from anon, authenticated;
grant select, insert, update, delete on table public.admin_sessions to service_role;

create table if not exists public.admin_auth_rate_limits (
  key_hash text primary key,
  failed_count integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.admin_auth_rate_limits enable row level security;
revoke all on table public.admin_auth_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.admin_auth_rate_limits to service_role;
