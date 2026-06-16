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
| `impact_portfolios` (Supabase) | `address` (migrating to EOA) | legacy rows may still be under Safe |
| Airdrop whitelist | EOA | — |

**Do not rewrite onchain submitter to EOA** without a contract migration. Historical cleanup IDs stay under the Safe; the app resolves EOA → Safe for reads.

## Architecture

```
User action → EOA signs → Smart account executes → Paymaster covers gas
                ↑                   ↑
          (user-visible)        (internal only)
```

## Phase 1 (implemented)

- `resolveWalletIdentity()` — Prisma lookup, Safe `getOwners()`, CREATE2 predict
- `GET /api/wallet/resolve-identity?address=`
- Impact portfolio URLs use EOA; old `/impact/{safe}` redirects to EOA
- Portfolio data fetch: `rewardOwner = EOA`, `submissionOwner = Safe` when linked
- Account settings: single address UI
- Profile API: read legacy Safe row, write new rows under EOA

## Phase 2 (future)

- Backfill `impact_portfolios.address` from Safe → EOA where needed
- Hypercerts contributor field (Option A) or display-layer mapping (Option B)
- `cleanup_feed` indexer keyed by EOA for off-chain display (onchain submitter unchanged)
- Optional Supabase view for $cDCU balance by EOA → Safe mapping

## Key files

| Area | Path |
|------|------|
| Identity resolution | `frontend/src/lib/wallet/resolve-identity.ts` |
| Safe predict | `frontend/src/lib/wallet/predict-safe-from-address.ts` |
| API | `frontend/src/app/api/wallet/resolve-identity/route.ts` |
| Impact page | `frontend/src/app/impact/[address]/page.tsx` |
| Portfolio fetch | `frontend/src/lib/impact/public-portfolio-data.ts` |
| Onchain submit owner | `frontend/src/hooks/useSmartAccountClient.ts` (`submissionOwnerAddress`) |

## Testing checklist

- [ ] New user: one address in Account settings; portfolio URL uses EOA
- [ ] Existing user: `/impact/{old-safe}` redirects to `/impact/{eoa}`
- [ ] Portfolio still shows all cleanups (merged from Safe)
- [ ] Gardens / airdrop still use EOA
- [ ] Gasless submit still works (Safe executes)
- [ ] External MetaMask user: `/impact/{eoa}` only, no redirect loop
