# Secrets rotation runbook

Rotate on a schedule or immediately after exposure (terminal paste, leaked `.env`, former team member).

| Secret | Where | Action |
|--------|-------|--------|
| `IMPACT_SYNC_SECRET` | Vercel, VPS `.env.local` | `openssl rand -hex 32` → update env → redeploy |
| `GPU_SHARED_SECRET` | VPS frontend + `gpu-inference-service/.env.gpu` | New random string → restart `decleanup` + `decleanup-gpu` |
| `ML_PROXY_SHARED_SECRET` | Vercel + ML host | Match on both sides → redeploy both |
| `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY` | Vercel/VPS only | Deploy new signer wallet → `ClaimVault.setAuthorizedSigner` onchain → update env |
| `PINATA_JWT` | Vercel/VPS | Revoke old key in Pinata dashboard → new JWT → redeploy |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel/VPS | Supabase dashboard → rotate → update env |
| `TELEGRAM_BOT_TOKEN` | Vercel/VPS | @BotFather `/revoke` → new token |

## Dry run (non-production)

1. Generate new value locally; do not commit.
2. Update Preview/VPS staging env only.
3. Run smoke: impact sync, ML verify, $cDCU claim test wallet, Pinata upload.
4. Promote to Production during a maintenance window.

## After rotation

- [ ] Old secret revoked at provider (Pinata, Supabase, Telegram)
- [ ] Vercel Production redeployed
- [ ] VPS `pm2 restart decleanup --update-env` (and `decleanup-gpu` if GPU secret changed)
- [ ] Document rotation date in your ops log (not in git)
