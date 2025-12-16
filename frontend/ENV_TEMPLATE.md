# Environment Variables Template

Copy this to `.env.local` in the `frontend/` directory and fill in your values.

```bash
# ============================================
# REQUIRED: Network Configuration
# ============================================
NEXT_PUBLIC_CHAIN_ID=11142220
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
NEXT_PUBLIC_TESTNET_RPC_URL=https://alfajores-forno.celo-testnet.org
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://forno.celo-sepolia.celo-testnet.org
NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://alfajores.celoscan.io
NEXT_PUBLIC_BLOCK_EXPLORER_NAME=CeloScan

# ============================================
# REQUIRED: Contract Addresses (Fill after deployment)
# ============================================
# Canonical names (use these):
NEXT_PUBLIC_SUBMISSION_CONTRACT=
NEXT_PUBLIC_VERIFICATION_CONTRACT=
NEXT_PUBLIC_IMPACT_PRODUCT_NFT=
NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT=
NEXT_PUBLIC_DCU_TOKEN_CONTRACT=
NEXT_PUBLIC_RECYCLABLES_CONTRACT=

# Note: Legacy variable names are supported for backwards compatibility:
# - NEXT_PUBLIC_VERIFICATION_CONTRACT_ADDRESS (use NEXT_PUBLIC_VERIFICATION_CONTRACT)
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
# OPTIONAL: Hypercerts (API key not required for basic minting)
# ============================================
# Note: The Hypercerts SDK works without an API key for minting.
# API key is only needed for advanced features like indexing/querying.
# Leave empty if you only need basic minting functionality.
NEXT_PUBLIC_HYPERCERTS_API_KEY=
NEXT_PUBLIC_HYPERCERTS_NETWORK=celo-sepolia

# ============================================
# OPTIONAL: Impact Product Metadata
# ============================================
NEXT_PUBLIC_IMPACT_IMAGES_CID=
NEXT_PUBLIC_IMPACT_METADATA_CID=

# ============================================
# OPTIONAL: App Configuration
# ============================================
NEXT_PUBLIC_MINIAPP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=https://decleanup.network

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

