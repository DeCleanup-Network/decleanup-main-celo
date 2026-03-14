# Design / Frontend: What’s Safe vs Not Safe to Change

**Logo:** To match [decleanup.net](https://www.decleanup.net), you can use the same logo from the landing repo: [DeCleanup-Network/decleanup-network.github.io](https://github.com/DeCleanup-Network/decleanup-network.github.io) — copy `public/images/decleanup_logo_full.png` (or the main logo from `public/`) into this app’s `frontend/public/` and point the Header to it (e.g. `/images/decleanup_logo_full.png` or replace `logo.png`).

You want to bring the app closer to the [decleanup.net](https://www.decleanup.net) landing look. Below is what’s **safe** to change (design only) vs **not safe** (logic/APIs the dev is still working on).

---

## Safe to change (design only)

You can freely restyle these. Stick to **CSS, layout, typography, colors, spacing, copy** — no change to **data flow, API calls, or form submit logic**.

### Global

- **`frontend/src/app/layout.tsx`** — Fonts, `className` on `<html>`/`<body>`, theme color in viewport. Don’t remove `Providers`, `NetworkChecker`, or `Header`.
- **`frontend/src/app/globals.css`** — All of it: `@theme`, `:root`, `.dark`, brand colors (`--color-brand-green`, `--color-brand-yellow`), radii, any new utility classes. This is the main lever for decleanup.net-style look.
- **`frontend/tailwind.config`** (if present) or Tailwind usage — Extend colors/fonts to match landing; keep existing class names if they’re used in logic.

### Shell / layout (visual only)

- **`frontend/src/components/layout/Header.tsx`** — Layout, logo size, tagline, border/background, spacing. Don’t remove or rewire `WalletConnect` or the `Link` to `/`.
- **`frontend/src/components/layout/Navigation.tsx`** — Styling of nav items. Don’t change **which** links are shown (e.g. verifier link gated by `useIsVerifier`) or their `href`s.
- **`frontend/src/components/layout/BottomNav.tsx`** — Same: styling and order only; don’t change visibility logic or routes.
- **`frontend/src/components/layout/Footer.tsx`** — Full restyle; no backend dependency.

### Pages (styling and static structure only)

- **`frontend/src/app/page.tsx`** — Dashboard: card layout, typography, colors, spacing, section order (as long as you don’t remove or rename components that hold state or call contracts). Don’t change: `useIsVerifier`, `getUserRewardStats`, `claimImpactProductFromVerification`, `mintHypercert`, or any `onClick`/submit handlers.
- **`frontend/src/app/leaderboard/page.tsx`** — Pure styling.
- **`frontend/src/app/share/page.tsx`** — Styling and copy.
- **`frontend/src/app/staking/page.tsx`** — Styling and “Coming soon” copy; no API/contract logic.
- **`frontend/src/app/hypercerts/page.tsx`** — Layout, cards, buttons **appearance** only. Don’t change: `submitHypercertRequest`, `getHypercertRequestsByUser`, `updateRequestWithHypercertId`, `handleMintApprovedRequest`, or any call to `mintHypercert` / requests API.
- **`frontend/src/features/cleanup/pages/page.tsx`** — Styling of the cleanup flow. Don’t change: submit handlers, IPFS upload, contract calls, or verification state logic.

### Components (visual only)

- **`frontend/src/components/dashboard/DashboardImpactProduct.tsx`** — Styling only; don’t change claim/upgrade logic or contract calls.
- **`frontend/src/components/dashboard/DashboardActions.tsx`** — Styling only; don’t change what each action does.
- **`frontend/src/components/dashboard/DashboardPersonalStats.tsx`** — Styling and copy only.
- **`frontend/src/components/ui/*`** — Buttons, inputs, cards: safe to restyle (classes, variants). Don’t change component props/API that might break forms.
- **`frontend/src/features/wallet/components/WalletConnect.tsx`** — Styling of the button/modal only; don’t change connect/disconnect logic.

### Copy and assets

- Any **text** on dashboard, landing sections, staking, leaderboard, share — safe to rewrite to match decleanup.net tone.
- **Images**: logo, icons, OG image — safe to replace for design.
- **Metadata** in `layout.tsx` (title, description, OG) — safe to align with landing/marketing.

---

## Not safe to change right now

Avoid **logic, API calls, or structure** in these until the dev has finished the verifier flow and backend.

### Verifier flow (dev is fixing this)

- **`frontend/src/app/verifier/page.tsx`** — Don’t change: auth/signature flow, loading of pending cleanups, approve/reject **handlers**, or any call that checks role / submits to backend. Restyling the **layout and static text** is OK.
- **`frontend/src/features/verifier/pages/page.tsx`** — Same: no change to apply/review logic, Supabase calls, or role checks. Styling only.
- **`frontend/src/components/dashboard/VerifierApplyCard.tsx`** — Don’t change: eligibility check, apply flow, or API calls. Styling only.
- **`frontend/src/app/api/verifier/apply/route.ts`** — Do not touch.
- **`frontend/src/app/api/verifier/review/route.ts`** — Do not touch.
- **`frontend/src/app/api/verifier/applications/route.ts`** — Do not touch.
- **`frontend/src/hooks/useVerifierEligibility.ts`** — Do not touch.
- **`frontend/src/hooks/useIsVerifier.ts`** — Do not touch (used for nav/verifier gating).
- **`frontend/src/lib/verifier/*`** — Do not touch.
- **`frontend/src/lib/supabase/*`** — Do not touch (used by verifier flow).
- **`frontend/src/lib/validation/verifier-schemas.ts`** — Do not touch.
- **`frontend/src/config/verifier.ts`** — Do not touch.

### Other API routes (risky to change)

- **`frontend/src/app/api/ml-verification/verify/route.ts`** — Leave as is unless you only change logging/copy.
- **`frontend/src/app/api/impact/*`** — Used for impact data; don’t change request/response shape.
- **`frontend/src/app/api/ipfs/upload/route.ts`** — Used by cleanup/hypercerts; don’t change upload logic.

### Blockchain / data flow

- **`frontend/src/lib/blockchain/*`** — No changes to contract calls, wagmi config, or hypercerts mint/request logic. Design-only changes in **pages** that call these are fine (see above).

---

## Summary

| Area | Safe | Not safe |
|------|------|----------|
| **globals.css, layout.tsx (fonts/theme)** | ✅ Full restyle | ❌ Removing Providers / structure |
| **Header, Footer, Nav (visual)** | ✅ Styling, copy | ❌ Changing links/visibility logic |
| **Dashboard (page.tsx)** | ✅ Layout, typography, colors | ❌ Handlers, useIsVerifier, contract hooks |
| **Hypercerts / cleanup pages** | ✅ Look and feel | ❌ Submit handlers, requests, mint |
| **Verifier pages & VerifierApplyCard** | ✅ Styling only | ❌ Auth, approve/reject, APIs, Supabase |
| **API routes** | ❌ | ❌ Don’t touch verifier/impact/ml routes |
| **Supabase / verifier libs** | ❌ | ❌ Don’t touch |

**Rule of thumb:** Change **classes, CSS, copy, and layout**. Don’t change **event handlers, API routes, hooks that fetch or submit, or conditions that show/hide verifier or apply flows**. That way the app will look like decleanup.net without breaking the flows the dev is still fixing.
