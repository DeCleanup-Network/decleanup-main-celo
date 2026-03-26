# Environment Variables Template

Copy this to **`.env.local`** in the **`frontend/`** directory and fill in your values.

**$cDCU and deploy:** For a single list of what to add and **which env file** (frontend vs root), see **`docs/ENV_CDCU_AND_DEPLOY.md`**.

```bash
# ============================================
# REQUIRED: Network Configuration
# ============================================
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_TESTNET_RPC_URL=https://alfajores-forno.celo-testnet.org
# If you see 403 from forno, use an alternative (e.g. dRPC):
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
# NEXT_PUBLIC_SEPOLIA_RPC_URL=https://celo-sepolia.drpc.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://alfajores.celoscan.io
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=CeloScan

# ============================================
# REQUIRED: Contract Addresses (Fill after deployment)
# ============================================
# Canonical names (use these):
NEXT_PUBLIC_SUBMISSION_CONTRACT=
NEXT_PUBLIC_IMPACT_PRODUCT_NFT=
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=
# Optional: app derives DCU token from RewardManager.dcuToken() if unset
NEXT_PUBLIC_DCU_TOKEN_CONTRACT=
# $cDCU / ClaimVault (Phase 2)
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
PINATA_API_KEY=
PINATA_SECRET_KEY=
NEXT_PUBLIC_IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# ============================================
# REQUIRED: WalletConnect
# ============================================
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# ============================================
# OPTIONAL: Web3Auth Embedded Wallets (social / email login)
# ============================================
# When set, the app uses "Login with Email or Google" (wallet created in background) instead of RainbowKit.
# Get your Client ID from https://dashboard.web3auth.io/
# NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=
# Optional: ONLY if your Web3Auth Dashboard project uses Sapphire Mainnet (must match — else 400 / Network mismatch)
# Default / omit = Sapphire Devnet (typical for most projects)
# NEXT_PUBLIC_WEB3AUTH_NETWORK=mainnet
# Note: "Sapphire" is Web3Auth's backend network; your app chain is already Celo Sepolia (chains in code).

# ============================================
# OPTIONAL: Pimlico (gasless / Account Abstraction on Celo Sepolia)
# ============================================
# For paymaster-sponsored txs, get an API key from https://docs.pimlico.io/guides/create-api-key
# Celo Sepolia slug: celo-sepolia (chainId 11142220). Used by frontend/src/lib/blockchain/smart-account.ts
# NEXT_PUBLIC_PIMLICO_API_KEY=

# ============================================
# OPTIONAL: Hypercerts (API key not required for basic minting)
# ============================================
# Note: The Hypercerts SDK works without an API key for minting.
# API key is only needed for advanced features like indexing/querying.
# Leave empty if you only need basic minting functionality.
NEXT_PUBLIC_HYPERCERTS_API_KEY=
NEXT_PUBLIC_HYPERCERTS_NETWORK=celo-sepolia
# Relaxed mint gates: 1 verified cleanup + 1 impact report. Default OFF uses production gates (10 cleanups + 1 report).
# NEXT_PUBLIC_HYPERCERT_RELAXED_ELIGIBILITY=true

# ============================================
# OPTIONAL: Impact Product Metadata
# ============================================
NEXT_PUBLIC_IMPACT_IMAGES_CID=
NEXT_PUBLIC_IMPACT_METADATA_CID=

# ============================================
# OPTIONAL: $cDCU Claim Backend (Phase 2)
# ============================================
# Required for POST /api/cdcu/claim-request (signed claim issuance)
# CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY=0x...   # Backend wallet (never expose to client)
# CLAIM_VAULT_ISSUED_STORE_PATH=./data/cdcu-issued.json  # File path to track issued amounts per recipient (MVP)
# CLAIM_VAULT_UNLOCK_SECRET=your-secret  # Required for POST /api/cdcu/unlock (reset issued/pending so user can claim again)

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
5. **Web3Auth** (optional): https://dashboard.web3auth.io/ — create an app and copy the Client ID to `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` for email/Google login. See `docs/WEB3AUTH_SETUP.md`.

