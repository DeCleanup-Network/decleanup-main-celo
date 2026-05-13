-- Durable key/value store for $cDCU claim accounting.
-- Replaces the local JSON file store, which is ephemeral on serverless hosts (Vercel).
--
-- Three kinds of keys live in this table:
--   * <lowercase recipient address>                -> total $cDCU wei already issued
--   * <lowercase recipient address>:milestones     -> number of 50-DCU tranches already claimed
--   * pending_<lowercase recipient address>        -> wei signed but not yet confirmed onchain
--
-- All access is via Next.js API routes using the service role key (RLS bypass).

create table if not exists public.cdcu_issued_store (
  key text primary key,
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_cdcu_issued_store_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_cdcu_issued_store_updated_at on public.cdcu_issued_store;
create trigger trg_cdcu_issued_store_updated_at
before update on public.cdcu_issued_store
for each row
execute function public.set_cdcu_issued_store_updated_at();

alter table public.cdcu_issued_store enable row level security;
-- No public policies. Server-only via service role.
