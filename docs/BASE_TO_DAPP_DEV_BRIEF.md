# Developer brief: Base → dapp.decleanup.net (post–Farcaster Mini App)

**Audience:** Protocol / frontend / contracts developer on `decleanup-main-celo`  
**Status:** Implementation plan if / when the governance proposal passes  
**Product decision:** Wind down Farcaster Mini App. Keep Base as a **simple** chain inside `dapp.decleanup.net` alongside Celo (deeper participation + Gardens governance). `$bDCU` → `$cDCU` conversion on request so Base users can join governance when ready.

---

## 1. Product model (what to build)

| Mode | Chain | User journey | Token |
|------|-------|--------------|-------|
| **Simple** | Base (8453) | Sign in → submit cleanup → verify → claim → earn `$bDCU` | `$bDCU` liquid on Base; Impact Product levels stay on Base |
| **Deep** | Celo (42220) | Full dApp today: AA, DCU ledger, Hypercerts, Gardens / `$cDCU` governance | `$cDCU` |

**Bridge UX (not a silent cross-chain transfer of the same token):**  
Base user opens a **Convert `$bDCU` → `$cDCU`** interface on the dApp. Backend (+ ClaimVault-style EIP-712) mints `$cDCU` from their current `$bDCU` balance × published ratio. Track converted amount per wallet so they cannot double-claim. Levels/NFTs remain on Base.

**If the vote fails:** Base support is discontinued; remaining `$bDCU` distributed 10% core team / 50% `$bDCU` holders / 40% verified `$cDCU` holders (separate ops runbook — do not start that path unless the vote fails).

---

## 2. Workstreams & tasks

### A. Chain selection & app shell (frontend)

1. **Chain picker at entry** (after Auth.js / wallet connect): “Base — simple cleanup” vs “Celo — full participation & governance”. Persist choice (`localStorage` + optional user preference in DB).
2. **Make wagmi / AA config multi-chain:** today `REQUIRED_CHAIN_ID` is single-chain. Introduce `activeChainId` (Base | Celo) and resolve RPC, Pimlico slug, contract addresses from maps — not one global constant.
3. **Base “simple” route group:** e.g. `/base` or feature flag that hides Hypercerts, Gardens deep links, staking/advanced panels; keep submit → verify → claim → token only.
4. **Celo path unchanged** as default “deep” experience (current home/cleanup/profile/governance).
5. **Shared login:** one Auth.js session; chain choice only affects which contracts / paymaster / RPC are used.

### B. Contracts & addresses (Base)

1. Inventory **existing Base Mini App deployments** (Submission / RewardManager / ImpactProductNFT / ClaimVault / `$bDCU` token). Document every address in:
   - `contracts/scripts/deployed_addresses.json` (or sibling `base-deployed_addresses.json`)
   - `community-action-contracts` → `examples/cleanup/deployed_addresses.json` → `base` object
   - Frontend `CONTRACT_ADDRESSES` by chain
2. Confirm ABI parity with Celo stack (same `Submission` / `DCURewardManager` / `ImpactProductNFT` / `ClaimVault` lineage). If Mini App used forks/renames, map them explicitly.
3. **Do not redeploy** unless addresses are missing or unsafe; prefer pointing the unified dApp at live Base contracts.
4. Add Hardhat `base` / `baseSepolia` networks (already stubbed in `community-action-contracts`).

### C. `$bDCU` → `$cDCU` conversion

1. **Publish conversion ratio** (governance-reviewed) before deploying any bridge/claim path; document in `docs/TOKEN_SPEC.md` + public notice.
2. Design **conversion ClaimVault category** (or dedicated converter contract) on Celo:
   - Input: proof of Base `$bDCU` balance (or signed attestation of balance + converted-so-far)
   - Output: mint `$cDCU` to user’s Celo identity (EOA or smart account)
   - State: `convertedAmount[wallet]` (and/or Base wallet ↔ Celo wallet link)
3. **UI:** Settings or Wallet page — “Join Celo governance”: show Base balance, ratio, receivable `$cDCU`, confirm, track remaining convertible balance.
4. **Anti-double-claim:** never mint for already-converted `$bDCU`; support incremental converts as they earn more on Base.
5. Ops: ClaimVault authorized signer env, rate limits, audit log of conversions.

### D. Wind down Farcaster Mini App

1. List Mini App repo(s), Vercel/Warpcast manifests, deep links, Frame URLs.
2. Soft-sunset: banner in Mini App → “Continue on dapp.decleanup.net (Base)”.
3. Remove Farcaster-only auth paths from marketing; update landing CTAs to unified dApp.
4. Archive Mini App repo README with pointer to `dapp.decleanup.net` + this brief.
5. Cancel unused Mini App infra (RPC keys, Frame hosts) after traffic migrates.

### E. Docs & GitHub (explicit)

| Item | Action |
|------|--------|
| `docs/DESIGN_SYSTEM_BASE_MINIAPP_PROMPT.md` | Retarget or archive: “Base lives inside main dApp”, link this brief |
| `docs/TOKEN_SPEC.md` / `B_CDCU_ONLY_ARCHITECTURE.md` | Add `$bDCU` / dual-chain / conversion section |
| `docs/system-architecture.md` | Dual-chain diagram: Base simple loop vs Celo governance |
| `frontend/ENV_TEMPLATE.md` | Base RPC, Base contract envs, conversion signer |
| `README.md` (main) | Dual-chain product one-liner; remove “Farcaster Mini App as primary acquisition” |
| Org repos | Keep `community-action-contracts` + `web3-community-onboarding` in sync when Base addresses land |
| Landing (`decleanup-landing-standalone`) | CTA → dapp chain picker; drop Mini App as primary entry |
| Gardens / governance docs | Note: governance reads `$cDCU` on Celo only; Base users convert first |
| Changelog | Proposal outcome + migration notes when shipped |

### F. QA / security

1. Test Base submit → verify → claim with both AA (if enabled on Base) and external wallet.
2. Test conversion with partial balances and repeat converts.
3. Confirm Gardens still only sees `$cDCU` holders.
4. Security review of conversion signer + attestation of Base balances (oracle / cross-chain read / user-submitted proof).
5. If vote fails: separate runbook for final `$bDCU` airdrop split (10/50/40) — do not implement until then.

---

## 3. Suggested delivery order

1. **Docs + address inventory** (no user-facing change)  
2. **Multi-chain config + chain picker** (read-only Base balances)  
3. **Base simple flow wired** (submit/verify/claim against existing Base contracts)  
4. **Sunset Mini App** traffic  
5. **Conversion ratio + ClaimVault/converter + UI**  
6. **Polish, monitoring, org-repo address sync**

---

## 4. Out of scope until proposal passes

- Shutting down Base or executing the 10/50/40 `$bDCU` airdrop  
- Moving Impact Product levels from Base to Celo  
- Auto-bridging without user request  

---

## 5. Related repos

- App: https://github.com/DeCleanup-Network/decleanup-main-celo  
- Contracts extract: https://github.com/DeCleanup-Network/community-action-contracts  
- Onboarding extract: https://github.com/DeCleanup-Network/web3-community-onboarding  
- Landing: https://github.com/DeCleanup-Network/decleanup-landing-standalone  

---

*Generated for handoff to the DeCleanup Network developer after the Base / Farcaster governance proposal.*
