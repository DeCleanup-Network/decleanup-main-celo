# Mainnet rollout: merge path, deploy, and next steps

**This file is intentionally local-only** (not committed). Keep secrets out of it; use your password manager and Vercel/VPS env UIs.

---

## 1. Current branch: `ai-verification` → push to origin

You are on the integration branch used for verifier, hypercerts, and deploy parity (see `frontend/ENV_TEMPLATE.md`).

**Push:**

```bash
git status
git push origin ai-verification
```

If the remote rejects non-fast-forward updates, pull with rebase first: `git pull --rebase origin ai-verification`, resolve conflicts, then push again.

---

## 2. How to land this work on `main`

**Recommended: pull request**

1. Open a PR **from `ai-verification` into `main`** on your Git host (GitHub/GitLab).
2. Set a clear title (e.g. “Merge ai-verification: verifier, hypercerts, portfolio, deploy parity”).
3. In the PR description, call out:
   - **Contracts:** any new deploy addresses or breaking ABI changes; point to `contracts/scripts/deployed_addresses.json` (or your canonical JSON).
   - **Env:** required new or renamed `NEXT_PUBLIC_*` and server-only keys (see `frontend/ENV_TEMPLATE.md`).
   - **Database:** Supabase migrations under `frontend/supabase/migrations/` that must run before or with the release.
4. **CI / checks:** run at minimum:
   - `cd contracts && npx hardhat test` (or your project’s test command)
   - `cd frontend && npm run build`
5. **Review:** at least one reviewer for contract or env changes; avoid merging with failing build.
6. Merge strategy: **squash** (single clean commit on `main`) or **merge commit** (preserve branch history), per team preference.
7. After merge, **tag the release** (e.g. `v1.x.x`) for support and rollbacks.

**Direct merge (small teams only):**

```bash
git checkout main
git pull origin main
git merge --no-ff ai-verification
# resolve conflicts, then
git push origin main
```

Use a PR instead if more than one person touches production.

---

## 3. Mainnet deployment: high-level order

Order matters: contracts and chain configuration must exist before the app can point to them.

### 3.1 Pre-flight

- [ ] Confirm **Celo mainnet** chain ID and RPCs (see `frontend/src/lib/blockchain/chain-constants.ts` and how `NEXT_PUBLIC_*` overrides work).
- [ ] Inventory **all addresses**: Submission, Impact Product NFT, RewardManager / distributor, ClaimVault, Hypercerts contracts (if used), any treasury/admin multisigs.
- [ ] **Multisig / hardware wallets** ready for admin transactions (roles, fees, pausing).

### 3.2 Smart contracts (mainnet)

1. Deploy or upgrade using your Hardhat/Ignition scripts under `contracts/` (follow `contracts/README.md` and any script-specific notes).
2. Run **`setup-roles`** (or equivalent) so verifiers, admins, and reward wiring match production intent.
3. Record addresses in **`contracts/scripts/deployed_addresses.json`** (or your single source of truth).
4. **Verify** contracts on CeloScan (or Blockscout) for transparency and debugging.

### 3.3 Environment variables (production)

1. Copy from **`frontend/ENV_TEMPLATE.md`** into production secrets:
   - **Vercel** (or host): Production environment for the Next.js app.
   - **VPS** (if self-hosting): `frontend/.env.local` or PM2 ecosystem env; restart PM2 with `--update-env`.
2. Set **`NEXT_PUBLIC_CHAIN_ID`**, **`NEXT_PUBLIC_RPC_URL`**, **`NEXT_PUBLIC_BLOCK_EXPLORER_URL`** to **mainnet** values (not Sepolia).
3. Paste **all `NEXT_PUBLIC_*` contract addresses** from the deploy artifact.
4. Server-only keys (never in client bundles):
   - `SUPABASE_SERVICE_ROLE_KEY`, Pinata JWT, ClaimVault signer key, ML/GPU service secrets, etc.
5. **Web3Auth / WalletConnect:** production client IDs and allowed origins if you use them.

### 3.4 Supabase

- [ ] Apply migrations (e.g. verifier applications, `hypercert_requests`, impact portfolios, RLS policies as designed).
- [ ] Confirm **service role** is only on the server; anon key is safe for client with RLS where applicable.

### 3.5 Off-chain services

- [ ] **GPU / ML inference** (if used): deploy or point `gpu-inference-service` to mainnet RPC + correct env; health-check routes if enabled.
- [ ] **IPFS / Pinata:** production JWT; confirm gateway URL in `NEXT_PUBLIC_IPFS_GATEWAY`.

### 3.5.1 Production settings checklist (Web3Auth / Pimlico / YOLO-ML / Hypercerts)

Use this as a go-live verification list so dashboard settings and envs are aligned.

#### Web3Auth (optional, if email/social login is enabled)

- [ ] `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` is set from Web3Auth dashboard (Production app, not test app).
- [ ] `NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet` for production.
- [ ] In Web3Auth dashboard, whitelist production origins/redirects (`https://dapp.decleanup.net` and any canonical domain variants you serve).
- [ ] Verify login flow on production domain: connect, session restore, disconnect, reconnect.
- [ ] Keep feature disabled if client ID is intentionally unset (expected behavior in this repo).

#### Pimlico (AA gasless path)

The bundler/paymaster URL in `frontend/src/lib/blockchain/smart-account.ts` is now **chain-aware**:
it routes to `https://api.pimlico.io/v2/celo/rpc` when `NEXT_PUBLIC_CHAIN_ID=42220` and to
`https://api.pimlico.io/v2/celo-sepolia/rpc` when `NEXT_PUBLIC_CHAIN_ID=11142220`. No code change
needed to switch chains — only env + dashboard.

**Important:** Pimlico API keys are **not** chain-scoped. The same key works on every chain
Pimlico supports. What IS chain-scoped is the **sponsorship policy** you create in the dashboard,
and the **account balance** is global. So "enabling mainnet" really means: have prepaid balance,
and create a sponsorship policy that selects Celo Mainnet.

- [ ] `NEXT_PUBLIC_PIMLICO_API_KEY` (or server `PIMLICO_API_KEY`) is present for production.
- [ ] Pimlico account has **prepaid balance** (or card on file) sufficient for expected mainnet
  volume. Without this, paymaster calls fail with `paymaster_balance_too_low` even though the
  key itself is valid.
- [ ] In the **Pimlico dashboard → Sponsorship Policies**, a policy exists with **Celo Mainnet
  (42220)** selected, status **enabled**, with reasonable per-sender / per-day spending limits.
- [ ] That policy **allowlists the production contract addresses** the app actually calls:
  `Submission`, `ImpactProductNFT`, `DCURewardManager`, `ClaimVault`, and (if used) the
  Hypercerts minter at `0x16bA53B74c234C870c61EFC04cD418B8f2865959`. Without an explicit
  allowlist, the paymaster will reject UserOps with `AA33 paymaster validation failed`.
- [ ] `NEXT_PUBLIC_CHAIN_ID=42220` and `NEXT_PUBLIC_RPC_URL` are mainnet so signer, bundler, and
  paymaster all operate on the same chain.
- [ ] **Who pays for gas after launch:** Pimlico fronts CELO for sponsored UserOps and debits
  your prepaid Pimlico balance. Embedded-wallet (Web3Auth) users go through this path; external
  wallet users (MetaMask, WalletConnect, etc.) pay their own gas in CELO and never touch
  Pimlico.
- [ ] Validate one end-to-end gasless transaction in prod (submit/claim path) and confirm UserOp
  inclusion on a mainnet block explorer.
- [ ] Ensure fallback UX works when Pimlico is unavailable: external-wallet users keep working on
  EOA + their own gas; embedded-wallet users see a clear banner (already wired via
  `GaslessStatusBanner`).

#### YOLO / ML verification service

- [ ] `ML_VERIFICATION_ENABLED=true` where server-side verification should run.
- [ ] If frontend override is used, `NEXT_PUBLIC_ML_VERIFICATION_ENABLED` is set intentionally (or omitted to use default behavior).
- [ ] ML service endpoint/token envs are production values; no localhost/private-dev URLs in Vercel production.
- [ ] Health checks return OK from production runtime; inference latency and timeout thresholds are acceptable.
- [ ] Confirm at least one verify run writes expected result payloads consumed by verifier UI.

#### Hypercerts

- [ ] `NEXT_PUBLIC_HYPERCERTS_NETWORK` matches production intent (`celo`/mainnet setup; not Sepolia).
- [ ] `NEXT_PUBLIC_HYPERCERTS_API_KEY` is valid for production traffic.
- [ ] `NEXT_PUBLIC_HYPERCERTS_MINTER_UUPS_ADDRESS` points to the deployed mainnet minter (if override is used).
- [ ] `NEXT_PUBLIC_HYPERCERT_RELAXED_ELIGIBILITY` is **off** in production unless explicitly required.
- [ ] Run full smoke path on prod: request -> verifier/admin review -> mint -> profile/impact surfaces updated.

#### ClaimVault signer (for $cDCU / airdrop claim-request APIs)

- [ ] `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY` is set on server runtime (this exact name; not legacy aliases).
- [ ] `NEXT_PUBLIC_CLAIMVAULT_ADDRESS` matches deployed mainnet ClaimVault.
- [ ] Apply Supabase migration `frontend/supabase/migrations/20260513_create_cdcu_issued_store.sql` (creates the durable `cdcu_issued_store` key/value table that replaces the local JSON file store).
- [ ] Seed existing local data into Supabase (one-time): `node frontend/scripts/migrate-cdcu-issued-to-supabase.mjs` (requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` in `frontend/.env.local`). Pass `DRY_RUN=1` first to preview.
- [ ] Optional ops envs are set if used: `CLAIM_VAULT_UNLOCK_SECRET`. `CLAIM_VAULT_ISSUED_STORE_PATH` is **no longer required** in production — claim accounting is now in Supabase. It is still honored for local dev when Supabase env is absent.
- [ ] Confirm `/api/cdcu/claim-request` and `/api/airdrop/claim-request` return 200 in production for an eligible wallet.

### 3.6 Frontend deploy

- Vercel: connect `main`, enable Production branch, set env vars, deploy.
- VPS: follow your existing scripts (e.g. `scripts/vps/*`, `deploy-to-vps.sh`, `docs/VPS_*` if present in your tree).

### 3.7 Smoke test on mainnet (after deploy)

Use **`docs/deployment-plan.md`** as the short checklist:

1. Connect wallet on **mainnet**.
2. Submit cleanup → verifier flow (if applicable).
3. Impact Product claim path.
4. `$cDCU` claim when eligible (ClaimVault signer + env).
5. Hypercerts: request → admin approval → mint (if enabled for mainnet).
6. Impact portfolio / profile pages if deployed.

### 3.8 Operational extras

- **DNS / TLS:** apex and `www` or app subdomain point to Vercel or your VPS; HSTS if applicable.
- **Monitoring:** error tracking (Sentry, etc.), RPC rate limits, PM2 logs on VPS.
- **Secrets rotation:** see `docs/SECRETS_ROTATION.md` if present in your repo.
- **Incident response:** who can pause contracts or disable minting; backup deploy addresses.

---

## 4. Risk notes specific to this codebase

- **Chain constants:** switching from testnet to mainnet must be consistent across client, API routes that use `REQUIRED_RPC_URL`, and any server-side viem clients (`admin-check`, verifier APIs).
- **Hypercerts:** minter and SDK config (`frontend/src/lib/blockchain/hypercerts/config.ts`) must match **mainnet** contract addresses before enabling mint in production.
- **ClaimVault / $cDCU:** signer key and vault address must match the deployed mainnet ClaimVault; wrong signer causes silent claim failures.

---

## 5. Quick reference files in this repo

| Topic | File |
|--------|------|
| Env template | `frontend/ENV_TEMPLATE.md` |
| Short deploy checklist | `docs/deployment-plan.md` |
| Architecture / $cDCU | `docs/B_CDCU_ONLY_ARCHITECTURE.md` (if tracked) |
| Token / economics | `docs/TOKEN_SPEC.md` |

---

## 6. After mainnet is live

- Announce maintenance windows for future contract upgrades.
- Keep **deployed addresses** and **env inventory** in a secure internal doc (not this file).
- Schedule periodic review of admin keys, RPC endpoints, and dependency updates.
