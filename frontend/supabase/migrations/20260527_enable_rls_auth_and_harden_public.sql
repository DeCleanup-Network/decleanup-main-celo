-- Supabase Security Advisor: rls_disabled_in_public + sensitive columns exposed
--
-- Auth.js / wallet tables: Prisma uses DATABASE_URL (direct Postgres). PostgREST must not
-- expose these via anon/authenticated — enable RLS with no permissive policies.
--
-- App data tables (airdrop, cdcu, verifier, …): server-only via SUPABASE_SERVICE_ROLE_KEY.
-- Service role bypasses RLS; anon/authenticated are denied.
--
-- impact_portfolios: public read policy remains (see 20260421_create_impact_portfolios.sql).
--
-- Run in Supabase Dashboard → SQL Editor (production project decleanup).

-- ---------------------------------------------------------------------------
-- Auth.js + non-custodial wallet (Prisma models; quoted identifiers)
-- ---------------------------------------------------------------------------

alter table if exists public."User" enable row level security;
alter table if exists public."User" force row level security;

alter table if exists public."Account" enable row level security;
alter table if exists public."Account" force row level security;

alter table if exists public."Session" enable row level security;
alter table if exists public."Session" force row level security;

alter table if exists public."VerificationToken" enable row level security;
alter table if exists public."VerificationToken" force row level security;

alter table if exists public."UserWallet" enable row level security;
alter table if exists public."UserWallet" force row level security;

alter table if exists public."PasskeyCredential" enable row level security;
alter table if exists public."PasskeyCredential" force row level security;

alter table if exists public."PasskeyUnlockSecret" enable row level security;
alter table if exists public."PasskeyUnlockSecret" force row level security;

alter table if exists public."WebAuthnChallenge" enable row level security;
alter table if exists public."WebAuthnChallenge" force row level security;

revoke all on table public."User" from anon, authenticated;
revoke all on table public."Account" from anon, authenticated;
revoke all on table public."Session" from anon, authenticated;
revoke all on table public."VerificationToken" from anon, authenticated;
revoke all on table public."UserWallet" from anon, authenticated;
revoke all on table public."PasskeyCredential" from anon, authenticated;
revoke all on table public."PasskeyUnlockSecret" from anon, authenticated;
revoke all on table public."WebAuthnChallenge" from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Server-only KV / workflow tables (RLS on, no policies — service role only)
-- ---------------------------------------------------------------------------

alter table if exists public.airdrop_issued_store enable row level security;
alter table if exists public.airdrop_issued_store force row level security;

alter table if exists public.cdcu_issued_store enable row level security;
alter table if exists public.cdcu_issued_store force row level security;

alter table if exists public.hypercert_requests enable row level security;
alter table if exists public.hypercert_requests force row level security;

alter table if exists public.telegram_submission_notifications enable row level security;
alter table if exists public.telegram_submission_notifications force row level security;

revoke all on table public.airdrop_issued_store from anon, authenticated;
revoke all on table public.cdcu_issued_store from anon, authenticated;
revoke all on table public.hypercert_requests from anon, authenticated;
revoke all on table public.telegram_submission_notifications from anon, authenticated;

-- verifier + snapshots (idempotent with 20260423)
alter table if exists public.verifier_applications enable row level security;
alter table if exists public.verifier_applications force row level security;

alter table if exists public.verifier_audit_log enable row level security;
alter table if exists public.verifier_audit_log force row level security;

alter table if exists public.impact_snapshots enable row level security;
alter table if exists public.impact_snapshots force row level security;

revoke all on table public.verifier_applications from anon, authenticated;
revoke all on table public.verifier_audit_log from anon, authenticated;
revoke all on table public.impact_snapshots from anon, authenticated;

-- impact_portfolios: keep public SELECT policy; block anon/authenticated writes
alter table if exists public.impact_portfolios enable row level security;

revoke insert, update, delete, truncate, references, trigger
  on table public.impact_portfolios
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Security Advisor: function search_path mutable (warnings)
-- ---------------------------------------------------------------------------

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

create or replace function public.set_hypercert_requests_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
