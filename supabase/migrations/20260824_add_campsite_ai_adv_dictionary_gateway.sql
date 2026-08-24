-- Campsite AI -> ADV dictionary release gateway
-- Keep dictionary_master / alias_master closed to direct generic writes.
-- Only the dedicated authenticated Campsite AI account in campsite_ai_access
-- can use these narrow SECURITY DEFINER RPCs.

begin;

create table if not exists public.campsite_ai_dictionary_releases (
  release_id text primary key,
  actor_uid uuid not null,
  item_count integer not null,
  alias_inserted_count integer not null default 0,
  alias_existing_count integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.campsite_ai_dictionary_releases enable row level security;
revoke all on table public.campsite_ai_dictionary_releases from public, anon, authenticated;

create or replace function public.campsite_ai_dictionary_catalog()
returns table (
  dictionary_id text,
  canonical_name text,
  normalized_name text,
  category_id text
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
    d.dictionary_id::text,
    d.canonical_name::text,
    d.normalized_name::text,
    d.category_id::text
  from public.dictionary_master d
  where d.active is distinct from false
  order by d.category_id::text, d.canonical_name::text, d.dictionary_id::text;
end;
$$;

revoke all on function public.campsite_ai_dictionary_catalog() from public, anon;
grant execute on function public.campsite_ai_dictionary_catalog() to authenticated;

create or replace function public.campsite_ai_apply_dictionary_release(p_release jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_release_id text;
  v_items jsonb;
  v_item jsonb;
  v_item_count integer;
  v_dictionary_id text;
  v_target_category text;
  v_source_name text;
  v_adopt_name text;
  v_normalized_source text;
  v_normalized_adopt text;
  v_note text;
  v_dictionary_canonical text;
  v_existing_dictionary text;
  v_inserted integer := 0;
  v_existing integer := 0;
  v_norm text;
  v_alias_name text;
  v_aliases jsonb;
  v_alias jsonb;
  v_seen_norms text[];
  v_existing_release record;
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

  v_release_id := nullif(btrim(p_release ->> 'release_id'), '');
  v_items := p_release -> 'items';

  if v_release_id is null then
    raise exception 'release_id is required';
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' then
    raise exception 'items must be an array';
  end if;

  v_item_count := jsonb_array_length(v_items);
  if v_item_count < 1 or v_item_count > 100 then
    raise exception 'release item count must be between 1 and 100';
  end if;

  select r.release_id, r.item_count, r.alias_inserted_count, r.alias_existing_count, r.created_at
    into v_existing_release
    from public.campsite_ai_dictionary_releases r
   where r.release_id = v_release_id;

  if found then
    return jsonb_build_object(
      'success', true,
      'idempotent', true,
      'release_id', v_existing_release.release_id,
      'item_count', v_existing_release.item_count,
      'alias_inserted_count', v_existing_release.alias_inserted_count,
      'alias_existing_count', v_existing_release.alias_existing_count,
      'created_at', v_existing_release.created_at
    );
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_dictionary_id := nullif(btrim(v_item ->> 'dictionary_id'), '');
    v_target_category := nullif(btrim(v_item ->> 'target_category'), '');
    v_source_name := nullif(btrim(v_item ->> 'source_name'), '');
    v_adopt_name := nullif(btrim(v_item ->> 'adopt_name'), '');
    v_normalized_source := nullif(btrim(v_item ->> 'normalized_source'), '');
    v_normalized_adopt := nullif(btrim(v_item ->> 'normalized_adopt'), '');
    v_note := left(coalesce(v_item ->> 'chairman_note', ''), 500);

    if v_dictionary_id is null or v_target_category is null or v_source_name is null
       or v_adopt_name is null or v_normalized_source is null or v_normalized_adopt is null then
      raise exception 'Release item is missing required fields';
    end if;

    select d.canonical_name::text
      into v_dictionary_canonical
      from public.dictionary_master d
     where d.dictionary_id::text = v_dictionary_id
       and d.category_id::text = v_target_category
       and d.active is distinct from false
     limit 1;

    if v_dictionary_canonical is null then
      raise exception 'Dictionary target not found or category mismatch: % / %', v_dictionary_id, v_target_category;
    end if;

    v_aliases := jsonb_build_array(
      jsonb_build_object('name', v_source_name, 'norm', v_normalized_source),
      jsonb_build_object('name', v_adopt_name, 'norm', v_normalized_adopt)
    );
    v_seen_norms := array[]::text[];

    for v_alias in select value from jsonb_array_elements(v_aliases)
    loop
      v_alias_name := nullif(btrim(v_alias ->> 'name'), '');
      v_norm := nullif(btrim(v_alias ->> 'norm'), '');
      if v_alias_name is null or v_norm is null then
        continue;
      end if;
      if v_norm = any(v_seen_norms) then
        continue;
      end if;
      v_seen_norms := array_append(v_seen_norms, v_norm);

      v_existing_dictionary := null;
      select a.dictionary_id::text
        into v_existing_dictionary
        from public.alias_master a
       where a.normalized_alias::text = v_norm
         and a.active is distinct from false
       order by a.dictionary_id::text
       limit 1;

      if v_existing_dictionary is not null then
        if v_existing_dictionary <> v_dictionary_id then
          raise exception 'Alias conflict: % already points to dictionary %', v_alias_name, v_existing_dictionary;
        end if;
        v_existing := v_existing + 1;
        continue;
      end if;

      insert into public.alias_master (
        alias_id,
        dictionary_id,
        canonical_name,
        alias_name,
        normalized_alias,
        match_type,
        source_type,
        review_status,
        active,
        note
      ) values (
        'AI_' || replace(v_release_id, '-', '_') || '_' || replace(gen_random_uuid()::text, '-', ''),
        v_dictionary_id,
        v_dictionary_canonical,
        v_alias_name,
        v_norm,
        'exact',
        'campsite_ai_release',
        'active',
        true,
        left('Campsite AI ' || v_release_id || case when v_note <> '' then ': ' || v_note else '' end, 500)
      );
      v_inserted := v_inserted + 1;
    end loop;
  end loop;

  insert into public.campsite_ai_dictionary_releases (
    release_id,
    actor_uid,
    item_count,
    alias_inserted_count,
    alias_existing_count,
    payload
  ) values (
    v_release_id,
    v_uid,
    v_item_count,
    v_inserted,
    v_existing,
    p_release
  );

  return jsonb_build_object(
    'success', true,
    'idempotent', false,
    'release_id', v_release_id,
    'item_count', v_item_count,
    'alias_inserted_count', v_inserted,
    'alias_existing_count', v_existing
  );
end;
$$;

revoke all on function public.campsite_ai_apply_dictionary_release(jsonb) from public, anon;
grant execute on function public.campsite_ai_apply_dictionary_release(jsonb) to authenticated;

commit;
