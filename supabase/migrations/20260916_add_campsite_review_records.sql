begin;

create table if not exists public.campsite_review_records (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.campsite_sites(id) on delete restrict,
  upload_id uuid not null references public.campsite_kmz_uploads(id) on delete restrict,
  review_revision integer not null check (review_revision >= 1),
  admin_session_id uuid null references public.admin_sessions(id) on delete set null,
  status text not null check (status in ('ok','needs_check','needs_revision','hold')),
  reasons text[] not null default '{}',
  memo text null check (memo is null or char_length(memo) <= 1000),
  scope_id uuid null references public.campsite_review_scopes(id) on delete set null,
  scope_revision integer null check (scope_revision is null or scope_revision >= 1),
  policy_version_id uuid null references public.campsite_policy_versions(id) on delete set null,
  policy_version_no bigint null check (policy_version_no is null or policy_version_no >= 0),
  policy_snapshot jsonb not null default '{}'::jsonb,
  auto_check_snapshot jsonb not null default '{}'::jsonb,
  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(upload_id, review_revision)
);

create index if not exists campsite_review_records_site_idx
  on public.campsite_review_records(site_id, reviewed_at desc);

create index if not exists campsite_review_records_upload_idx
  on public.campsite_review_records(upload_id, review_revision desc);

alter table public.campsite_review_records enable row level security;
revoke all on table public.campsite_review_records from anon, authenticated;
grant select, insert on table public.campsite_review_records to service_role;

create or replace function public.save_campsite_review_record(
  p_site_id uuid,
  p_upload_id uuid,
  p_admin_session_id uuid,
  p_status text,
  p_reasons text[],
  p_memo text,
  p_scope_id uuid,
  p_scope_revision integer,
  p_policy_version_id uuid,
  p_policy_version_no bigint,
  p_policy_snapshot jsonb,
  p_auto_check_snapshot jsonb
)
returns public.campsite_review_records
language plpgsql
security definer
set search_path = public
as $$
declare
  v_revision integer;
  v_row public.campsite_review_records;
  v_upload_site uuid;
  v_scope_site uuid;
begin
  if p_status not in ('ok','needs_check','needs_revision','hold') then
    raise exception 'invalid review status';
  end if;

  if p_memo is not null and char_length(p_memo) > 1000 then
    raise exception 'memo too long';
  end if;

  select site_id into v_upload_site
  from public.campsite_kmz_uploads
  where id = p_upload_id
    and deleted_at is null;

  if v_upload_site is null or v_upload_site <> p_site_id then
    raise exception 'upload does not belong to site';
  end if;

  if p_scope_id is not null then
    select site_id into v_scope_site
    from public.campsite_review_scopes
    where id = p_scope_id;

    if v_scope_site is null or v_scope_site <> p_site_id then
      raise exception 'scope does not belong to site';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_upload_id::text));

  select coalesce(max(review_revision), 0) + 1
    into v_revision
  from public.campsite_review_records
  where upload_id = p_upload_id;

  insert into public.campsite_review_records (
    site_id,
    upload_id,
    review_revision,
    admin_session_id,
    status,
    reasons,
    memo,
    scope_id,
    scope_revision,
    policy_version_id,
    policy_version_no,
    policy_snapshot,
    auto_check_snapshot
  ) values (
    p_site_id,
    p_upload_id,
    v_revision,
    p_admin_session_id,
    p_status,
    coalesce(p_reasons, '{}'::text[]),
    nullif(trim(coalesce(p_memo, '')), ''),
    p_scope_id,
    p_scope_revision,
    p_policy_version_id,
    p_policy_version_no,
    coalesce(p_policy_snapshot, '{}'::jsonb),
    coalesce(p_auto_check_snapshot, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.save_campsite_review_record(uuid, uuid, uuid, text, text[], text, uuid, integer, uuid, bigint, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_campsite_review_record(uuid, uuid, uuid, text, text[], text, uuid, integer, uuid, bigint, jsonb, jsonb) to service_role;

commit;
