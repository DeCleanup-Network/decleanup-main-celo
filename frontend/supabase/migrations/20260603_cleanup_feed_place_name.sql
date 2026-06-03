-- Human-readable place from reverse geocoding (e.g. "Tokyo, Japan") for landing API.

alter table public.cleanup_feed
  add column if not exists location_place_name text;

comment on column public.cleanup_feed.location_place_name is
  'Reverse-geocoded locality from latitude/longitude (filled during /api/impact/sync).';
