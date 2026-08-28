create table if not exists public.ca_geo_block_log (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null,
  discord_user_id text not null,
  discord_name text,
  occurred_at timestamptz not null default now(),
  latitude numeric(9,6),
  longitude numeric(9,6),
  gps_accuracy_m numeric(10,2),
  ip_country text,
  gps_result text not null,
  block_reason text not null,
  test_bypass boolean not null default false,
  test_scenario text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ca_geo_block_log_user_reason_time_idx
  on public.ca_geo_block_log (discord_user_id, block_reason, occurred_at desc);

create index if not exists ca_geo_block_log_occurred_at_idx
  on public.ca_geo_block_log (occurred_at desc);

alter table public.ca_geo_block_log enable row level security;

revoke all on table public.ca_geo_block_log from anon, authenticated;
grant all on table public.ca_geo_block_log to service_role;

comment on table public.ca_geo_block_log is
  'CA overseas/location guard diagnostic blocks. Block events only; retained for 30 days.';
comment on column public.ca_geo_block_log.test_bypass is
  'True only when an authorized CA access admin continues past a simulated test block.';

select cron.schedule(
  'cleanup_ca_geo_block_log',
  '17 3 * * *',
  $$delete from public.ca_geo_block_log where occurred_at < now() - interval '30 days';$$
);
