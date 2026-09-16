-- Phase 2: stable campsite identity and history grouping.
-- Uses robust median centers so dummy/outlier POIs do not distort site matching.

create table if not exists public.campsite_sites (
  id uuid primary key default gen_random_uuid(),
  canonical_name text null,
  normalized_name text null,
  center_lat double precision null,
  center_lng double precision null,
  assignment_count integer not null default 0,
  first_seen_at timestamptz null,
  last_seen_at timestamptz null,
  latest_upload_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.campsite_sites enable row level security;
revoke all on table public.campsite_sites from anon, authenticated;
grant select, insert, update, delete on table public.campsite_sites to service_role;

alter table public.campsite_kmz_uploads
  add column if not exists site_id uuid null references public.campsite_sites(id) on delete set null,
  add column if not exists site_assignment_method text null,
  add column if not exists site_match_score numeric null,
  add column if not exists site_assigned_at timestamptz null;

create index if not exists campsite_kmz_uploads_site_id_idx
  on public.campsite_kmz_uploads(site_id, created_at desc)
  where site_id is not null;

create index if not exists campsite_poi_observations_lat_lng_idx
  on public.campsite_poi_observations(lat, lng);

create index if not exists campsite_sites_last_seen_idx
  on public.campsite_sites(last_seen_at desc);

create or replace function public.normalize_campsite_site_name(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '[[:space:]　_＿\-－ー]+', '', 'g');
$$;

revoke all on function public.normalize_campsite_site_name(text) from public, anon, authenticated;
grant execute on function public.normalize_campsite_site_name(text) to service_role;

create or replace function public.campsite_distance_meters(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
returns double precision
language sql
immutable
strict
as $$
  select 6371000.0 * 2.0 * asin(
    least(
      1.0,
      sqrt(
        power(sin(radians((p_lat2 - p_lat1) / 2.0)), 2) +
        cos(radians(p_lat1)) * cos(radians(p_lat2)) *
        power(sin(radians((p_lng2 - p_lng1) / 2.0)), 2)
      )
    )
  );
$$;

revoke all on function public.campsite_distance_meters(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.campsite_distance_meters(double precision, double precision, double precision, double precision) to service_role;

create or replace function public.assign_campsite_upload_site(p_upload_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_upload record;
  v_count integer;
  v_center_lat double precision;
  v_center_lng double precision;
  v_site_id uuid;
  v_method text;
  v_score numeric;
  v_candidate record;
  v_norm_park text;
begin
  select id, site_id, duplicate_of, park_name, created_at, deleted_at
    into v_upload
  from public.campsite_kmz_uploads
  where id = p_upload_id
  for update;

  if not found or v_upload.deleted_at is not null then return null; end if;
  if v_upload.site_id is not null then return v_upload.site_id; end if;

  if v_upload.duplicate_of is not null then
    select site_id into v_site_id
    from public.campsite_kmz_uploads
    where id = v_upload.duplicate_of;
    if v_site_id is not null then
      v_method := 'duplicate';
      v_score := 1000000;
    end if;
  end if;

  select
    count(*),
    percentile_cont(0.5) within group (order by lat),
    percentile_cont(0.5) within group (order by lng)
  into v_count, v_center_lat, v_center_lng
  from public.campsite_poi_observations
  where upload_id = p_upload_id
    and lat <> 0 and lng <> 0
    and lat between -90 and 90
    and lng between -180 and 180;

  if coalesce(v_count, 0) < 3 and v_site_id is null then return null; end if;
  v_norm_park := public.normalize_campsite_site_name(v_upload.park_name);

  if v_site_id is null then
    with current_ids as (
      select distinct master_poi_id
      from public.campsite_poi_observations
      where upload_id = p_upload_id
        and lat <> 0 and lng <> 0
    ),
    candidates as (
      select u.id, u.site_id, u.park_name, u.created_at
      from public.campsite_kmz_uploads u
      where u.id <> p_upload_id
        and u.site_id is not null
        and u.deleted_at is null
        and u.created_at < v_upload.created_at
        and (
          (v_norm_park <> '' and public.normalize_campsite_site_name(u.park_name) = v_norm_park)
          or exists (
            select 1
            from public.campsite_poi_observations so
            where so.upload_id = u.id
              and so.master_poi_id in (select master_poi_id from current_ids)
          )
        )
    ),
    candidate_stats as (
      select
        c.id as upload_id,
        c.site_id,
        c.park_name,
        c.created_at,
        count(distinct o.master_poi_id) filter (
          where o.master_poi_id in (select master_poi_id from current_ids)
        ) as shared_count,
        percentile_cont(0.5) within group (order by o.lat) as center_lat,
        percentile_cont(0.5) within group (order by o.lng) as center_lng
      from candidates c
      join public.campsite_poi_observations o on o.upload_id = c.id
      where o.lat <> 0 and o.lng <> 0
        and o.lat between -90 and 90
        and o.lng between -180 and 180
      group by c.id, c.site_id, c.park_name, c.created_at
    ),
    scored as (
      select
        cs.*,
        public.campsite_distance_meters(v_center_lat, v_center_lng, cs.center_lat, cs.center_lng) as center_distance,
        (public.normalize_campsite_site_name(cs.park_name) = v_norm_park and v_norm_park <> '') as park_match
      from candidate_stats cs
    )
    select
      s.site_id,
      (s.shared_count * 1000 + case when s.park_match then 250 else 0 end + greatest(0, 500 - round(s.center_distance)))::numeric as score,
      s.shared_count,
      s.center_distance,
      s.park_match,
      s.created_at
    into v_candidate
    from scored s
    where
      (s.shared_count >= 3 and s.center_distance <= 1200)
      or (s.shared_count >= 1 and s.center_distance <= 350 and s.park_match)
      or (s.shared_count = 0 and s.center_distance <= 180 and s.park_match)
    order by
      (s.shared_count * 1000 + case when s.park_match then 250 else 0 end + greatest(0, 500 - round(s.center_distance))) desc,
      s.created_at desc
    limit 1;

    if found and v_candidate.site_id is not null then
      v_site_id := v_candidate.site_id;
      v_method := 'poi_footprint';
      v_score := v_candidate.score;
    end if;
  end if;

  if v_site_id is null then
    insert into public.campsite_sites (
      canonical_name, normalized_name, center_lat, center_lng,
      assignment_count, first_seen_at, last_seen_at, latest_upload_id
    ) values (
      nullif(trim(coalesce(v_upload.park_name, '')), ''), nullif(v_norm_park, ''),
      v_center_lat, v_center_lng, 0, v_upload.created_at, v_upload.created_at, p_upload_id
    ) returning id into v_site_id;
    v_method := 'new_site';
    v_score := 0;
  end if;

  update public.campsite_kmz_uploads
  set site_id = v_site_id,
      site_assignment_method = v_method,
      site_match_score = v_score,
      site_assigned_at = now()
  where id = p_upload_id;

  update public.campsite_sites
  set
    canonical_name = coalesce(canonical_name, nullif(trim(coalesce(v_upload.park_name, '')), '')),
    normalized_name = coalesce(normalized_name, nullif(v_norm_park, '')),
    center_lat = case
      when v_center_lat is null then center_lat
      when assignment_count <= 0 or center_lat is null then v_center_lat
      else ((center_lat * assignment_count) + v_center_lat) / (assignment_count + 1)
    end,
    center_lng = case
      when v_center_lng is null then center_lng
      when assignment_count <= 0 or center_lng is null then v_center_lng
      else ((center_lng * assignment_count) + v_center_lng) / (assignment_count + 1)
    end,
    assignment_count = assignment_count + 1,
    first_seen_at = case when first_seen_at is null then v_upload.created_at else least(first_seen_at, v_upload.created_at) end,
    last_seen_at = case when last_seen_at is null then v_upload.created_at else greatest(last_seen_at, v_upload.created_at) end,
    latest_upload_id = case when last_seen_at is null or v_upload.created_at >= last_seen_at then p_upload_id else latest_upload_id end,
    updated_at = now()
  where id = v_site_id;

  return v_site_id;
end;
$$;

revoke all on function public.assign_campsite_upload_site(uuid) from public, anon, authenticated;
grant execute on function public.assign_campsite_upload_site(uuid) to service_role;

create or replace function public.backfill_campsite_site_ids(p_limit integer default 50)
returns table(processed integer, assigned integer, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_processed integer := 0;
  v_assigned integer := 0;
  v_site uuid;
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 250));
begin
  for v_row in
    select u.id
    from public.campsite_kmz_uploads u
    where u.deleted_at is null
      and u.site_id is null
      and exists (select 1 from public.campsite_poi_observations o where o.upload_id = u.id)
    order by u.created_at asc, u.id asc
    limit v_limit
  loop
    v_processed := v_processed + 1;
    v_site := public.assign_campsite_upload_site(v_row.id);
    if v_site is not null then v_assigned := v_assigned + 1; end if;
  end loop;

  return query
  select v_processed, v_assigned,
    (select count(*)::integer
     from public.campsite_kmz_uploads u
     where u.deleted_at is null
       and u.site_id is null
       and exists (select 1 from public.campsite_poi_observations o where o.upload_id = u.id));
end;
$$;

revoke all on function public.backfill_campsite_site_ids(integer) from public, anon, authenticated;
grant execute on function public.backfill_campsite_site_ids(integer) to service_role;
