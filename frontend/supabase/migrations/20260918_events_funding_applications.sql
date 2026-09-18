-- Funding applications: story fields + verifier review (pending until approved).
alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('pending', 'active', 'upcoming', 'ended'));

alter table public.events
  add column if not exists submitted_by text;

alter table public.events
  add column if not exists why_funding text;

alter table public.events
  add column if not exists community_size text;

alter table public.events
  add column if not exists event_frequency text;

alter table public.events
  add column if not exists impact_summary text;

alter table public.events
  add column if not exists social_links text;

alter table public.events
  add column if not exists impact_portfolio_url text;

alter table public.events
  add column if not exists reviewed_by text;

alter table public.events
  add column if not exists reviewed_at timestamptz;

-- Ongoing community campaigns may omit a single event date.
alter table public.events
  alter column event_date drop not null;

create index if not exists events_submitted_by_idx
  on public.events (lower(submitted_by));

create index if not exists events_status_pending_idx
  on public.events (status)
  where status = 'pending';
