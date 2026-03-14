# Environment variables for Vercel

Add these in **Vercel → Project → Settings → Environment Variables**. Use **Production**, **Preview**, and **Development** as needed (at least Production).

**Sensitive values:** Add as **Sensitive** (encrypted) in Vercel: `PINATA_API_KEY`, `PINATA_SECRET_KEY`, `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`.

**More context:** See **`docs/ENV_AND_ROLES_FAQ.md`** for DCU vs cDCU, recyclables, signer vs deployer, admin/treasury, and SITE_URL vs APP_URL.

---

## Required (app + contracts + wallet)

| Variable | Example / note | Sensitive |
|----------|----------------|-----------|
| `NEXT_PUBLIC_CHAIN_ID` | `42220` (Celo mainnet) or `11142220` (Sepolia) | No |
| `NEXT_PUBLIC_RPC_URL` | `https://forno.celo.org` | No |
| `NEXT_PUBLIC_SEPOLIA_RPC_URL` | `https://forno.celo-sepolia.celo-testnet.org` | No |
| `NEXT_PUBLIC_SUBMISSION_CONTRACT` | `0x...` | No |
| `NEXT_PUBLIC_IMPACT_PRODUCT_NFT` | `0x...` | No |
| `NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT` | `0x...` | No |
| `PINATA_API_KEY` | From Pinata | **Yes** |
| `PINATA_SECRET_KEY` | From Pinata | **Yes** |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | From WalletConnect Cloud | No |

---

## Required for $cDCU claim flow

| Variable | Example / note | Sensitive |
|----------|----------------|-----------|
| `NEXT_PUBLIC_CLAIMVAULT_ADDRESS` | ClaimVault contract address (from deploy) | No |
| `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY` | `0x...` backend wallet key for signing claims | **Yes** |

---

## Optional but recommended

| Variable | Example / note | Sensitive |
|----------|----------------|-----------|
| `NEXT_PUBLIC_BLOCK_EXPLORER_URL` | `https://celoscan.io` or Sepolia explorer | No |
| `NEXT_PUBLIC_IPFS_GATEWAY` | `https://gateway.pinata.cloud/ipfs/` | No |
| `CLAIM_VAULT_ISSUED_STORE_PATH` | Omit on Vercel (serverless: use default or Vercel Blob later) | No |
| `NEXT_PUBLIC_SITE_URL` | This deployment URL (meta tags, share links) | No |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (e.g. `https://decleanup.network`) | No |

---

## Optional (other features)

| Variable | Note | Sensitive |
|----------|------|-----------|
| `NEXT_PUBLIC_DCU_TOKEN_CONTRACT` | DCU token address; app can derive from RewardManager.dcuToken() | No |
| `NEXT_PUBLIC_CDCU_TOKEN_ADDRESS` | cDCU token address (e.g. for balance in UI); else read ClaimVault.token() | No |
| `NEXT_PUBLIC_HYPERCERTS_API_KEY` | Only for advanced Hypercerts features | Yes |
| `NEXT_PUBLIC_HYPERCERTS_NETWORK` | e.g. `celo-sepolia` | No |
| `NEXT_PUBLIC_IMPACT_IMAGES_CID` | IPFS CID for impact images | No |
| `NEXT_PUBLIC_IMPACT_METADATA_CID` | IPFS CID for impact metadata | No |
| `NEXT_PUBLIC_MINIAPP_URL` | Miniapp URL if used | No |
| `NEXT_PUBLIC_BIGDATACLOUD_API_KEY` | Leaderboard geocoding | Yes |

---

## Vercel-specific notes

1. **No `NEXT_PUBLIC_` prefix** = server-only (never sent to the browser). In Vercel these still need to be set for API routes.
2. **Issued store file:** On Vercel the filesystem is read-only except at build time. The default path `process.cwd() + '/data/cdcu-issued.json'` will not persist across serverless invocations. For production you can either leave `CLAIM_VAULT_ISSUED_STORE_PATH` unset (in-memory per invocation, so **no persistence**) or later use Vercel Blob / a DB and point the code to that. For MVP, if you need persistence, run the API on a Node server (e.g. separate deployment) or add Vercel Blob and update the store to use it.
3. **Redeploy** after adding or changing variables so the new build picks them up.
