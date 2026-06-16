-- EOA-first identity: backfill off-chain keys and add cleanup_feed.eoa_address.
-- Requires Prisma "UserWallet" in the same Postgres database (address = EOA, smartAccountAddress = Safe).

-- 1) Copy impact portfolio profiles from legacy smart-account key to EOA when missing
insert into public.impact_portfolios (
  address,
  display_name,
  bio,
  location_label,
  location_coords,
  show_precise_location,
  creator_name,
  creator_role,
  projects,
  open_to,
  farcaster_url,
  twitter_url,
  dapp_url,
  legal_name,
  impact_context,
  additionality_statement
)
select
  lower(uw.address),
  ip.display_name,
  ip.bio,
  ip.location_label,
  ip.location_coords,
  ip.show_precise_location,
  ip.creator_name,
  ip.creator_role,
  ip.projects,
  ip.open_to,
  ip.farcaster_url,
  ip.twitter_url,
  ip.dapp_url,
  coalesce(ip.legal_name, ''),
  coalesce(ip.impact_context, ''),
  coalesce(ip.additionality_statement, '')
from public."UserWallet" uw
join public.impact_portfolios ip
  on lower(ip.address) = lower(uw."smartAccountAddress")
where lower(uw.address) <> lower(uw."smartAccountAddress")
  and not exists (
    select 1
    from public.impact_portfolios ip2
    where lower(ip2.address) = lower(uw.address)
  )
on conflict (address) do nothing;

-- 2) Re-key endorsements from smart account to EOA
update public.impact_portfolio_endorsements e
set portfolio_address = lower(uw.address)
from public."UserWallet" uw
where lower(e.portfolio_address) = lower(uw."smartAccountAddress")
  and lower(e.portfolio_address) <> lower(uw.address);

-- 3) Public cleanup feed: optional EOA for display / portfolio links (submitter stays onchain Safe)
alter table public.cleanup_feed
  add column if not exists eoa_address text;

update public.cleanup_feed cf
set eoa_address = lower(uw.address)
from public."UserWallet" uw
where cf.eoa_address is null
  and lower(cf.submitter) = lower(uw."smartAccountAddress")
  and lower(uw.address) <> lower(uw."smartAccountAddress");

create index if not exists cleanup_feed_eoa_address_idx
  on public.cleanup_feed (lower(eoa_address))
  where eoa_address is not null;
