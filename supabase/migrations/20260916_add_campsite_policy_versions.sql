begin;

create table if not exists public.campsite_policy_versions (
  id uuid primary key default gen_random_uuid(),
  version_no bigint generated always as identity unique,
  spacing_meters integer not null check (spacing_meters between 1 and 1000),
  total_poi_limit integer null check (total_poi_limit is null or total_poi_limit >= 0),
  pokestop_limit integer null check (pokestop_limit is null or pokestop_limit >= 0),
  gym_limit integer null check (gym_limit is null or gym_limit >= 0),
  power_spot_limit integer null check (power_spot_limit is null or power_spot_limit >= 0),
  is_active boolean not null default false,
  note text null,
  created_by text null,
  created_at timestamptz not null default now()
);

create unique index if not exists campsite_policy_versions_one_active_idx
  on public.campsite_policy_versions ((1))
  where is_active = true;

create index if not exists campsite_policy_versions_created_at_idx
  on public.campsite_policy_versions (created_at desc);

alter table public.campsite_policy_versions enable row level security;
revoke all on table public.campsite_policy_versions from anon, authenticated;
grant select, insert, update, delete on table public.campsite_policy_versions to service_role;

insert into public.campsite_policy_versions (
  spacing_meters,
  total_poi_limit,
  pokestop_limit,
  gym_limit,
  power_spot_limit,
  is_active,
  note,
  created_by
)
select
  50,
  25,
  12,
  8,
  5,
  true,
  'Phase 1 initial policy migrated from current Campsite Design Tool constants.',
  'system_migration'
where not exists (
  select 1
  from public.campsite_policy_versions
  where is_active = true
);

create or replace function public.get_current_campsite_policy()
returns table (
  id uuid,
  version_no bigint,
  spacing_meters integer,
  total_poi_limit integer,
  pokestop_limit integer,
  gym_limit integer,
  power_spot_limit integer,
  note text,
  created_by text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.version_no,
    p.spacing_meters,
    p.total_poi_limit,
    p.pokestop_limit,
    p.gym_limit,
    p.power_spot_limit,
    p.note,
    p.created_by,
    p.created_at
  from public.campsite_policy_versions p
  where p.is_active = true
  order by p.version_no desc
  limit 1;
$$;

revoke all on function public.get_current_campsite_policy() from public;
grant execute on function public.get_current_campsite_policy() to service_role;

create or replace function public.set_current_campsite_policy(
  p_spacing_meters integer,
  p_total_poi_limit integer default null,
  p_pokestop_limit integer default null,
  p_gym_limit integer default null,
  p_power_spot_limit integer default null,
  p_note text default null,
  p_created_by text default 'admin'
)
returns public.campsite_policy_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.campsite_policy_versions;
begin
  if p_spacing_meters is null or p_spacing_meters < 1 or p_spacing_meters > 1000 then
    raise exception 'spacing_meters must be between 1 and 1000';
  end if;

  if p_total_poi_limit is not null and p_total_poi_limit < 0 then
    raise exception 'total_poi_limit must be null or >= 0';
  end if;
  if p_pokestop_limit is not null and p_pokestop_limit < 0 then
    raise exception 'pokestop_limit must be null or >= 0';
  end if;
  if p_gym_limit is not null and p_gym_limit < 0 then
    raise exception 'gym_limit must be null or >= 0';
  end if;
  if p_power_spot_limit is not null and p_power_spot_limit < 0 then
    raise exception 'power_spot_limit must be null or >= 0';
  end if;

  perform pg_advisory_xact_lock(hashtext('campsite_policy_versions'));

  update public.campsite_policy_versions
  set is_active = false
  where is_active = true;

  insert into public.campsite_policy_versions (
    spacing_meters,
    total_poi_limit,
    pokestop_limit,
    gym_limit,
    power_spot_limit,
    is_active,
    note,
    created_by
  )
  values (
    p_spacing_meters,
    p_total_poi_limit,
    p_pokestop_limit,
    p_gym_limit,
    p_power_spot_limit,
    true,
    nullif(trim(coalesce(p_note, '')), ''),
    nullif(trim(coalesce(p_created_by, '')), '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_current_campsite_policy(integer, integer, integer, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.set_current_campsite_policy(integer, integer, integer, integer, integer, text, text) to service_role;

commit;
