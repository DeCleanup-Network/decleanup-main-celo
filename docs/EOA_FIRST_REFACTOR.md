# EOA-first wallet identity

Medium-term refactor: **one address** the user sees, shares, and imports — the EOA signer. The smart account (Safe / ERC-4337) stays as invisible execution infrastructure for gas sponsorship and batched transactions.

## What users experience

1. Sign in with Google/email
2. See one address (EOA)
3. Impact portfolio at `/impact/{eoa}`
4. $cDCU airdrops and Gardens use the same address
5. Export signing key → MetaMask/Rabby shows the same address

## Actual schema (not the draft spec)

The draft spec assumed Supabase `users(smart_account_address PRIMARY KEY)`. **This repo uses:**

| Store | EOA | Smart account |
|-------|-----|---------------|
| Prisma `UserWallet` | `address` (unique) | `smartAccountAddress` |
| Onchain submissions | — | submitter = Safe |
| `impact_portfolios` (Supabase) | `address` (EOA after backfill) | legacy rows copied via migration |
| `impact_portfolio_endorsements` | `portfolio_address` (EOA after backfill) | legacy Safe rows re-keyed |
| `cleanup_feed` | `eoa_address` (display) | `submitter` = onchain Safe |
| `hypercert_requests` | contributor display = EOA (Option B) | `requester` may still be Safe |
| Airdrop whitelist | EOA | — |

**Do not rewrite onchain submitter to EOA** without a contract migration. Historical cleanup IDs stay under the Safe; the app resolves EOA → Safe for reads.

## Architecture

```
User action → EOA signs → Smart account executes → Paymaster covers gas
                ↑                   ↑
          (user-visible)        (internal only)
```

## Phase 1 (shipped)

- `resolveWalletIdentity()` — Prisma lookup, Safe `getOwners()`, CREATE2 predict
- `GET /api/wallet/resolve-identity?address=`
- Impact portfolio URLs use EOA; old `/impact/{safe}` redirects to EOA
- Portfolio data fetch: `rewardOwner = EOA`, `submissionOwner = Safe` when linked
- Account settings: single address UI
- Profile API: read legacy Safe row, write new rows under EOA

## Phase 2 (shipped)

- `PastContributorAirdropStrip` checks EOA (via `useAppWalletAddress`)
- Endorsements: `listPortfolioEndorsementsResolved()` + API identity resolution; new rows saved under EOA
- SQL migration `20260616_eoa_first_identity_backfill.sql` — profiles copy, endorsements re-key, `cleanup_feed.eoa_address`
- Hypercerts Option B: portfolio loads requests by EOA + legacy Safe; metadata contributors use EOA; display resolves Safe → EOA
- Cleanup feed sync populates `eoa_address`; public feed items expose EOA for portfolio links
- **Referral links** use EOA (`?ref={eoa}`); legacy Safe refs normalize via `normalizeReferrerAddress()` before save/submit
- **Reward manager reads** merge EOA + linked Safe (`getMergedUserRewardStats`, `getMergedUserLevel`) on dashboard, profile, verifier eligibility, and cDCU claim APIs
- **Onchain submitter** remains Safe for gasless users (historical chain data; no contract migration)

## Referral and rewards (EOA-first)

| Surface | Address used |
|---------|----------------|
| Referral URL `?ref=` | EOA |
| Onchain `referrer` at first submit | EOA (normalized from legacy Safe links) |
| DCU reward manager accrual | Per address on chain; UI merges EOA + Safe |
| Cleanup submitter on chain | Safe when gasless (unchanged) |
| Dashboard / profile DCU totals | Merged EOA + Safe |
| cDCU claim eligibility API | Merged; pending keyed by EOA |

Key helpers: `frontend/src/lib/blockchain/merge-reward-stats.ts`, `frontend/src/lib/wallet/normalize-referrer-address.ts`

### Run the Supabase migration

Apply on the project that shares Postgres with Prisma `UserWallet`:

```bash
# Supabase CLI or SQL editor
supabase db push
# or run frontend/supabase/migrations/20260616_eoa_first_identity_backfill.sql manually
```

## Key files

| Area | Path |
|------|------|
| Identity resolution | `frontend/src/lib/wallet/resolve-identity.ts` |
| Portfolio lookup helpers | `frontend/src/lib/wallet/portfolio-lookup-addresses.ts` |
| Endorsements resolved | `frontend/src/lib/supabase/impact-portfolio-endorsements.ts` |
| Portfolio hypercerts | `frontend/src/lib/impact/portfolio-hypercerts.ts` |
| Cleanup feed EOA | `frontend/src/lib/impact/cleanup-feed-sync.ts` |
| SQL backfill | `frontend/supabase/migrations/20260616_eoa_first_identity_backfill.sql` |

## QA checklist

Run after deploy + migration:

- [ ] New user: one address in Account settings; portfolio URL uses EOA
- [ ] Existing user: `/impact/{old-safe}` redirects to `/impact/{eoa}`
- [ ] Portfolio shows all cleanups (merged from Safe)
- [ ] Past contributor airdrop strip uses EOA (embedded + external)
- [ ] Endorsements on legacy Safe portfolio appear on EOA URL
- [ ] Hypercerts hub lists requests minted under old Safe address
- [ ] Public cleanup feed links use EOA where mapped
- [ ] Referral link uses EOA; legacy Safe `?ref=` still resolves
- [ ] Dashboard / profile DCU totals include merged Safe balance
- [ ] Gardens / airdrop still use EOA
- [ ] Gasless submit still works (Safe executes)
- [ ] External MetaMask user: `/impact/{eoa}` only, no redirect loop

## Future (optional)

- Hypercerts Option A: mint recipient field = EOA onchain (if protocol supports)
- `$cDCU` Supabase view keyed by EOA → Safe for off-chain balance display
- Re-sync cleanup feed after migration to populate all `eoa_address` rows
