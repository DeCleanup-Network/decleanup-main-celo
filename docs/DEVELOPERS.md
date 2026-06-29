# DeCleanup Rewards on Celo — Developer documentation

Master reference for integrators, contributors, and operators.  
**Production dapp:** [dapp.decleanup.net](https://dapp.decleanup.net) · **Repo:** [decleanup-main-celo](https://github.com/DeCleanup-Network/decleanup-main-celo)

---

## On this page

| Section | Jump |
|---------|------|
| [Overview](#overview) | What the stack does |
| [Repositories & URLs](#repositories--urls) | Where things live |
| [Celo network](#celo-network) | Chain ID, RPC, explorer |
| [Smart contracts](#smart-contracts-celo-mainnet) | All mainnet addresses |
| [Legacy contracts](#legacy-contracts) | Old deploys only |
| [DCU vs $cDCU](#dcu-vs-cdcu) | Points vs token |
| [ClaimVault flow](#claimvault-claim-flow) | How $cDCU is minted |
| [Product flows](#product-flows) | Cleanup → verify → claim |
| [Authentication & wallets](#authentication--wallets) | Sign-in and onchain identity |
| [Public impact API](#public-impact-api) | Read-only API for decleanup.net |
| [Dapp API catalog](#dapp-api-catalog) | All Next.js API routes |
| [Airdrop](#airdrop-past-contributors--giveth) | Manual allocation lists |
| [Hypercerts](#hypercerts) | Impact certificates |
| [Data stores](#data-stores) | Supabase, IPFS, Prisma |
| [Frontend layout](#frontend-layout) | Key code paths |
| [Contracts repo](#contracts-repo) | Hardhat, deploy, verify |
| [Environment variables](#environment-variables) | Env template |
| [Deployment](#deployment) | Vercel, VPS |
| [Deep-dive docs](#deep-dive-docs) | Other markdown files |

---

## Overview

**DeCleanup Rewards** is a Celo mainnet dapp where users:

1. Sign in (email, Google, or external wallet).
2. Submit cleanups with before/after photos, GPS, and optional impact/recyclables forms (IPFS).
3. Get verified by human verifiers (optional ML pre-screen on VPS).
4. Earn **DCU** participation points on-chain (DCURewardManager).
5. Mint **Impact Product** levels and optionally **Hypercerts**.
6. Claim **`$cDCU` (cDCU)** ERC-20 via **ClaimVault** when eligible (signed backend authorization).

External marketing sites (e.g. decleanup.net) consume **read-only** impact APIs from the dapp. They do not submit cleanups or mint tokens directly.

---

## Repositories & URLs

| Resource | URL |
|----------|-----|
| Celo dapp (production) | https://dapp.decleanup.net |
| Marketing site | https://decleanup.net |
| GitHub (monorepo) | https://github.com/DeCleanup-Network/decleanup-main-celo |
| Block explorer | https://celoscan.io |
| User guide (in-app) | https://dapp.decleanup.net/guide |

**Monorepo layout**

| Path | Contents |
|------|----------|
| `frontend/` | Next.js App Router dapp, APIs, Supabase client |
| `contracts/` | Hardhat: Submission, DCURewardManager, ImpactProductNFT, CDCUToken, ClaimVault |
| `docs/` | Architecture, token spec, deployment, this file |
| `contracts/scripts/deployed_addresses.json` | Core stack addresses (source of truth) |

---

## Celo network

| | Mainnet | Testnet |
|---|---------|---------|
| Name | Celo Mainnet | Celo Sepolia |
| Chain ID | **42220** | **11142220** |
| RPC | `https://forno.celo.org` | `https://forno.celo-sepolia.celo-testnet.org` |
| Explorer | https://celoscan.io | https://celo-sepolia.blockscout.com |

Production uses **chain ID 42220**. Set `NEXT_PUBLIC_CHAIN_ID=42220` and matching RPC in Vercel.

---

## Smart contracts (Celo mainnet)

Verify on Celoscan before integrating. Core trio is in `deployed_addresses.json`; **CDCUToken** and **ClaimVault** are in `contracts/scripts/verify-mainnet.sh`.

| Contract | Address | Role |
|----------|---------|------|
| **Submission** | [`0x2f3654f0ad8117c41185c589dcd0ea22522fe5af`](https://celoscan.io/address/0x2f3654f0ad8117c41185c589dcd0ea22522fe5af) | Cleanup lifecycle: IPFS hashes, lat/lng (microdegrees), pending → approved/rejected, referrals, recyclables |
| **DCURewardManager** | [`0x1936270b066ebadedc2d84f4ce3b488729d1d638`](https://celoscan.io/address/0x1936270b066ebadedc2d84f4ce3b488729d1d638) | **DCU** ledger: `totalEarned`, per-action buckets. Does **not** mint ERC-20 |
| **ImpactProductNFT** | [`0x97fa526fba91f01b5a4e0f25c71751e474cb6f45`](https://celoscan.io/address/0x97fa526fba91f01b5a4e0f25c71751e474cb6f45) | Impact Product NFT levels after verified cleanups |
| **CDCUToken (`$cDCU`)** | [`0x34d66e9552e9dc23a24eca13bb1f8f71f4b9bfc1`](https://celoscan.io/address/0x34d66e9552e9dc23a24eca13bb1f8f71f4b9bfc1) | ERC-20, 18 decimals, 10M max supply; only **ClaimVault** may `mint` |
| **ClaimVault** | [`0x4f69a1170c8799b5bc1587275b2e7da5a8406ff0`](https://celoscan.io/address/0x4f69a1170c8799b5bc1587275b2e7da5a8406ff0) | EIP-712 signed claims, nonces, category caps, calls `CDCUToken.mint` |

### GPS on Submission

Coordinates are stored as **int256 microdegrees** (degrees × 1,000,000). The dapp scales on submit:

```typescript
const latScaled = Math.round(lat * 1_000_000)
```

Public impact feed divides by `1_000_000` for decimal degrees.

### Frontend env mapping

| Env variable | Contract |
|--------------|----------|
| `NEXT_PUBLIC_SUBMISSION_CONTRACT` | Submission |
| `NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT` | DCURewardManager |
| `NEXT_PUBLIC_IMPACT_PRODUCT_NFT` | ImpactProductNFT |
| `NEXT_PUBLIC_CDCU_TOKEN_ADDRESS` | CDCUToken |
| `NEXT_PUBLIC_CLAIMVAULT_ADDRESS` | ClaimVault |

See `frontend/ENV_TEMPLATE.md` and `frontend/src/lib/blockchain/chain-constants.ts`.

### Verify on Celoscan

```bash
bash contracts/scripts/verify-mainnet.sh
```

---

## Legacy contracts

Reference only. Do not point new users or integrations here.

| Contract | Address |
|----------|---------|
| Old Submission | `0x1e355123f9dec3939552d80ad1a24175fd10688f` |
| Old DCURewardManager | `0xa462ad03f09e9dd8190d5ce9fec71f0ff835288a` |
| Old ImpactProductNFT | `0x97448790fd64dd36504d7f5ce7c2d27794b01959` |
| Legacy Submission (verify script) | `0xc6523bf318e39b6d9dfbcd95aed9d5c3c5d041d1` |
| Legacy ImpactProductNFT | `0xc6a7ec8b1695023d3ee74adc29972cd341aba3ea` |

---

## DCU vs $cDCU

| | **DCU** | **$cDCU (`cDCU`)** |
|---|---------|---------------------|
| Type | On-chain participation points (wei-scale in DCURewardManager) | ERC-20 token |
| Contract | DCURewardManager | CDCUToken |
| How earned | Verified cleanups, impact reports, verifier work, hypercert bonus, etc. | Minted through **ClaimVault** after backend signs a claim |
| User-facing | Dashboard stats, eligibility for $cDCU | Wallet balance, governance threshold (see `TOKEN_SPEC.md`) |

Legacy “claim DCU to ERC-20” paths are removed. Full detail: **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**, **`docs/TOKEN_SPEC.md`**.

---

## ClaimVault claim flow

```
User (dapp) → GET /api/cdcu/eligibility
           → POST /api/cdcu/claim-request  (server reads DCURewardManager, signs EIP-712)
           → User tx: ClaimVault.claim(signature, ...) on Celo
           → ClaimVault → CDCUToken.mint(user, amount)
```

**Eligibility (app today):** at least **50** DCU points; progressive multiplier capped at **2.0**; claims in **50 DCU tranches**. Logic: `frontend/src/lib/cdcu/claim-signing.ts`.

**Server secrets:** `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY` (must match ClaimVault constructor signer). Never expose in client or public docs.

**Airdrop** uses the same ClaimVault with a different category; see [Airdrop](#airdrop-past-contributors--giveth).

---

## Product flows

### Cleanup submit

1. User at `/cleanup` uploads photos → IPFS (`POST /api/ipfs/upload`).
2. Optional impact form JSON → IPFS.
3. On-chain `createSubmission` / `createSubmissionWithRecyclables` on **Submission** with lat/lng, hashes, referrer.
4. Optional ML pre-screen (`POST /api/ml-verification/verify`) when enabled on host.

### Verification

1. Verifiers at `/verifier` (role on Submission contract).
2. Review via app APIs (`/api/verifier/review/*`) and/or Telegram bot (`docs/TELEGRAM_VERIFIER_BOT.md`).
3. Approve → DCU accrual paths on DCURewardManager; Impact Product claim on dashboard.

### Impact Product

- Claim from dashboard after approval (`claimImpactProductFromVerification` in `contracts.ts`).
- Max level **10** (`MAX_IMPACT_PRODUCT_LEVEL`); new submissions disabled at max.

### Public impact portfolio

- `/impact/[address]` — on-chain + optional Supabase profile.
- Feed indexer: `frontend/src/lib/impact/indexer.ts` → Supabase `cleanup_feed`.

---

## Authentication & wallets

| Mode | Sign-in | Onchain identity | Gas |
|------|---------|------------------|-----|
| **Embedded (default)** | Google or email (Auth.js) | Safe smart account (ERC-4337) | Pimlico paymaster when configured |
| **External** | MetaMask / WalletConnect | User EOA | User pays CELO |

- Enabled when `NEXT_PUBLIC_AA_AUTH_ENABLED=true`.
- Passkeys optional: `/api/passkey/*`, WebAuthn RP ID = dapp hostname.
- Account settings: `/wallet`.
- Auth routes: `/api/auth/[...nextauth]`, `/api/aa/*`.

Details: **`docs/system-architecture.md`**, **`docs/AUTH_EMAIL_TROUBLESHOOTING.md`**.

---

## Public impact API

For **decleanup.net** and any external site. **No API key.** CORS: `*`.

**Base URL:** `https://dapp.decleanup.net`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/impact/global` | GET | Hero metrics, waste breakdown, top locations |
| `/api/impact/cleanups` | GET | Paginated verified cleanups (`?limit=&offset=`) |

Data source: Celo mainnet → indexer → Supabase `cleanup_feed`. Background sync when stale (~60 min).

**Full spec:** **`docs/PUBLIC_IMPACT_API.md`**

### Location fields (cleanups feed)

| Field | Notes |
|-------|-------|
| `location.label` | e.g. `Ko Pha-ngan, Thailand · 9.7°, 100.0°` |
| `location.placeName` | Reverse-geocoded (Nominatim, English/Latin when available) |
| `location.coordinates` | Display string, 1 decimal |
| `location.latitude` / `longitude` | Decimal degrees for maps |
| `impact.wasteTypes` | Waste types for “Type” column (not beach/park category) |

### Recent Verifications table mapping

| UI column | API |
|-----------|-----|
| Location | `location.label` |
| Type | `impact.wasteTypes.join(', ')` |
| Date | `verifiedAt` |

### Ops: refresh feed after deploy

```bash
curl -X POST "https://dapp.decleanup.net/api/impact/sync" \
  -H "x-impact-sync-secret: $IMPACT_SYNC_SECRET"
```

Requires migration `frontend/supabase/migrations/20260603_cleanup_feed_place_name.sql` for `placeName` column.

---

## Dapp API catalog

Base: `https://dapp.decleanup.net`. Unless noted, routes require an authenticated session or verifier role.

### Impact & feed

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/impact/global` | Public | Global stats |
| `GET /api/impact/cleanups` | Public | Cleanup feed |
| `GET /api/impact` | Public | Legacy/alternate impact read |
| `GET /api/impact/profile` | Public | Portfolio profile by address |
| `GET /api/impact/monthly` | Public | Monthly aggregates |
| `GET /api/impact/export` | Session | Export user impact |
| `POST /api/impact/sync` | Secret header | Rebuild `cleanup_feed` from chain |
| `POST /api/impact/cleanup-meta` | Rate limit | Recyclables amount metadata |

### $cDCU claims

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/cdcu/eligibility` | Session | Points → claimable $cDCU |
| `POST /api/cdcu/claim-request` | Session | EIP-712 signed claim payload |
| `POST /api/cdcu/record-issued` | Internal | Track issued amount |
| `POST /api/cdcu/clear-pending` | Internal | Clear pending claim state |
| `POST /api/cdcu/unlock` | Internal | Unlock flow helper |

### Airdrop

| Route | Auth | Purpose |
|-------|------|---------|
| `GET /api/airdrop/check` | Public | Eligibility for manual lists |
| `POST /api/airdrop/claim-request` | Session | Signed airdrop claim |
| `POST /api/airdrop/record-issued` | Internal | Record mint |
| `POST /api/airdrop/clear-pending` | Internal | Clear pending |

### Verifier

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/verifier/apply` | Session | Apply to verify |
| `GET /api/verifier/applications` | Verifier/admin | List applications |
| `POST /api/verifier/review/init` | Verifier | Start review |
| `POST /api/verifier/review` | Verifier | Submit review |
| `POST /api/verifier/review/confirm` | Verifier | Confirm on-chain |

### Account abstraction & passkeys

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/aa/bootstrap` | Session | Smart account setup |
| `POST /api/aa/wallet` | Session | Wallet metadata |
| `POST /api/aa/send` | Session | Sponsored UserOp |
| `GET /api/aa/receipt` | Session | UserOp receipt |
| `POST /api/passkey/register/options` | Session | WebAuthn register |
| `POST /api/passkey/register/verify` | Session | WebAuthn register verify |
| `POST /api/passkey/auth/options` | Session | WebAuthn auth |
| `POST /api/passkey/auth/verify` | Session | WebAuthn auth verify |
| `GET /api/passkey/status` | Session | Passkey status |
| `POST /api/passkey/remove` | Session | Remove passkey |

### Hypercerts

| Route | Auth | Purpose |
|-------|------|---------|
| `GET/POST /api/hypercerts/requests` | Session | List/create requests |
| `POST /api/hypercerts/requests/review` | Verifier | Approve/reject; **auto-publishes to ATProto on approve** when enabled |
| `POST /api/hypercerts/requests/atproto-publish` | Verifier | Retry failed publish, or `force: true` to re-publish (cover fix) |
| `POST /api/hypercerts/requests/publish` | Session | Requester retry + AT login diagnostic (GET) |
| `POST /api/hypercerts/requests/mint` | Session | Legacy Celo minter flow |

Bundle verified cleanups into Hypercert certificates. Production path: **AT Protocol publish → Hyperscan** after verifier approval.  
Code map: **`docs/HYPERCERTS.md`**, product flow: **`docs/hypercerts-and-impact.md`**.

| Item | Location |
|------|----------|
| Eligibility | `frontend/src/lib/blockchain/hypercerts/eligibility.ts` |
| UI | `/hypercerts` |
| AT publish | `atproto-publish.ts`, `atproto/client.ts` |
| Publish notification | `HypercertPublishedNotifier.tsx` |
| DCU bonus (legacy mint) | `DCURewardManager.claimHypercertReward` |

### IPFS & uploads

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/ipfs/upload` | Session | Upload to Pinata |
| `GET /api/ipfs/fetch` | Public | Proxy fetch (OG/social) |
| `GET /api/uploads/[...path]` | Varies | ML/upload disk reads (VPS) |

### ML (optional, VPS)

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/ml-verification/verify` | Session | Trigger GPU/local ML |
| `GET /api/ml-verification/result` | Session | Poll result |
| `POST /api/dmrv/verify` | Internal | DMRV hook |

### Other

| Route | Auth | Purpose |
|-------|------|---------|
| `GET/POST /api/auth/[...nextauth]` | Public | Auth.js |
| `GET /api/auth/wallet/nonce` | Public | Wallet nonce |
| `GET /api/ens/forward` | Public | ENS forward resolution |
| `GET /api/ens/reverse` | Public | ENS reverse |
| `GET /api/rpc/celo-sepolia` | Public | RPC proxy (dev/test) |
| `POST /api/telegram/submission-created` | Webhook | Verifier Telegram |
| `GET /api/health/sharp` | Public | Image pipeline health |

---

## Airdrop (past contributors & Giveth)

Static allocation lists (not live Giveth API):

| File | Category | Amount |
|------|----------|--------|
| `frontend/src/lib/airdrop/giveth-donors.ts` | `giveth_donors` | 250 $cDCU each |
| `frontend/src/lib/airdrop/manual-allocations.ts` | `past_contributor` | 250 $cDCU (most rows). **Whitelist signer EOA** (MetaMask / gardens.fund address from Account settings), not the Safe smart account. |

Check eligibility:

```http
GET https://dapp.decleanup.net/api/airdrop/check?address=0x...
```

Sync Giveth list from API (maintainers):

```bash
cd frontend && npm run airdrop:sync-giveth-donors
```

---

## Hypercerts

Bundle verified cleanups into Hypercert certificates. Production publishing uses **AT Protocol** (Hyperscan) after verifier approval; legacy Celo minter optional.  
Code map: **`docs/HYPERCERTS.md`**, product flow: **`docs/hypercerts-and-impact.md`**.

| Item | Location |
|------|----------|
| Eligibility | `frontend/src/lib/blockchain/hypercerts/eligibility.ts` |
| UI | `/hypercerts` |
| AT publish | `frontend/src/lib/blockchain/hypercerts/atproto-publish.ts` |
| DCU bonus (legacy mint) | `DCURewardManager.claimHypercertReward` |

---

## Data stores

| Store | Role |
|-------|------|
| **Celo RPC** | Contract reads/writes |
| **Pinata / IPFS** | Photos, impact JSON, hypercert assets |
| **Supabase** | `cleanup_feed`, verifier applications, hypercert requests, impact portfolios, airdrop pending state |
| **Prisma** (optional) | Passkeys, wallet rows when AA enabled |

Migrations: `frontend/supabase/migrations/`

Key tables:

- `cleanup_feed` — public landing API source
- Impact portfolios — `/impact/[address]` editable profile

---

## Frontend layout

| Area | Path |
|------|------|
| Landing / dashboard | `src/app/page.tsx`, `src/app/dashboard/` |
| Submit cleanup | `src/app/cleanup/`, `src/features/cleanup/` |
| Verifier | `src/app/verifier/` |
| Wallet / AA | `src/app/wallet/`, `src/lib/smart-account/`, `src/providers/` |
| Blockchain reads | `src/lib/blockchain/contracts.ts` |
| ClaimVault client | `src/lib/blockchain/claim-vault.ts` |
| Impact indexer | `src/lib/impact/indexer.ts`, `cleanup-feed-sync.ts` |
| Airdrop | `src/lib/airdrop/` |

**Run locally**

```bash
cd frontend
cp ENV_TEMPLATE.md .env.local   # fill values
npm install
npm run dev
```

Open http://localhost:3000

---

## Contracts repo

```bash
cd contracts
npm install
npx hardhat test
```

| Script | Purpose |
|--------|---------|
| `scripts/deploy-core-stack.ts` | Submission, DCURewardManager, ImpactProductNFT |
| `scripts/deploy-cdcu.ts` | CDCUToken + ClaimVault |
| `scripts/setup-roles.ts` | Roles after deploy |
| `scripts/verify-mainnet.sh` | Celoscan verification |

Deploy docs: **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**, **`contracts/scripts/README-FEE-SCHEDULING.md`**.

---

## Environment variables

Copy **`frontend/.env.example`** → `frontend/.env.local` (see **`frontend/ENV_TEMPLATE.md`** for notes).

**Production minimum (mainnet)**

```bash
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_SUBMISSION_CONTRACT=0x2f3654f0ad8117c41185c589dcd0ea22522fe5af
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0x1936270b066ebadedc2d84f4ce3b488729d1d638
NEXT_PUBLIC_IMPACT_PRODUCT_NFT=0x97fa526fba91f01b5a4e0f25c71751e474cb6f45
NEXT_PUBLIC_CDCU_TOKEN_ADDRESS=0x34d66e9552e9dc23a24eca13bb1f8f71f4b9bfc1
NEXT_PUBLIC_CLAIMVAULT_ADDRESS=0x4f69a1170c8799b5bc1587275b2e7da5a8406ff0
NEXT_PUBLIC_WEB_APP_URL=https://dapp.decleanup.net
NEXT_PUBLIC_AA_AUTH_ENABLED=true
```

Also required in production: Supabase URL + service role, Auth.js secrets, Pimlico keys (gasless), Pinata, `IMPACT_SYNC_SECRET`, ClaimVault signer key.

After any `NEXT_PUBLIC_*` change on Vercel: **redeploy**.

---

## Deployment

| Target | Doc |
|--------|-----|
| Vercel (primary dapp) | `docs/deployment-plan.md` |
| VPS (ML, uploads, mirror) | `docs/VPS_DEPLOYMENT.md` |
| Secrets rotation | `docs/SECRETS_ROTATION.md` |
| VPS security | `docs/VPS_SECURITY_PROTOCOL.md` |

Production URL for all public APIs: **https://dapp.decleanup.net**

---

## Deep-dive docs

| Document | Topic |
|----------|--------|
| `PUBLIC_IMPACT_API.md` | Landing API field-by-field |
| `B_CDCU_ONLY_ARCHITECTURE.md` | DCU / ClaimVault |
| `TOKEN_SPEC.md` | $cDCU tokenomics |
| `system-architecture.md` | Stack diagram |
| `HYPERCERTS.md` | Hypercerts code map |
| `hypercerts-and-impact.md` | Product pipeline |
| `ML_VERIFICATION_ARCHITECTURE.md` | Optional GPU ML |
| `TELEGRAM_VERIFIER_BOT.md` | Telegram notifier |
| `AUTH_EMAIL_TROUBLESHOOTING.md` | Magic link issues |
| `VPS_DEPLOYMENT.md` | PM2 + ML host |
| `deployment-plan.md` | Release checklist |

**Contract addresses:** always reconcile `deployed_addresses.json` + `verify-mainnet.sh` before publishing.

**Support:** support@decleanup.net · [Wallet passkey reset runbook](./WALLET_SUPPORT_RESET.md) (team)
