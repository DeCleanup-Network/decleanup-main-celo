-- Dedup log for Telegram alerts when a new cleanup is submitted onchain.
-- Server-only via service role (RLS enabled, no public policies).

create table if not exists public.telegram_submission_notifications (
  submission_id text primary key,
  tx_hash text,
  notified_at timestamptz not null default now()
);

create index if not exists telegram_submission_notifications_notified_at_idx
  on public.telegram_submission_notifications (notified_at desc);

alter table public.telegram_submission_notifications enable row level security;
