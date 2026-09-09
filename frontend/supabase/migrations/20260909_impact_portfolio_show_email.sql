-- Optional public email on impact portfolios (owner opt-in via Edit profile).
alter table public.impact_portfolios
  add column if not exists show_email boolean not null default false,
  add column if not exists public_email text not null default '';
