-- Keep Phase 2 helper functions pinned to the public schema.

create or replace function public.normalize_campsite_site_name(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select regexp_replace(lower(trim(coalesce(p_value, ''))), '[[:space:]　_＿\-－ー]+', '', 'g');
$$;

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
set search_path = public
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

revoke all on function public.normalize_campsite_site_name(text) from public, anon, authenticated;
grant execute on function public.normalize_campsite_site_name(text) to service_role;

revoke all on function public.campsite_distance_meters(double precision, double precision, double precision, double precision) from public, anon, authenticated;
grant execute on function public.campsite_distance_meters(double precision, double precision, double precision, double precision) to service_role;
