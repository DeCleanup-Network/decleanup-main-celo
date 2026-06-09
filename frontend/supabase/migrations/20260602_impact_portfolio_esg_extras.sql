alter table public.impact_portfolios
  add column if not exists legal_name text not null default '',
  add column if not exists impact_context text not null default '',
  add column if not exists additionality_statement text not null default '';

create table if not exists public.impact_portfolio_endorsements (
  id uuid primary key default gen_random_uuid(),
  portfolio_address text not null,
  endorser_address text not null,
  endorser_name text not null default '',
  endorser_org text not null default '',
  statement text not null default '',
  signature text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_impact_portfolio_endorsements_address
  on public.impact_portfolio_endorsements (portfolio_address);

alter table public.impact_portfolio_endorsements enable row level security;

drop policy if exists "impact_portfolio_endorsements_read_all" on public.impact_portfolio_endorsements;
create policy "impact_portfolio_endorsements_read_all"
on public.impact_portfolio_endorsements
for select
to anon, authenticated
using (true);
