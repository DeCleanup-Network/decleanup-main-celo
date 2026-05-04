# $cDCU Tokenomics Specification v1.6

## Token parameters

| Parameter | Value |
|---|---|
| Name | DeCleanup Proof Token |
| Symbol (marketing) | $cDCU |
| Symbol (onchain / wallets) | `cDCU` |
| Networks | **Celo** - Mainnet chain ID **42220**, Sepolia **11142220** (match `NEXT_PUBLIC_CHAIN_ID` + ClaimVault deploy) |
| Standard | ERC-20 |
| Decimals | 18 |
| Max supply | 10,000,000 (10M) |
| Max supply enforcement | `CDCUToken.MAX_SUPPLY`; ClaimVault cannot exceed it (mints revert). |
| Mintability | **Mint-on-claim only** via ClaimVault; no user-facing direct `mint`. |
| Transferability | Transferable ERC-20 once minted. Governance participation uses **balance at snapshot** (see `frontend/src/config/cdcu.ts` for UI threshold). |

---

## Supply Allocation

| Category | % | Amount | Mint Trigger |
|---|---|---|---|
| Staking and Verifier Rewards | 33% | 3,300,000 | Verifier claim after staking period completion |
| Cleanup Campaign Incentives | 25% | 2,500,000 | User claim after verified cleanup submission |
| Public Distribution | 20% | 2,000,000 | Community claim per governance-approved schedule |
| Team and Development | 10% | 1,000,000 | Monthly claim after 1-year cliff, 3-year linear vest |
| Verification Treasury | 5% | 500,000 | Governance proposal plus multisig approval |
| Community Incentives | 4% | 400,000 | Campaign and grant claims |
| Liquidity | 3% | 300,000 | Pre-mint to LP contract at launch |

**Total: 10,000,000 $cDCU**

*Note: Liquidity allocation (3%) may be revisited for market depth; can be adjusted in future deployments or governance.*

---

## Allocation Model: Mint-on-Claim with Category Caps

**Allocation = caps, not pre-minted buckets.** Tokens are not pre-minted into vault wallets. Each allocation category has a `CATEGORY_CAP` tracked in ClaimVault. When a claim is processed, ClaimVault checks signature validity, nonce uniqueness, and category cap compliance. Only upon passing all checks does ClaimVault call `mint()` on the $cDCU contract. Running totals per category are stored onchain for transparency. So: allocation percentages define the *maximum* mintable per category; actual minting happens only when claims occur, up to those caps.

**Exception:** Liquidity allocation is pre-minted to the LP contract at launch (one-time), since liquidity positions require upfront token supply.

**Who claims per category:**
- **Verification Treasury (5%):** Two-step. Governance proposal passes → multisig executes. Multisig (or designated address) submits a claim to ClaimVault with category = VerificationTreasury. Backend generates the signed authorization only after governance approval.
- **Community Incentives (4%):** Backend authorizes a claim with category = Community to the grantee/campaign lead address. Recipient is whoever the grant or campaign specifies; internal approval at launch (can be governance-gated later).

---

## Minting Architecture

```
DeCleanup Backend (authorized signer)
        |
        | generates EIP-712 signed authorization
        |
        v
ClaimVault Contract (Celo)
        |
        | validates signature, checks nonce, enforces expiry, verifies category cap
        |
        v
$cDCU Contract
        |
        | mint() called only by ClaimVault
        |
        v
User Wallet
```

**Rules:**
- Only the ClaimVault contract address may call mint() on the $cDCU contract
- ClaimVault only mints against a valid, unexpired, single-use EIP-712 authorization
- Authorizations are generated server-side by the authorized signer wallet
- **Nonce:** One global nonce per user (any category). Each claim increments the user’s nonce; replays are rejected.
- **Staking/verifier claims:** Backend-driven. Backend monitors staking state, decides “period complete,” then issues the signed claim. ClaimVault only validates signature and caps; no onchain query to external contracts.
- No admin, team, or multisig address can mint directly to users
- The $cDCU contract includes a hardcoded MAX_SUPPLY constant. Any mint call that would exceed this cap will revert.
- **EIP-712 domain:** OpenZeppelin EIP-712 uses **`block.chainid`** at runtime - must match the network where ClaimVault is deployed (e.g. **42220** mainnet, **11142220** Sepolia). Backend signing must use the **same** chain ID as the frontend RPC / `NEXT_PUBLIC_CHAIN_ID`.
- **Claim expiry:** 30-day max expiry onchain (from `block.timestamp`). Backend may use shorter windows (e.g. 7 days) as policy.

---

## Signer Security Architecture

| Parameter | Phase 2 (Launch) | Phase 3+ (Mature) |
|---|---|---|
| Signer Type | Single EOA | 2-of-3 Multisig |
| Storage | Hardware wallet | Hardware-secured multisig |
| Rotation | Manual with operational security protocols | Timelock-governed |
| Backup | Cold wallet | Distributed key management |

The authorized signer wallet generates all EIP-712 claim authorizations. Because the backend signer controls claim authorizations, **signer rotation and/or multisig control** are important to reduce centralization risk. ClaimVault will include `updateAuthorizedSigner()` (callable only by owner/governance after transition). Phase 3 will migrate to multisig control with community-elected signers.

---

## Earning Mechanics

**DCU points = multiplier; $cDCU = claim amount.** DCU points (from cleanups, impact form, recyclables, referrals, streaks, NFT level, organizer credits, etc.) **multiply** into a claimable $cDCU amount. **$cDCU** is not sent automatically; the user **claims** it (e.g. via ClaimVault), and the **claim amount is computed from the user’s aggregate DCU points**, not from a fixed “X cleanups = Y tokens” rule. Impact form and recyclables both add +5 DCU points each (same as onchain); other weights (e.g. 10 per cleanup/level, 3 referral/streak) align with DCURewardManager / product.

**Claim amount = multiplier, not “5 cleanups”.** The backend computes **how much** $cDCU a user can claim from their **aggregate DCU points** (cleanups, impact form, recyclables, referrals, streaks, NFT level, organizer credits). So a user with e.g. **3 cleanups** but with impact forms, recyclables, or other points can already have enough to claim 250+ $cDCU. Governance’s **250** is a **balance** threshold (see below), not “5 cleanups.”

**Celo platform (direct)**
- Backend derives **claim amount from DCU points** (verified cleanups, impact form, recyclables, referrals, streaks, Impact Product NFT level, organizer credits).
- Point weights and caps are set by the team at launch; governance can adjust later.

**Organizer credits**
- Organizing a verified campaign earns **cleanup credits** equal to verified participant count (e.g. 10 participants = 10 credits).
- Credits count in the multiplier like cleanups (e.g. 1:1); they increase aggregate points and thus **claimable $cDCU**.

**Eligibility and multiplier (Celo dApp, implemented):**

Canonical implementation: **`frontend/src/lib/cdcu/claim-signing.ts`** reading **`DCURewardManager.getUserRewardStats`** (`totalEarned` in 1e18 “points”):

- **Unlock:** need at least **50** DCU points to start claiming.
- **Progressive multiplier:** **1.1×** at 50 points, **+0.1 per additional 50** points, **max 2.0×** (`getProgressiveMultiplierWei`).
- **Cap from points:** `claimableCapFromPoints` ≈ `totalPoints × multiplier / 1e18` (see code comments for examples).
- **Tranches:** each successful claim targets **one 50-DCU milestone slice** (`incrementalClaimWei`); the server tracks how many slices were already issued so users cannot double-claim.
- **Category:** dashboard claims are signed for ClaimVault category **`CleanupCampaign` (1)** unless you change policy (see **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**).

---

## Governance Threshold

| $cDCU Balance | Status |
|---|---|
| 0 | No governance access |
| 1 to 249 | Earning. Not yet eligible. |
| 250+ | Full governance participant |

250 $cDCU is the minimum balance required for governance participation, including **voting** and **creating** proposals, funding pool allocations, and verification rule changes.

**Eligibility:** **Balance** at **snapshot** when the proposal is created (or as defined by the governance module). So “250” here means **250 $cDCU tokens held**, not “5 cleanups.” No staking/locking required for basic voting. Same 250+ balance threshold for proposal creation; no verifier-only or higher bar at launch - governance can evolve this later.

---

## Backend claim logic (ClaimVault flow)

The backend that issues ClaimVault authorizations **uses logic from cleanups/NFTs** to compute **how much** $cDCU a user can claim:

1. **Read onchain or from your DB**
   - Verified cleanups (Submission events or indexer),
   - Impact form / recyclables per submission,
   - Impact Product NFT level,
   - Referrals, streaks, organizer credits (from your data or chain).
2. **Apply the same multiplier / point weights** (aligned with DCURewardManager and product rules), e.g.:
   - Per verified cleanup / level claim: 10 (or your configured weight),
   - Per impact form: 5,
   - Per recyclables: 5,
   - Referral: 3, streak: 3, etc.
3. **Compute claimable $cDCU** from the user’s aggregate points (and any caps or vesting you enforce).
4. **Issue EIP-712 claim:** `Claim(recipient, amount, category, nonce, expiry)` signed by the authorized signer; give signature + params to the user (or relayer).
5. User calls **ClaimVault.claim(...)** on Celo; ClaimVault checks signature, expiry, nonce, category cap - **it does not read** Submission or NFT contracts (policy is entirely in your signing backend).

So a user with e.g. 3 cleanups + impact + recyclables + referrals can already have a claim amount ≥ 250 $cDCU; the backend computes that amount from points, and governance’s “250” is only the **balance** required to vote, not a fixed “5 cleanups” rule.

---

## Token Metadata

**Symbol:** `cDCU` onchain and in metadata; `$cDCU` in marketing copy and UI. Standard pattern.

```json
{
  "name": "DeCleanup Proof Token",
  "symbol": "cDCU",
  "decimals": 18,
  "description": "The reputation and governance token of DeCleanup Network. Primarily earned through verified environmental impact; not offered for sale by the protocol. Used for governance participation, verifier staking, and impact credentialing on Celo.",
  "logoURI": "https://www.decleanup.net/images/cdcu-logo.png",
  "website": "https://www.decleanup.net",
  "tokenomics": "https://www.decleanup.net/tokenomics",
  "whitepaper": "https://www.decleanup.net/litepaper",
  "social": {
    "telegram": "https://t.me/DecentralizedCleanup",
    "twitter": "https://x.com/DeCleanupNet",
    "farcaster": "https://farcaster.xyz/decleanupnet",
    "github": "https://github.com/DeCleanup-Network"
  },
  "tags": ["governance", "reputation", "impact", "environment", "regen", "celo", "refi", "dmrv", "public-goods"]
}
```

*Ensure tokenomics URL is live before deploy. logoURI: confirm final hosted asset with design team.*

---

## Contract addresses (do not hardcode in docs)

**Source of truth:** `contracts/scripts/deployed_addresses.json` in this repo (updated whenever you redeploy).

Example **Celo Sepolia** snapshot (verify before relying on hexes):

| Contract | Example address (Sepolia) |
|---|---|
| CDCUToken (`$cDCU`) | `0x915b58aa293aa5a8ca6bc6df4adc26f96f2a992f` |
| ClaimVault | `0x7056d9e9b124bddda2f7f2398d50e1db388901b2` |
| DCURewardManager | `0xbb2eb0f58f8435e44b167e88fb5bd5b2937a6555` |
| Submission | `0x69ef8e25c5db30c0b231d3e476f80bf06de056b2` |
| ImpactProductNFT | `0x60d389864c6d23b38d8302106d6db3654fc5646e` |

### Implementation (this repo)

- **$cDCU:** `contracts/contracts/tokens/CDCUToken.sol` - ERC-20, `MAX_SUPPLY` 10M, only ClaimVault can mint. Call `setClaimVault(vault)` once after ClaimVault is deployed.
- **ClaimVault:** `contracts/contracts/ClaimVault.sol` - EIP-712 claim verification, category caps, nonce replay protection, **30-day max expiry** (`MAX_CLAIM_EXPIRY_WINDOW`). Owner can rotate signer / run one-time liquidity mint per contract rules.
- **Deployment order:** 1) Deploy CDCUToken. 2) Deploy ClaimVault(CDCUToken, authorizedSigner). 3) `CDCUToken.setClaimVault(ClaimVault)`. 4) Optional ownership transfer. 5) Optional `mintLiquidityTo`.

**Deploy scripts:** see **`docs/B_CDCU_ONLY_ARCHITECTURE.md`**. Scripts merge **`CDCUToken`** and **`ClaimVault`** (and core stack) into **`contracts/scripts/deployed_addresses.json`** for the frontend.

### Pre-deploy checklist

Before deploying CDCUToken + ClaimVault, confirm:

| Item | Status / notes |
|------|----------------|
| **Authorized signer** | Backend wallet is ready; its **address** is passed to the ClaimVault constructor via `AUTHORIZED_SIGNER_ADDRESS`. The signer’s **private key** stays only on the server (env `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`). |
| **Nonce replay protection** | ClaimVault uses `usedNonces[nonce]`; each signed claim can be used only once (revert if already used). |
| **Category caps** | ClaimVault enforces `categoryMinted[idx] + amount <= categoryCaps[idx]` per category; no category can mint beyond its allocation. |
| **EIP-712 domain / chainId** | OpenZeppelin EIP712 uses `block.chainid` at runtime, so the domain has the correct chainId for the network you deploy to. For **Celo mainnet** use `--network celo` (chainId 42220). Backend signing must use the **same** chainId: set `NEXT_PUBLIC_CHAIN_ID=42220` (and mainnet RPC) when running on Celo mainnet. |
| **Deploy script output** | `deploy-cdcu.ts` merges into **`contracts/scripts/deployed_addresses.json`**. Set `NEXT_PUBLIC_CLAIMVAULT_ADDRESS`, `NEXT_PUBLIC_DCU_TOKEN_CONTRACT` (cDCU), and related vars per **`frontend/ENV_TEMPLATE.md`**. |

Once these are confirmed, the architecture is consistent for **Celo**. Keep signing logic and chain ID aligned with the deployed ClaimVault.

---

## Decisions (from Q&A)

| Topic | Decision |
|--------|----------|
| Earning / claims | Claim amount computed from DCU points (cleanups, impact, recyclables, etc.); not fixed “5 cleanups = 250”. |
| Celo mint path | Backend computes claim from multiplier/points; governance can adjust point weights later. |
| Organizer credits | Count in multiplier like cleanups (1:1); increase aggregate points and thus claimable $cDCU. |
| Governance 250 | Minimum **$cDCU balance** at snapshot to vote/create proposals; not “5 cleanups.” |
| Verification Treasury | Governance passes → multisig submits claim to ClaimVault (category VerificationTreasury). |
| Community Incentives | Backend authorizes claim (category Community) to grantee/campaign lead; internal approval at launch. |
| Governance eligibility | Balance at snapshot; same 250+ for voting and proposal creation; no locking. |
| Nonce | One global nonce per user (any category). |
| Staking/verifier | Backend-driven; no onchain query from ClaimVault. |
| Symbol | `cDCU` onchain/metadata; `$cDCU` in marketing. |
| Telegram | `t.me/DecentralizedCleanup`. |
| Litepaper / tokenomics | `decleanup.net/litepaper`, `decleanup.net/tokenomics`; tokenomics URL live before deploy. |
| Tags | Add: refi, dmrv, public-goods. |
| ClaimVault owner | Multisig at launch (2-of-3 min). |
| Liquidity pre-mint | Single call by owner to LP address; not in constructor. |
| EIP-712 | Domain uses deployed chainId (`42220` or `11142220`, etc.) + ClaimVault `verifyingContract`. |
| Claim expiry | 30-day max onchain; backend may use 7 days as policy. |

---

## Open items (ops / product, not spec blockers)

1. **Mainnet deploy** - Repeat deploy + env wiring for chain **42220**; re-verify all addresses and signer keys.
2. **logoURI** - Confirm hosted branding asset in wallet metadata.
3. **Multisig / treasury** - Production ClaimVault owner and treasury executors should be multisig where possible.

---

## Change Log

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-03 | Initial Phase 1 documentation. No contract deployed. |
| 1.1 | 2026-03 | Added max supply enforcement, clarified mint-on-claim model, added signer security architecture, increased liquidity to 3%, updated "earned not purchased" language. |
| 1.1a | 2026-03 | Clarified: token enforces MAX_SUPPLY (ClaimVault cannot mint above cap); allocation = caps, mint only on claim; signer rotation/multisig for centralization; liquidity % may be adjusted; "primarily earned through impact" and transferability note. Added "Questions for contract & metadata readiness" and "What I don't understand (need your input)". |
| 1.2 | 2026-03 | Incorporated Q&A: recurring 5:250 rate; organizer credits 1:1; Verification Treasury + Community claim flows; governance snapshot + 250+ for proposals; global nonce; backend-driven staking; metadata (symbol, Telegram, tags); multisig owner; EIP-712 domain + 30-day expiry. Replaced Q&A sections with "Decisions" table and "Still undefined" blockers. |
| 1.3 | 2026-03 | Clarified: claim amount derived from DCU points / multiplier (not fixed "5 cleanups = 250"); governance 250 = minimum **balance** at snapshot, not cleanups. Added "Backend claim logic (ClaimVault flow)" and updated Decisions table. |
| 1.4 | 2026-03 | Governance threshold updated from 500 to 250 $cDCU (minimum balance for voting and proposal creation). |
| 1.5 | 2026-04 | Aligned with app: Sepolia chain ID, `deployed_addresses.json`, progressive multiplier + tranche claims (`claim-signing.ts`), removed stale “TBD” deploy table, clarified EIP-712 chainId. |
| 1.6 | 2026-04 | Removed Base bridge / companion-token product copy; spec describes Celo `$cDCU` + ClaimVault only. |
