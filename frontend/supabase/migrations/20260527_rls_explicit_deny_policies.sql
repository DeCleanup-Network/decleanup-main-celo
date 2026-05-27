-- Optional follow-up: clears Security Advisor INFO "RLS Enabled No Policy".
-- Same effective access as no policies (anon/authenticated denied). Service role unchanged.
--
-- Run after 20260527_enable_rls_auth_and_harden_public.sql, then Rerun linter.

create or replace function public._ensure_api_deny_policy(p_table regclass, p_policy_name text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  t text := p_table::text;
begin
  execute format('drop policy if exists %I on %s', p_policy_name, t);
  execute format(
    'create policy %I on %s for all to anon, authenticated using (false) with check (false)',
    p_policy_name,
    t
  );
end;
$$;

select public._ensure_api_deny_policy('public."User"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."Account"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."Session"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."VerificationToken"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."UserWallet"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."PasskeyCredential"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."PasskeyUnlockSecret"'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public."WebAuthnChallenge"'::regclass, 'api_access_denied');

select public._ensure_api_deny_policy('public.airdrop_issued_store'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public.cdcu_issued_store'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public.hypercert_requests'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public.impact_snapshots'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public.telegram_submission_notifications'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public.verifier_applications'::regclass, 'api_access_denied');
select public._ensure_api_deny_policy('public.verifier_audit_log'::regclass, 'api_access_denied');

drop function public._ensure_api_deny_policy(regclass, text);
