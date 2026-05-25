-- Durable key/value store for $cDCU airdrop claim accounting.
-- Replaces frontend/data/airdrop-issued.json (ephemeral on Vercel serverless).
--
-- Keys:
--   claimed_<lowercase recipient>  -> "1" when fully claimed
--   pending_<lowercase recipient>  -> wei string signed but not yet confirmed onchain
--
-- Server-only via service role (RLS enabled, no public policies).

create table if not exists public.airdrop_issued_store (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_airdrop_issued_store_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_airdrop_issued_store_updated_at on public.airdrop_issued_store;
create trigger trg_airdrop_issued_store_updated_at
before update on public.airdrop_issued_store
for each row
execute function public.set_airdrop_issued_store_updated_at();

alter table public.airdrop_issued_store enable row level security;
