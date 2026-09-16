begin;

create table if not exists public.campsite_review_scopes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.campsite_sites(id) on delete cascade,
  revision integer not null check (revision >= 1),
  polygon_geojson jsonb not null,
  vertex_count integer not null check (vertex_count between 3 and 200),
  source_upload_id uuid null references public.campsite_kmz_uploads(id) on delete set null,
  is_active boolean not null default true,
  created_by_session_id uuid null,
  note text null,
  created_at timestamptz not null default now(),
  constraint campsite_review_scopes_polygon_type_chk
    check (polygon_geojson->>'type' = 'Polygon')
);

create unique index if not exists campsite_review_scopes_site_revision_uidx
  on public.campsite_review_scopes(site_id, revision);

create unique index if not exists campsite_review_scopes_one_active_uidx
  on public.campsite_review_scopes(site_id)
  where is_active = true;

create index if not exists campsite_review_scopes_site_created_idx
  on public.campsite_review_scopes(site_id, created_at desc);

alter table public.campsite_review_scopes enable row level security;
revoke all on table public.campsite_review_scopes from anon, authenticated;
grant select, insert, update, delete on table public.campsite_review_scopes to service_role;

create or replace function public.save_campsite_review_scope(
  p_site_id uuid,
  p_polygon_geojson jsonb,
  p_vertex_count integer,
  p_source_upload_id uuid default null,
  p_admin_session_id uuid default null,
  p_note text default null
)
returns public.campsite_review_scopes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision integer;
  v_row public.campsite_review_scopes;
begin
  if p_site_id is null then raise exception 'site_id is required'; end if;
  if not exists (select 1 from public.campsite_sites where id = p_site_id) then
    raise exception 'site not found';
  end if;
  if p_polygon_geojson is null or p_polygon_geojson->>'type' <> 'Polygon' then
    raise exception 'polygon_geojson must be a Polygon';
  end if;
  if p_vertex_count is null or p_vertex_count < 3 or p_vertex_count > 200 then
    raise exception 'vertex_count must be between 3 and 200';
  end if;
  if p_source_upload_id is not null and not exists (
    select 1 from public.campsite_kmz_uploads
    where id = p_source_upload_id and site_id = p_site_id
  ) then
    raise exception 'source upload does not belong to site';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_site_id::text));

  select coalesce(max(revision), 0) + 1 into v_revision
  from public.campsite_review_scopes where site_id = p_site_id;

  update public.campsite_review_scopes
  set is_active = false
  where site_id = p_site_id and is_active = true;

  insert into public.campsite_review_scopes (
    site_id, revision, polygon_geojson, vertex_count,
    source_upload_id, is_active, created_by_session_id, note
  ) values (
    p_site_id, v_revision, p_polygon_geojson, p_vertex_count,
    p_source_upload_id, true, p_admin_session_id,
    nullif(trim(coalesce(p_note, '')), '')
  ) returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_campsite_review_scope(uuid, jsonb, integer, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.save_campsite_review_scope(uuid, jsonb, integer, uuid, uuid, text) to service_role;

create or replace function public.clear_campsite_review_scope(
  p_site_id uuid,
  p_admin_session_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_site_id is null then raise exception 'site_id is required'; end if;
  perform pg_advisory_xact_lock(hashtext(p_site_id::text));
  update public.campsite_review_scopes
  set is_active = false
  where site_id = p_site_id and is_active = true;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.clear_campsite_review_scope(uuid, uuid) from public, anon, authenticated;
grant execute on function public.clear_campsite_review_scope(uuid, uuid) to service_role;

commit;
