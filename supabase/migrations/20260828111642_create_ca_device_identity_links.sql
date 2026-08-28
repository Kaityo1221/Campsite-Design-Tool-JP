create table if not exists public.ca_device_identity_links (
  id uuid primary key default gen_random_uuid(),
  anonymous_device_id text not null,
  auth_user_id uuid not null,
  discord_user_id text not null,
  discord_name text,
  discord_global_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (anonymous_device_id, discord_user_id)
);

create index if not exists ca_device_identity_links_device_idx
  on public.ca_device_identity_links (anonymous_device_id);
create index if not exists ca_device_identity_links_auth_user_idx
  on public.ca_device_identity_links (auth_user_id);
create index if not exists ca_device_identity_links_discord_idx
  on public.ca_device_identity_links (discord_user_id);

alter table public.ca_device_identity_links enable row level security;
revoke all on table public.ca_device_identity_links from anon, authenticated;
grant select, insert, update, delete on table public.ca_device_identity_links to service_role;
