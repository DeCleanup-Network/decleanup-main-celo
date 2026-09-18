-- Allow community proposals (pending) before ops publishes to upcoming/active.
alter table public.events drop constraint if exists events_status_check;
alter table public.events
  add constraint events_status_check
  check (status in ('pending', 'active', 'upcoming', 'ended'));

alter table public.events
  add column if not exists submitted_by text;

create index if not exists events_submitted_by_idx
  on public.events (lower(submitted_by));
