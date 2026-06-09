# Deployment checklist

## Mainnet (production — Vercel)

1. **`contracts/scripts/deployed_addresses.json`** — canonical Celo mainnet (`42220`) addresses.
2. **Vercel env** — copy from **`frontend/.env.example`**. Required:
   - `NEXT_PUBLIC_CHAIN_ID=42220`
   - `NEXT_PUBLIC_RPC_URL` (Celo mainnet RPC)
   - `NEXT_PUBLIC_SUBMISSION_CONTRACT`, `NEXT_PUBLIC_IMPACT_PRODUCT_NFT`, `NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT`
   - Pinata, WalletConnect, Supabase URL + service role
   - `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`
   - `IMPACT_SYNC_SECRET` (impact feed)
3. **Redeploy** after any `NEXT_PUBLIC_*` change (values are baked at build time).
4. **Supabase** — `supabase db push` or apply migrations in `frontend/supabase/migrations/`.
5. **Tests** — `cd contracts && npx hardhat test`; `cd frontend && npm run build`.
6. **Smoke** — connect wallet, submit cleanup, verifier approve, claim Impact Product, `$cDCU` claim, impact feed sync:
   ```bash
   curl -X POST "https://dapp.decleanup.net/api/impact/sync" -H "x-impact-sync-secret: YOUR_SECRET"
   curl "https://dapp.decleanup.net/api/impact/cleanups?limit=5"
   ```

## VPS (optional — ML + uploads)

When moving ML or `UPLOAD_DIR` off Vercel, see **`docs/VPS_DEPLOYMENT.md`** and **`docs/VPS_SECURITY_PROTOCOL.md`**.

Enable ML: `ML_VERIFICATION_ENABLED=true` + GPU service env → **`docs/ML_VERIFICATION_ARCHITECTURE.md`**.

## Sepolia (development)

Set `NEXT_PUBLIC_CHAIN_ID=11142220` and Sepolia contract addresses. Use for local/staging only.

See **`docs/B_CDCU_ONLY_ARCHITECTURE.md`** and **`docs/system-architecture.md`**.
