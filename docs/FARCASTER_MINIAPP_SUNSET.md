# Farcaster Mini App sunset

**Status:** The unified product is `dapp.decleanup.net`. This repo does **not** ship a Farcaster or Base Mini App (no `farcaster.json`, no Frames, no Mini App SDK).

The live Mini App is a **separate repo and hostname**. Unlisting it on Farcaster is not a code change here.

## What still publishes the Mini App

| Surface | Link | Action |
|---------|------|--------|
| Warpcast listing | https://farcaster.xyz/miniapps/SfsGBDcHpuSA/decleanup-rewards | Remove / unpublish in Warpcast developer settings |
| Host | https://miniapp.decleanup.net | Take DNS + Vercel project offline after unlisting |
| Repo (not archived) | https://github.com/DeCleanup-Network/Farcaster-Mini-App | Archive repo; point README at `https://dapp.decleanup.net` |
| Manifest | https://github.com/DeCleanup-Network/Farcaster-Mini-App/blob/main/public/.well-known/farcaster.json | Dies when the host is down |
| Manifest route | https://github.com/DeCleanup-Network/Farcaster-Mini-App/blob/main/app/.well-known/farcaster.json/route.ts | Same |
| Base Mini App setup | https://github.com/DeCleanup-Network/Farcaster-Mini-App/blob/main/docs/base-miniapp-setup.md | Archive with the repo |

Do **not** pause Base contracts. `$bDCU` and the Base cleanup contracts stay live for the dApp.

## Keep in this dApp (not the Mini App)

Social Farcaster is a share/profile link, not an install path:

- Footer: `frontend/src/components/layout/SiteFooterLinks.tsx`
- Share helpers: `frontend/src/lib/utils/sharing.ts`
- Impact profile field: `frontend/src/lib/impact/portfolio-profile.ts`
- Token spec social JSON: `docs/TOKEN_SPEC.md`

## Related docs in this repo

- [BASE_TO_DAPP_DEV_BRIEF.md](./BASE_TO_DAPP_DEV_BRIEF.md) — dual-chain plan; Workstream D is this sunset
- [DESIGN_SYSTEM_BASE_MINIAPP_PROMPT.md](./DESIGN_SYSTEM_BASE_MINIAPP_PROMPT.md) — archived prompt
- [CHANGELOG_MULTI_CHAIN.md](../CHANGELOG_MULTI_CHAIN.md) — Base-in-dApp work log
