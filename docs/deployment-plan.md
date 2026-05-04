# Deployment checklist

1. **`contracts/scripts/deployed_addresses.json`** - canonical addresses after deploy.
2. **`frontend/.env.local`** - from **`frontend/ENV_TEMPLATE.md`**; paste all `NEXT_PUBLIC_*` contract addresses from the JSON.
3. **ClaimVault signer** - `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY` on the server; public address matches vault’s authorized signer.
4. **Tests** - `cd contracts && npx hardhat test`; `cd frontend && npm run build`.
5. **Smoke** - connect wallet, submit cleanup, verifier flow, Impact Product claim, `$cDCU` claim when eligible, Hypercert mint if configured.

See **`docs/B_CDCU_ONLY_ARCHITECTURE.md`** and **`docs/system-architecture.md`**.
