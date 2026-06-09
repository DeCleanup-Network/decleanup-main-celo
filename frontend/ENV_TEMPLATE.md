# Environment Variables Template

**Canonical copy-paste file:** **`frontend/.env.example`** — hand this to new devs; copy to `frontend/.env.local`.

Structure: **MUST HAVE** (wallet + submit flow) first, then **OPTIONAL — * flow** blocks (embedded login, claims, Supabase, ML, etc.).

Next.js loads **`.env.local`** only for the app. This markdown file adds setup notes and production blocks.

**Deploy docs:** `docs/deployment-plan.md` · **Mainnet addresses:** `../contracts/scripts/deployed_addresses.json` · **$cDCU:** `docs/B_CDCU_ONLY_ARCHITECTURE.md` · **Contracts deploy:** `../contracts/.env.example`

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
NEXT_PUBLIC_CDCU_TOKEN_ADDRESS=0x34d66e9552e9dc23a24eca13bb1f8f71f4b9bfc1
NEXT_PUBLIC_CLAIMVAULT_ADDRESS=0x4f69a1170c8799b5bc1587275b2e7da5a8406ff0

NEXT_PUBLIC_HYPERCERTS_NETWORK=celo
NEXT_PUBLIC_WEB_APP_URL=https://dapp.decleanup.net
NEXT_PUBLIC_SITE_URL=https://dapp.decleanup.net
NEXT_PUBLIC_APP_URL=https://dapp.decleanup.net

# Google Search Console (HTML tag verification). Set in Vercel only; redeploy after adding.
# GOOGLE_SITE_VERIFICATION=your_google_verification_token
# Face ID / Touch ID (optional; derived from APP_URL if unset)
# NEXT_PUBLIC_WEBAUTHN_RP_ID=dapp.decleanup.net
# NEXT_PUBLIC_WEBAUTHN_ORIGIN=https://dapp.decleanup.net

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
# Preferred: Resend HTTP API (create key at https://resend.com/api-keys)
RESEND_API_KEY=re_YOUR_API_KEY
EMAIL_FROM=DeCleanup <onboarding@resend.dev>
# Production: verify domain in Resend, then e.g. EMAIL_FROM=DeCleanup <noreply@dapp.decleanup.net>
# AUTH_URL must match your public site (Vercel Production):
# AUTH_URL=https://dapp.decleanup.net
# Legacy SMTP (only if you do not use RESEND_API_KEY):
# EMAIL_SERVER=smtp://resend:re_YOUR_API_KEY@smtp.resend.com:587
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
#         frontend/supabase/migrations/20260603_cleanup_feed_place_name.sql
IMPACT_SYNC_SECRET=
# Reverse geocoding for feed (OpenStreetMap Nominatim, ~1 req/s during sync). Default on.
# IMPACT_REVERSE_GEOCODING_ENABLED=false
# NOMINATIM_USER_AGENT=DeCleanupRewards/1.0 (https://dapp.decleanup.net; contact: you@example.com)
# NOMINATIM_ACCEPT_LANGUAGE=en
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
