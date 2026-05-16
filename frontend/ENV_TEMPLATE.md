# Environment Variables Template

Copy this to **`.env.local`** in the **`frontend/`** directory and fill in your values. Next.js loads only **`frontend/.env.local`** for the app (not `frontend/_.env.local`). Put comments on **their own lines**  -  inline `# ...` after a URL can break RPC parsing for some tools and servers.

**$cDCU and deploy:** See **`docs/B_CDCU_ONLY_ARCHITECTURE.md`** (deploy commands + `frontend/.env.local` contract table).

**Release branch:** `ai-verification` (all lowercase) is the integration branch for verifier, hypercerts, and deploy parity. Match the same vars on Vercel (Production/Preview) and any VPS PM2 env.

```bash
# ============================================
# REQUIRED: Network Configuration
# ============================================
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
# Celo Sepolia (11142220)  -  Alfajores (44787) / alfajores-forno.* hostnames are deprecated and often fail DNS.
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
# If you see 403 from forno, try: https://celo-sepolia.drpc.org
# NEXT_PUBLIC_SEPOLIA_RPC_URL=https://celo-sepolia.drpc.org
# Optional: server-only RPC for /api/rpc/celo-sepolia and scripts (overrides public for backend reads)
# CELO_SEPOLIA_RPC_URL=https://celo-sepolia.drpc.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://celo-sepolia.blockscout.com
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=CeloScan

# ============================================
# REQUIRED: Contract Addresses (Fill after deployment)
# ============================================
# Canonical names (use these):
NEXT_PUBLIC_SUBMISSION_CONTRACT=
NEXT_PUBLIC_IMPACT_PRODUCT_NFT=
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=
# Optional: legacy ERC-20 used only for external analytics (not RewardManager.dcuToken  -  removed). Prefer NEXT_PUBLIC_CDCU_TOKEN_ADDRESS for $cDCU balance.
NEXT_PUBLIC_DCU_TOKEN_CONTRACT=
# There is no NEXT_PUBLIC_RECYCLABLES_CONTRACT  -  recyclables data lives on Submission; DCU bucket is RewardManager.rewardRecyclables (optional owner hook Submission.recyclablesRewardContract is onchain only, not this env).
# $cDCU / ClaimVault  -  set address for testnet/mainnet deploy you are targeting
NEXT_PUBLIC_CLAIMVAULT_ADDRESS=
# Optional: cDCU token address (e.g. for balance in UI); else read ClaimVault.token()
# NEXT_PUBLIC_CDCU_TOKEN_ADDRESS=

# Note: Legacy variable names are supported for backwards compatibility:
# - NEXT_PUBLIC_IMPACT_PRODUCT_NFT_ADDRESS (use NEXT_PUBLIC_IMPACT_PRODUCT_NFT)
# - NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT (use NEXT_PUBLIC_IMPACT_PRODUCT_NFT)
# - NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS (use NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT)

# ============================================
# REQUIRED: IPFS (Pinata)
# ============================================
# Preferred (matches Pinata docs for pinFileToIPFS): JWT from API Keys page  -  long string starting with eyJ
PINATA_JWT=
#
# Legacy (if your account still uses key + secret pairs):
# PINATA_API_KEY=
# PINATA_SECRET_KEY=
# or PINATA_SECRET_API_KEY=
#
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/
#
# If you only have one long "API Key" starting with eyJ, put it in PINATA_JWT or PINATA_API_KEY (either works).
# INVALID_API_KEYS on VPS: copy the JWT into /var/www/decleanup/frontend/.env.local and pm2 restart decleanup --update-env

# ============================================
# REQUIRED: WalletConnect
# ============================================
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# ============================================
# REQUIRED (server + client): Supabase  -  verifier, hypercert requests, impact portfolios
# ============================================
# Dashboard → Project Settings → API. Use the SAME project on Vercel as you linked with `supabase link`.
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Server only  -  never expose to the client. Required for API routes that insert/update verifier + hypercert tables.
SUPABASE_SERVICE_ROLE_KEY=
# Legacy alias supported in some helpers:
# SUPABASE_SERVICE_KEY=

# ============================================
# OPTIONAL: Web3Auth Embedded Wallets (social / email login)
# ============================================
# When set, the app uses "Login with Email or Google" (wallet created in background) instead of RainbowKit.
# Get your Client ID from https://dashboard.web3auth.io/
# NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=
# Web3Auth *backend* network — use the same name as developer.metamask.io / dashboard.web3auth.io (NOT Celo mainnet):
# NEXT_PUBLIC_WEB3AUTH_NETWORK=sapphire_mainnet
# Default / omit = sapphire_devnet (Sapphire Devnet). Legacy aliases: mainnet → sapphire_mainnet, devnet → sapphire_devnet.
# Social login requires **Wallet Services**. Base plan: free on sapphire_devnet only; sapphire_mainnet needs Scale+ (403 on feature-access until upgraded).
# Your on-chain network is still set by NEXT_PUBLIC_CHAIN_ID (Celo Sepolia vs Celo Mainnet).

# ============================================
# OPTIONAL: Pimlico (gasless / Account Abstraction on Celo Sepolia)
# ============================================
# For paymaster-sponsored txs, get an API key from https://docs.pimlico.io/guides/create-api-key
# Celo Sepolia slug: celo-sepolia (chainId 11142220). Used by frontend/src/lib/blockchain/smart-account.ts
# NEXT_PUBLIC_PIMLICO_API_KEY=

# ============================================
# OPTIONAL: Disable onchain impact report + recyclables bonus tx (after Claim level)
# ============================================
# Default in code is ON (claim flow calls Submission.claimSubmissionBonusRewards). Set to 0 only if you must skip it.
# NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM=0

# ============================================
# OPTIONAL: Hypercerts (API key not required for basic minting)
# ============================================
# Note: The Hypercerts SDK works without an API key for minting.
# API key is only needed for advanced features like indexing/querying.
# Leave empty if you only need basic minting functionality.
NEXT_PUBLIC_HYPERCERTS_API_KEY=
NEXT_PUBLIC_HYPERCERTS_NETWORK=celo-sepolia
# Optional override for HypercertMinter UUPS (must match Hypercerts deployments for your chain).
# When NEXT_PUBLIC_CHAIN_ID=42220, frontend defaults to public Celo mainnet minter if unset  -  confirm on Hypercerts docs before prod.
# NEXT_PUBLIC_HYPERCERTS_MINTER_UUPS_ADDRESS=
# Relaxed mint gates: 1 verified cleanup + 1 impact report. Default OFF uses production gates (10 cleanups + 1 report).
# NEXT_PUBLIC_HYPERCERT_RELAXED_ELIGIBILITY=true

# ============================================
# OPTIONAL: Impact Product Metadata
# ============================================
NEXT_PUBLIC_IMPACT_IMAGES_CID=
NEXT_PUBLIC_IMPACT_METADATA_CID=

# ============================================
# REQUIRED for signed $cDCU (and airdrop claim API): ClaimVault backend signer
# ============================================
# Must match ClaimVault.authorizedSigner() on chain  -  verify: `cd frontend && npm run check:claimvault-signer`
CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY=
# Claim accounting (issued amounts, milestones, pending) is stored in Supabase table
# `cdcu_issued_store` (migration: frontend/supabase/migrations/20260513_create_cdcu_issued_store.sql).
# Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (already set for other features).
# CLAIM_VAULT_ISSUED_STORE_PATH below is the legacy JSON file fallback used only when Supabase
# is not configured (local dev). Vercel/serverless requires Supabase since /tmp is ephemeral.
# CLAIM_VAULT_ISSUED_STORE_PATH=./var/app/data/cdcu-issued.json
# Required for POST /api/cdcu/unlock (reset issued/pending so user can claim again in dev/staging)
# CLAIM_VAULT_UNLOCK_SECRET=

# ============================================
# OPTIONAL: Telegram alerts for new cleanup submissions (verifier channel)
# ============================================
# Create a bot via @BotFather, add it to a private verifier group, get chat id from getUpdates.
# Apply migration: frontend/supabase/migrations/20260514_telegram_submission_notifications.sql
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_VERIFIER_CHAT_ID=-100xxxxxxxxxx

# ============================================
# OPTIONAL: GPU / ML verification (VPS or trusted network  -  not localhost in production)
# ============================================
# ML_VERIFICATION_ENABLED=true
# GPU_INFERENCE_SERVICE_URL=https://your-vpn-or-vps/gpu
# GPU_INFERENCE_PATH=/infer
# GPU_SHARED_SECRET=
# PUBLIC_URL_BASE=https://your-app.vercel.app

# ============================================
# OPTIONAL: App Configuration
# ============================================
# Public origin of this deployment (WalletConnect metadata, OG URL). Production: https://dapp.decleanup.net
NEXT_PUBLIC_WEB_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=https://decleanup.network
# Optional: override RainbowKit / WalletConnect app icon (default: Pinata IPFS icon)
# NEXT_PUBLIC_APP_ICON_URL=

# ============================================
# OPTIONAL: External Services
# ============================================
NEXT_PUBLIC_BIGDATACLOUD_API_KEY=
```

## Where to Get API Keys

1. **Pinata**: https://app.pinata.cloud/developers/api-keys
2. **WalletConnect**: https://cloud.walletconnect.com/
3. **Hypercerts**: ⚠️ **NOT REQUIRED** - The SDK works without an API key for minting. 
   - API key is only needed for advanced features (indexing, querying via REST/GraphQL)
   - For basic minting: **Leave empty** - it will work fine
   - If you need advanced features: Check https://hypercerts.org/docs/developer/api or contact Hypercerts team
4. **BigDataCloud**: https://www.bigdatacloud.com/ (for leaderboard geocoding)
5. **Web3Auth** (optional): https://dashboard.web3auth.io/  -  create an app and copy the Client ID to `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` for email/Google login. See `docs/WEB3AUTH_SETUP.md`.
6. **Supabase**: https://supabase.com/dashboard  -  create a project, copy URL + anon + **service role** keys. Apply migrations from `frontend/supabase/migrations/` (`supabase link` then `supabase db push` or your CI). See `docs/MAINNET_3_DAY_EXECUTION_PLAN.md` for the migration checklist.
7. **ClaimVault signer**: Use a dedicated hot wallet; grant it `authorizedSigner` on the deployed ClaimVault. Never commit the private key; store only in `.env.local` / Vercel / VPS secrets.

