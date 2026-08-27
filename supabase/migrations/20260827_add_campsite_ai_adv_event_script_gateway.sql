-- Campsite AI -> ADV event script release gateway
-- Public ADV clients may only read the currently published script override.
-- Writes, history and rollback remain restricted to authenticated Campsite AI
-- users present in public.campsite_ai_access with active=true.

begin;

create table if not exists public.campsite_ai_adv_event_script_releases (
  release_id text primary key,
  event_id text not null,
  event_no integer not null,
  event_name text not null,
  scenes jsonb not null,
  actor_uid uuid not null,
  status text not null default 'active'
    check (status in ('active', 'superseded', 'rolled_back')),
  supersedes_release_id text null
    references public.campsite_ai_adv_event_script_releases(release_id)
    on delete set null,
  created_at timestamptz not null default now(),
  rolled_back_at timestamptz null
);

alter table public.campsite_ai_adv_event_script_releases enable row level security;
revoke all on table public.campsite_ai_adv_event_script_releases from public, anon, authenticated;

create unique index if not exists camps_ai_adv_event_script_one_active_per_event
  on public.campsite_ai_adv_event_script_releases(event_id)
  where status = 'active';

create index if not exists camps_ai_adv_event_script_event_created_idx
  on public.campsite_ai_adv_event_script_releases(event_id, created_at desc);

create or replace function public.campsite_adv_published_event_scripts()
returns table (
  release_id text,
  event_id text,
  event_no integer,
  event_name text,
  scenes jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = ''
as $$
  select
    r.release_id,
    r.event_id,
    r.event_no,
    r.event_name,
    r.scenes,
    r.created_at
  from public.campsite_ai_adv_event_script_releases r
  where r.status = 'active'
  order by r.event_no, r.event_id;
$$;

revoke all on function public.campsite_adv_published_event_scripts() from public;
grant execute on function public.campsite_adv_published_event_scripts() to anon, authenticated;

create or replace function public.campsite_ai_apply_adv_event_script_release(p_release jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_release_id text;
  v_event_id text;
  v_event_no integer;
  v_event_name text;
  v_scenes jsonb;
  v_scene jsonb;
  v_scene_count integer;
  v_order integer;
  v_speaker text;
  v_dialogue text;
  v_existing record;
  v_previous_release_id text;
  v_allowed_event_ids text[] := array[
    'DENSITY_01',
    'DENSITY_REST_01',
    'ENTRANCE_01',
    'LOOP_01',
    'NARROW_PATH_01',
    'PARKING_01',
    'PLAYGROUND_01',
    'PARK_PLAZA_01',
    'REST_01',
    'REST_SHORTAGE_01',
    'TRANSIT_01',
    'LANDMARK_CLUSTER_01',
    'ART_CLUSTER_01',
    'HISTORY_CLUSTER_01',
    'RELIGIOUS_01',
    'COMMERCIAL_CLUSTER_01',
    'FOOD_SUPPLY_01',
    'LARGE_COMMERCIAL_01',
    'WATER_01',
    'TOURIST_CLUSTER_01',
    'SAME_TYPE_BURST_01',
    'ATTRIBUTE_SKEW_01',
    'LANDMARK_SHORTAGE_01',
    'FAVORABLE_COMPOSITE_01'
  ];
begin
  if v_uid is null then
    raise exception 'Campsite AI authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.campsite_ai_access a
    where a.user_id = v_uid
      and a.active = true
  ) then
    raise exception 'Campsite AI access denied' using errcode = '42501';
  end if;

  if jsonb_typeof(p_release) <> 'object' then
    raise exception 'Invalid release payload';
  end if;

  if coalesce(p_release ->> 'target_system', '') <> 'ADV'
     or coalesce(p_release ->> 'release_type', '') <> 'event_script' then
    raise exception 'Invalid target system or release type';
  end if;

  if pg_column_size(p_release) > 200000 then
    raise exception 'Release payload is too large';
  end if;

  v_release_id := nullif(btrim(p_release ->> 'release_id'), '');
  v_event_id := nullif(btrim(p_release ->> 'event_id'), '');
  v_event_name := nullif(btrim(p_release ->> 'event_name'), '');
  v_scenes := p_release -> 'scenes';

  begin
    v_event_no := (p_release ->> 'event_no')::integer;
  exception when others then
    raise exception 'event_no must be an integer';
  end;

  if v_release_id is null then
    raise exception 'release_id is required';
  end if;
  if v_event_id is null or not (v_event_id = any(v_allowed_event_ids)) then
    raise exception 'Unknown ADV event_id: %', coalesce(v_event_id, '');
  end if;
  if v_event_no < 1 or v_event_no > 24 then
    raise exception 'event_no must be between 1 and 24';
  end if;
  if v_event_name is null or length(v_event_name) > 120 then
    raise exception 'event_name is required and must be 120 characters or fewer';
  end if;
  if v_scenes is null or jsonb_typeof(v_scenes) <> 'array' then
    raise exception 'scenes must be an array';
  end if;

  v_scene_count := jsonb_array_length(v_scenes);
  if v_scene_count < 1 or v_scene_count > 20 then
    raise exception 'scene count must be between 1 and 20';
  end if;

  select r.release_id, r.event_id, r.status, r.created_at
    into v_existing
    from public.campsite_ai_adv_event_script_releases r
    where r.release_id = v_release_id;

  if found then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'release_id', v_existing.release_id,
      'event_id', v_existing.event_id,
      'status', v_existing.status,
      'created_at', v_existing.created_at
    );
  end if;

  for v_scene in select value from jsonb_array_elements(v_scenes)
  loop
    begin
      v_order := (v_scene ->> 'order')::integer;
    exception when others then
      raise exception 'scene order must be an integer';
    end;
    v_speaker := nullif(btrim(v_scene ->> 'speaker'), '');
    v_dialogue := nullif(btrim(v_scene ->> 'dialogue'), '');

    if v_order < 1 or v_order > 99 then
      raise exception 'scene order must be between 1 and 99';
    end if;
    if v_speaker is null or length(v_speaker) > 40 then
      raise exception 'scene speaker is required and must be 40 characters or fewer';
    end if;
    if v_dialogue is null or length(v_dialogue) > 1000 then
      raise exception 'scene dialogue is required and must be 1000 characters or fewer';
    end if;
  end loop;

  select r.release_id
    into v_previous_release_id
    from public.campsite_ai_adv_event_script_releases r
    where r.event_id = v_event_id
      and r.status = 'active'
    limit 1;

  if v_previous_release_id is not null then
    update public.campsite_ai_adv_event_script_releases
    set status = 'superseded'
    where release_id = v_previous_release_id;
  end if;

  insert into public.campsite_ai_adv_event_script_releases (
    release_id,
    event_id,
    event_no,
    event_name,
    scenes,
    actor_uid,
    status,
    supersedes_release_id
  ) values (
    v_release_id,
    v_event_id,
    v_event_no,
    v_event_name,
    v_scenes,
    v_uid,
    'active',
    v_previous_release_id
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'release_id', v_release_id,
    'event_id', v_event_id,
    'scene_count', v_scene_count,
    'supersedes_release_id', v_previous_release_id
  );
end;
$$;

revoke all on function public.campsite_ai_apply_adv_event_script_release(jsonb) from public, anon;
grant execute on function public.campsite_ai_apply_adv_event_script_release(jsonb) to authenticated;

create or replace function public.campsite_ai_rollback_adv_event_script_release(p_release_id text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_release record;
  v_restored_release_id text;
begin
  if v_uid is null then
    raise exception 'Campsite AI authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.campsite_ai_access a
    where a.user_id = v_uid
      and a.active = true
  ) then
    raise exception 'Campsite AI access denied' using errcode = '42501';
  end if;

  select
    r.release_id,
    r.event_id,
    r.status,
    r.supersedes_release_id
  into v_release
  from public.campsite_ai_adv_event_script_releases r
  where r.release_id = nullif(btrim(p_release_id), '');

  if not found then
    raise exception 'Release not found: %', coalesce(p_release_id, '');
  end if;
  if v_release.status <> 'active' then
    raise exception 'Only the active release can be rolled back';
  end if;

  update public.campsite_ai_adv_event_script_releases
  set status = 'rolled_back',
      rolled_back_at = now()
  where release_id = v_release.release_id;

  v_restored_release_id := null;
  if v_release.supersedes_release_id is not null then
    update public.campsite_ai_adv_event_script_releases
    set status = 'active'
    where release_id = v_release.supersedes_release_id
      and status = 'superseded';

    if found then
      v_restored_release_id := v_release.supersedes_release_id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'rolled_back_release_id', v_release.release_id,
    'event_id', v_release.event_id,
    'restored_release_id', v_restored_release_id,
    'fallback_to_bundled_v03', v_restored_release_id is null
  );
end;
$$;

revoke all on function public.campsite_ai_rollback_adv_event_script_release(text) from public, anon;
grant execute on function public.campsite_ai_rollback_adv_event_script_release(text) to authenticated;

create or replace function public.campsite_ai_adv_event_script_history(p_limit integer default 100)
returns table (
  release_id text,
  event_id text,
  event_no integer,
  event_name text,
  status text,
  supersedes_release_id text,
  actor_uid uuid,
  created_at timestamptz,
  rolled_back_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Campsite AI authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.campsite_ai_access a
    where a.user_id = auth.uid()
      and a.active = true
  ) then
    raise exception 'Campsite AI access denied' using errcode = '42501';
  end if;

  return query
  select
    r.release_id,
    r.event_id,
    r.event_no,
    r.event_name,
    r.status,
    r.supersedes_release_id,
    r.actor_uid,
    r.created_at,
    r.rolled_back_at
  from public.campsite_ai_adv_event_script_releases r
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.campsite_ai_adv_event_script_history(integer) from public, anon;
grant execute on function public.campsite_ai_adv_event_script_history(integer) to authenticated;

commit;
