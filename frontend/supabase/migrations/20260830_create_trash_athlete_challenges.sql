-- Trash Athlete Challenge (global cleanup games): simplified social-proof submissions.
create table if not exists public.trash_athlete_challenges (
  id text primary key,
  user_id text,
  wallet_address text not null,
  email text,
  username text not null,
  social_profile_url text not null,
  notes text,
  status text not null check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  submitted_at bigint not null,
  reviewed_at bigint,
  reviewed_by text,
  rejection_reason text,
  -- Rewards unlocked on approve: level 3 + 30 DCU (ops/onchain) + 150 $cDCU (ClaimVault)
  bonus_cdcu_amount numeric not null default 150,
  bonus_cdcu_claimed boolean not null default false,
  bonus_cdcu_claim_tx text,
  level_target int not null default 3,
  dcu_points_amount numeric not null default 30,
  level_grant_status text not null default 'pending'
    check (level_grant_status in ('pending', 'granted', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists trash_athlete_challenges_wallet_idx
  on public.trash_athlete_challenges (lower(wallet_address));
create index if not exists trash_athlete_challenges_status_idx
  on public.trash_athlete_challenges (status);
create index if not exists trash_athlete_challenges_user_idx
  on public.trash_athlete_challenges (user_id);

create or replace function public.set_trash_athlete_challenges_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_trash_athlete_challenges_updated_at on public.trash_athlete_challenges;
create trigger trg_trash_athlete_challenges_updated_at
before update on public.trash_athlete_challenges
for each row
execute function public.set_trash_athlete_challenges_updated_at();

alter table public.trash_athlete_challenges enable row level security;
-- Access via Next.js API with service role only (no public policies).
