-- Public cleanup feed for landing page (verified cleanups + impact metrics).
-- Synced from Submission contract + IPFS by /api/impact/sync (service role).

create table if not exists public.cleanup_feed (
  submission_id text not null,
  chain_id integer not null,
  submitter text not null,
  submitted_at timestamptz,
  verified_at timestamptz,
  latitude double precision,
  longitude double precision,
  location_type text not null default '',
  location_label text not null default '',
  area_sqm double precision not null default 0,
  weight_kg double precision not null default 0,
  bags integer not null default 0,
  duration_minutes integer not null default 0,
  waste_types jsonb not null default '[]'::jsonb,
  contributors_count integer not null default 0,
  has_impact_report boolean not null default false,
  has_recyclables boolean not null default false,
  recyclables_amount_kg double precision,
  recyclables_amount_display text,
  recyclables_photo_cid text not null default '',
  recyclables_receipt_cid text not null default '',
  before_photo_cid text not null default '',
  after_photo_cid text not null default '',
  impact_ipfs_cid text not null default '',
  summary text not null default '',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (chain_id, submission_id)
);

create index if not exists cleanup_feed_verified_at_idx
  on public.cleanup_feed (verified_at desc nulls last);

create index if not exists cleanup_feed_chain_verified_idx
  on public.cleanup_feed (chain_id, verified_at desc nulls last);

alter table public.cleanup_feed enable row level security;

drop policy if exists "cleanup_feed_read_all" on public.cleanup_feed;
create policy "cleanup_feed_read_all"
on public.cleanup_feed
for select
to anon, authenticated
using (true);
