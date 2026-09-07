---
name: social-login-auth-strategy
description: >-
  Guides choice of social login and auth (Web2/Web3) and account abstraction.
  Use when implementing login, email/social auth, wallet-in-background, MPC, or
  reducing cost for nonprofit/small-scale apps.
---

# Social Login & Auth Strategy

Use this skill when choosing or implementing social logins, email login, account abstraction (AA), or wallet-in-background flows—especially for cost-sensitive or nonprofit projects.

---

## 1. Is Privy Overpriced?

Privy is strong for onboarding but has real cost barriers:

- **Free tier**: ~100k transactions; beyond ~1,000 active users, SMS and social verification costs grow.
- **Feature gating**: Custom branding, compliance, high-scale social logins often require paid plans (e.g. from ~$69/month).
- **Usage fees**: After free limits, extra transactions can be ~$0.005 each and add up for active apps.

---

## 2. Provider Comparison

| Provider        | Free Tier (MAU) | Best For              | Differentiators                                              |
|----------------|------------------|------------------------|--------------------------------------------------------------|
| Supabase Auth  | 50,000           | Scaling & fullstack    | Unlimited social providers; open-source; DB integration.     |
| Firebase Auth  | 50,000           | Speed (Web2)          | Mature; 10+ social providers.                                |
| Clerk          | 10,000           | UI/UX                 | Pre-built React/Next.js UI; very fast to implement.          |
| Web3Auth       | 1,000–10,000     | Web3 / crypto         | Social → MPC wallets; multi-chain (Celo, Solana, EVM).       |
| Auth0          | 7,000            | B2B / enterprise      | Very secure; free plan often limited to 2 social providers.  |

---

## 3. Best Option for Web3: Web3Auth

For Web3 (dApps, wallets, on-chain actions):

- **MPC & AA**: Multi-Party Computation and Account Abstraction; “seedless” experience; wallet created in background from Google/X (and often email).
- **Cost**: Generally more predictable and affordable to scale than Privy (e.g. MAW-based pricing).
- **Integration**: Works with Celo (EVM), MetaMask, Farcaster, etc. Note: Web3Auth Plug and Play is now under **MetaMask Embedded Wallet** branding; Celo is supported via EVM docs.

**Alternatives**: Dynamic, Particle Network—often higher cost than Web3Auth for similar features.

---

## 4. Best Solution for Nonprofits: AA + Email/Social (Wallet in Back)

**Goal**: Account abstraction + at least email login (wallet at the back), low cost at the start of your nonprofit journey.

### Recommended approach

1. **Primary: Web3Auth (or MetaMask Embedded Wallet)**  
   - **Why**: Social + email login with MPC/AA; wallet created in background; no seed phrase for users; pricing scales with MAW and is usually cheaper than Privy at similar scale.  
   - **What you get**: Google, X, email, etc. → one-click login; backend wallet for signing and paying gas (with AA, you can sponsor gas).  
   - **Cost**: Free tier in the 1k–10k MAW range; stay on free tier until you have real traction.  
   - **Celo**: Use EVM integration (Celo is EVM-compatible); chain config for Celo Mainnet / Sepolia as in your app.

2. **Optional: Supabase Auth for “Web2-only” users**  
   - Use if you want a pure email/social login path without any wallet for some users (e.g. newsletter, waitlist).  
   - 50k MAU free; no wallet, no gas; add Web3Auth only for users who need to transact.

3. **Avoid at the start**  
   - **Privy** for heavy social/SMS at scale (cost).  
   - **Self-hosted** (Passport.js, SuperTokens) unless you need full control—managed services ship faster.

### Quick start (conceptual)

1. Create an app in Web3Auth (or MetaMask Embedded Wallet) dashboard.  
2. Get OAuth Client IDs (e.g. Google) and configure email/social.  
3. Add the React/JS SDK; wrap your app so “Login with Google/Email” creates or restores the embedded wallet.  
4. Use the same wallet with your existing wagmi/RainbowKit stack (e.g. via custom connector or provider) so verifier flows and DCU logic stay unchanged.  
5. For AA/gas sponsorship: use Web3Auth’s AA support or a paymaster (e.g. Pimlico, Biconomy, or Celo-native options) so users don’t need CELO for gas early on.

### Cost summary (nonprofit start)

- **Web3Auth / Embedded Wallet**: Free tier for early MAW; no big upfront.  
- **Supabase (if used)**: 50k MAU free.  
- **Paymaster/AA**: Often free or low-cost tiers for limited volume; scale when you have usage.

---

## 5. When to Use What

- **Web3 (dApp, wallets, on-chain)**: Prefer **Web3Auth** (or MetaMask Embedded Wallet); secondary: Dynamic or Particle if you need their specific features.  
- **Web2 / general**: Prefer **Supabase** (scale for free to 50k); secondary: **Clerk** if you want a pre-made login UI and minimal CSS.

---

## 6. Developer Quick Start

1. Create app in the provider dashboard.  
2. Get Client IDs from Google (or other) Developer Console.  
3. Paste credentials into the provider dashboard and integrate their React/JS SDK.  

Avoid self-hosting unless you explicitly need full control; managed services are faster to ship.
