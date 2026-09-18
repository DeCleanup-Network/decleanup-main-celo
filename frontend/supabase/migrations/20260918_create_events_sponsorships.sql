-- Cleanup event sponsorship (cUSD on Celo mainnet).
-- Access via Next.js API + service role (RLS on, no public policies).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  organiser text not null,
  event_date timestamptz not null,
  funding_goal_cusd numeric not null check (funding_goal_cusd > 0),
  recipient_address text not null,
  verified_cleanups_count integer not null default 0 check (verified_cleanups_count >= 0),
  status text not null check (status in ('active', 'upcoming', 'ended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists events_status_idx on public.events (status);
create index if not exists events_event_date_idx on public.events (event_date);

create table if not exists public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  sponsor_address text not null,
  amount_cusd numeric not null check (amount_cusd > 0),
  tx_hash text not null,
  created_at timestamptz not null default now(),
  constraint sponsorships_tx_hash_unique unique (tx_hash)
);

create index if not exists sponsorships_event_id_idx on public.sponsorships (event_id);
create index if not exists sponsorships_sponsor_idx on public.sponsorships (lower(sponsor_address));

create or replace function public.set_events_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row
execute function public.set_events_updated_at();

alter table public.events enable row level security;
alter table public.sponsorships enable row level security;
