-- Optional bank / local / crypto payment methods for funding campaigns.
alter table public.events
  add column if not exists payment_methods jsonb not null default '[]'::jsonb;

alter table public.events
  alter column recipient_address drop not null;
