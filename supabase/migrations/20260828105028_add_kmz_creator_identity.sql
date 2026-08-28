alter table public.campsite_kmz_uploads
  add column if not exists created_by_auth_user_id uuid,
  add column if not exists created_by_discord_user_id text,
  add column if not exists created_by_discord_name text,
  add column if not exists created_by_discord_global_name text;

create index if not exists camps_kmz_uploads_created_by_auth_user_idx
  on public.campsite_kmz_uploads (created_by_auth_user_id)
  where created_by_auth_user_id is not null;

create index if not exists camps_kmz_uploads_created_by_discord_idx
  on public.campsite_kmz_uploads (created_by_discord_user_id)
  where created_by_discord_user_id is not null;
