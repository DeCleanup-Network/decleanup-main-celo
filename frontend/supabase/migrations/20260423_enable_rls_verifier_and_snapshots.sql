-- Security hardening: ensure RLS is enabled on public tables flagged by Supabase Advisor.
-- Service role bypasses RLS; anon/authenticated are denied unless explicit policies are added.

alter table if exists public.verifier_applications enable row level security;
alter table if exists public.verifier_applications force row level security;

alter table if exists public.verifier_audit_log enable row level security;
alter table if exists public.verifier_audit_log force row level security;

alter table if exists public.impact_snapshots enable row level security;
alter table if exists public.impact_snapshots force row level security;
