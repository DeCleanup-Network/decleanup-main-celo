create table if not exists public.impact_portfolios (
  address text primary key,
  display_name text not null default '',
  bio text not null default '',
  location_label text not null default '',
  location_coords text not null default '',
  show_precise_location boolean not null default true,
  creator_name text not null default '',
  creator_role text not null default '',
  projects text not null default '',
  open_to text not null default '',
  farcaster_url text not null default '',
  twitter_url text not null default '',
  dapp_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_impact_portfolios_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_impact_portfolios_updated_at on public.impact_portfolios;
create trigger trg_impact_portfolios_updated_at
before update on public.impact_portfolios
for each row
execute function public.set_impact_portfolios_updated_at();

alter table public.impact_portfolios enable row level security;

drop policy if exists "impact_portfolios_read_all" on public.impact_portfolios;
create policy "impact_portfolios_read_all"
on public.impact_portfolios
for select
to anon, authenticated
using (true);
