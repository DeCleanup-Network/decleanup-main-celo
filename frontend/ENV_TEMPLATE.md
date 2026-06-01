# Environment Variables Template

Copy to **`frontend/.env.local`**. Next.js loads only this file for the app.

**Deploy docs:** `docs/deployment-plan.md` · **Mainnet addresses:** `../contracts/scripts/deployed_addresses.json` · **$cDCU:** `docs/B_CDCU_ONLY_ARCHITECTURE.md`

Put comments on their own lines (inline `#` after URLs can break RPC parsing).

---

## Production (Celo mainnet — copy this block for Vercel)

```bash
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://celoscan.io
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=CeloScan

# From contracts/scripts/deployed_addresses.json
NEXT_PUBLIC_SUBMISSION_CONTRACT=0x2f3654f0ad8117c41185c589dcd0ea22522fe5af
NEXT_PUBLIC_IMPACT_PRODUCT_NFT=0x97fa526fba91f01b5a4e0f25c71751e474cb6f45
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=0x1936270b066ebadedc2d84f4ce3b488729d1d638

NEXT_PUBLIC_HYPERCERTS_NETWORK=celo
NEXT_PUBLIC_WEB_APP_URL=https://dapp.decleanup.net
NEXT_PUBLIC_SITE_URL=https://dapp.decleanup.net
NEXT_PUBLIC_APP_URL=https://dapp.decleanup.net

# Auth.js embedded wallets (recommended)
NEXT_PUBLIC_AA_AUTH_ENABLED=true

# Atomic submit/claim (redeployed Submission + ImpactProductNFT)
NEXT_PUBLIC_ATOMIC_CONTRACT_TX=1
```

After changing any `NEXT_PUBLIC_*` on Vercel: **trigger a new deploy**.

---

## Full template (mainnet + optional services)

```bash
# ============================================
# Network
# ============================================
NEXT_PUBLIC_CHAIN_ID=42220
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://celoscan.io
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=CeloScan

# Sepolia (local/staging only)
# NEXT_PUBLIC_CHAIN_ID=11142220
# NEXT_PUBLIC_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
# NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://celo-sepolia.blockscout.com

# ============================================
# Contracts (mainnet — see deployed_addresses.json)
# ============================================
NEXT_PUBLIC_SUBMISSION_CONTRACT=
NEXT_PUBLIC_IMPACT_PRODUCT_NFT=
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=
NEXT_PUBLIC_CLAIMVAULT_ADDRESS=
# NEXT_PUBLIC_CDCU_TOKEN_ADDRESS=
# NEXT_PUBLIC_DCU_TOKEN_CONTRACT=   # optional analytics only

# ============================================
# IPFS (Pinata)
# ============================================
PINATA_JWT=
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# ============================================
# WalletConnect
# ============================================
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# ============================================
# Supabase (verifier, hypercerts, impact feed, airdrop)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# ============================================
# Auth.js + Account abstraction (Google / email login)
# ============================================
NEXT_PUBLIC_AA_AUTH_ENABLED=true
AUTH_SECRET=   # openssl rand -base64 32
DATABASE_URL=postgresql://...@...supabase.com:5432/postgres?sslmode=require
DIRECT_URL=postgresql://...@...supabase.com:5432/postgres?sslmode=require
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Magic link email (optional — if unset, login page hides "Continue with Email")
# Resend example:
# EMAIL_SERVER=smtp://resend:re_YOUR_API_KEY@smtp.resend.com:587
# EMAIL_FROM=DeCleanup <onboarding@resend.dev>
# NEXT_PUBLIC_PIMLICO_API_KEY=

# ============================================
# ClaimVault signer (server only)
# ============================================
CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY=
# Mainnet: ClaimVault deploy block (fast airdrop / $cDCU log checks; without it mainnet scans from block 0 ~40s)
# CDCU_CLAIM_LOGS_FROM_BLOCK=
# CLAIM_VAULT_UNLOCK_SECRET=

# ============================================
# Impact feed (landing page API)
# ============================================
# Apply: frontend/supabase/migrations/20260530_create_cleanup_feed.sql
IMPACT_SYNC_SECRET=
# Do not set unless backfilling old contract submissions:
# IMPACT_FEED_LEGACY_SUBMISSION_CONTRACT=

# ============================================
# ML verification (VPS / ml host — off on Vercel by default)
# ============================================
# ML_VERIFICATION_ENABLED=true
# GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000
# GPU_SHARED_SECRET=
# UPLOAD_DIR=/var/www/decleanup/uploads
# PUBLIC_URL_BASE=https://dapp.decleanup.net

# Vercel UI + VPS ML split:
# ML_BACKEND_ORIGIN=https://ml.decleanup.net
# ML_PROXY_SHARED_SECRET=

# ============================================
# Hypercerts
# ============================================
NEXT_PUBLIC_HYPERCERTS_NETWORK=celo
# NEXT_PUBLIC_HYPERCERTS_MINTER_UUPS_ADDRESS=

# ============================================
# Telegram (optional verifier alerts)
# ============================================
# TELEGRAM_BOT_TOKEN=
# TELEGRAM_VERIFIER_CHAT_ID=

# ============================================
# App URLs
# ============================================
NEXT_PUBLIC_WEB_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=https://decleanup.net

# ============================================
# Optional
# ============================================
NEXT_PUBLIC_ENABLE_SUBMISSION_BONUS_CLAIM=1
NEXT_PUBLIC_ATOMIC_CONTRACT_TX=1
NEXT_PUBLIC_BIGDATACLOUD_API_KEY=
NEXT_PUBLIC_IMPACT_IMAGES_CID=
NEXT_PUBLIC_IMPACT_METADATA_CID=
```

## Where to get keys

1. **Pinata** — https://app.pinata.cloud/developers/api-keys  
2. **WalletConnect** — https://cloud.walletconnect.com/  
3. **Supabase** — apply `frontend/supabase/migrations/`  
4. **ClaimVault signer** — dedicated hot wallet; `npm run check:claimvault-signer`  
5. **ML / VPS** — `docs/VPS_DEPLOYMENT.md`

Hypercerts SDK minting works without `NEXT_PUBLIC_HYPERCERTS_API_KEY`.
