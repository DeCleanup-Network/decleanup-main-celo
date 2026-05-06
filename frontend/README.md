# DeCleanup frontend (Next.js)

Next.js app for the DeCleanup dashboard: cleanups, verifier tools, Impact Products, **DCU** ledger stats, **`$cDCU`** claims via ClaimVault, Hypercerts, and related APIs.

## Quick start

```bash
npm install
cp ENV_TEMPLATE.md .env.local   # then fill values
npm run dev
```

## Configuration

See **`ENV_TEMPLATE.md`** for all `NEXT_PUBLIC_*` and server keys. Contract addresses must match **`../contracts/scripts/deployed_addresses.json`**.

## Documentation

- **Repo overview:** [`../README.md`](../README.md)
- **Architecture:** [`../docs/system-architecture.md`](../docs/system-architecture.md)
- **`$cDCU` / ClaimVault:** [`../docs/B_CDCU_ONLY_ARCHITECTURE.md`](../docs/B_CDCU_ONLY_ARCHITECTURE.md)
- **Hypercerts:** [`../docs/HYPERCERTS.md`](../docs/HYPERCERTS.md)

## Scripts

- `npm run dev` - local development
- `npm run build` - production build
- `npm run lint` - ESLint
