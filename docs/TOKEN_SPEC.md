# $cDCU Tokenomics Specification v1.1

## Token Parameters

| Parameter | Value |
|---|---|
| Name | DeCleanup Proof Token |
| Symbol | $cDCU |
| Network | Celo Mainnet (Chain ID: 42220) |
| Standard | ERC-20 |
| Decimals | 18 |
| Max Supply | 10,000,000 (10M) |
| Max Supply Enforcement | The token contract enforces a hardcoded `MAX_SUPPLY` (10M). ClaimVault cannot mint above it—any mint that would exceed the cap reverts in the token contract. |
| Mintability | Controlled. Mint-on-claim only via ClaimVault. No direct mint to user wallets. |
| Transferability | Transferable. Governance and staking use locked positions. |

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
- **Staking/verifier claims:** Backend-driven. Backend monitors staking state, decides “period complete,” then issues the signed claim. ClaimVault only validates signature and caps; no on-chain query to external contracts.
- No admin, team, or multisig address can mint directly to users
- The $cDCU contract includes a hardcoded MAX_SUPPLY constant. Any mint call that would exceed this cap will revert.
- **EIP-712 domain:** Include `chainId: 42220` and `verifyingContract: [ClaimVault address]` explicitly for cross-chain clarity.
- **Claim expiry:** 30-day max expiry on-chain (from `block.timestamp`). Backend may use shorter windows (e.g. 7 days) as policy.

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

**DCU points = multiplier; $cDCU = claim amount.** DCU points (from cleanups, impact form, recyclables, referrals, streaks, NFT level, organizer credits, etc.) **multiply** into a claimable $cDCU amount. **$cDCU** is not sent automatically; the user **claims** it (e.g. via ClaimVault), and the **claim amount is computed from the user’s aggregate DCU points**, not from a fixed “X cleanups = Y tokens” rule. Impact form and recyclables both add +5 DCU points each (same as on-chain); other weights (e.g. 10 per cleanup/level, 3 referral/streak) align with DCURewardManager / product.

**Claim amount = multiplier, not “5 cleanups”.** The backend computes **how much** $cDCU a user can claim from their **aggregate DCU points** (cleanups, impact form, recyclables, referrals, streaks, NFT level, organizer credits). So a user with e.g. **3 cleanups** but with impact forms, recyclables, or other points can already have enough to claim 250+ $cDCU. Governance’s **250** is a **balance** threshold (see below), not “5 cleanups.”

**Path 1: Base Bridge (indirect)**
- User completes verified cleanups (and optional impact/recyclables) on the Base mini app.
- Backend **computes claimable $cDCU from DCU points** (cleanups, impact, recyclables, organizer credits, etc.).
- Backend builds EIP-712 claim and signs; user receives the signed claim (e.g. via API).
- User visits Celo dApp and **submits the authorization to ClaimVault manually** (no relayer at launch).
- ClaimVault mints the **computed amount** of $cDCU to the user wallet.

**Path 2: Celo Full Platform (direct)**
- Same logic: backend derives **claim amount from DCU points** (verified cleanups, impact form, recyclables, referrals, streaks, Impact Product NFT level, organizer credits).
- Point weights and caps are set by the team at launch; governance can adjust later.

**Organizer credits (both paths)**
- Organizing a verified campaign earns **cleanup credits** equal to verified participant count (e.g. 10 participants = 10 credits).
- Credits count in the multiplier like cleanups (e.g. 1:1); they increase aggregate points and thus **claimable $cDCU**.

**Eligibility and multiplier (Celo dApp):**
- **Eligibility:** User can claim $cDCU when they reach **50 DCU points** (on-chain total from DCURewardManager: cleanups, impact reports, referrals, streaks).
- **Multiplier formula:** Claimable $cDCU = **(total DCU points − 50) × 0.1** (10% of points above the threshold). So 50 points → 0 $cDCU (unlocks eligibility), 60 → 1, 100 → 5, 150 → 10. Already-claimed amount is tracked server-side and subtracted so users don’t double-claim.

---

## Governance Threshold

| $cDCU Balance | Status |
|---|---|
| 0 | No governance access |
| 1 to 249 | Earning. Not yet eligible. |
| 250+ | Full governance participant |

250 $cDCU is the minimum balance required for governance participation, including **voting** and **creating** proposals, funding pool allocations, and verification rule changes.

**Eligibility:** **Balance** at **snapshot** when the proposal is created (or as defined by the governance module). So “250” here means **250 $cDCU tokens held**, not “5 cleanups.” No staking/locking required for basic voting. Same 250+ balance threshold for proposal creation; no verifier-only or higher bar at launch—governance can evolve this later.

---

## Backend claim logic (ClaimVault flow)

The backend that issues ClaimVault authorizations **uses logic from cleanups/NFTs** to compute **how much** $cDCU a user can claim:

1. **Read on-chain or from your DB**
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
5. User (or relayer) calls **ClaimVault.claim(...)** on Celo; ClaimVault checks signature, expiry, nonce, category cap—**it does not read** Submission or NFT contracts.

So a user with e.g. 3 cleanups + impact + recyclables + referrals can already have a claim amount ≥ 250 $cDCU; the backend computes that amount from points, and governance’s “250” is only the **balance** required to vote, not a fixed “5 cleanups” rule.

---

## $bDCU and $cDCU Relationship

$bDCU (Base) and $cDCU (Celo) serve complementary roles within the DeCleanup ecosystem:

| Token | Chain | Role | Acquisition |
|---|---|---|---|
| $bDCU | Base | Community support and engagement token | Tradeable on DEX. Fair launched via Clanker. |
| $cDCU | Celo | Impact reputation and governance token | Primarily earned through verified impact activity. Not offered for sale by the protocol; transferable, so secondary market (e.g. DEX) may exist. |

**Priority claim access:** $bDCU holders who complete verified cleanups on Base are **eligible** for the Base→Celo claim path (eligibility only—no different cap or rate at launch). Non-holders use Celo direct path only. *Optional later: consider a small rate bonus (e.g. 10–20% more $cDCU per claim) for $bDCU holders to reward early supporters.*

**Flow:** Always “do action on Base → backend issues signed claim → user submits on Celo.” No auto-relayer at launch (manual claim); keeps complexity and gas abstraction minimal.

---

## Token Metadata

**Symbol:** `cDCU` on-chain and in metadata; `$cDCU` in marketing copy and UI. Standard pattern.

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

## Contract Addresses

| Contract | Address | Status |
|---|---|---|
| $cDCU Token | TBD | Deploy Phase 2 |
| ClaimVault | TBD | Deploy Phase 2 |
| Authorized Signer | TBD | Server wallet |

Contract addresses will be populated in TOKEN_SPEC.md v2.0 upon Phase 2 deployment.

### Implementation (this repo)

- **$cDCU:** `contracts/contracts/tokens/CDCUToken.sol` — ERC-20, `MAX_SUPPLY` 10M, only ClaimVault can mint. Call `setClaimVault(vault)` once after ClaimVault is deployed.
- **ClaimVault:** `contracts/contracts/ClaimVault.sol` — EIP-712 claim verification, category caps, global nonce per user, **30-day max expiry on-chain** (`MAX_CLAIM_EXPIRY_WINDOW`). Constructor: `(tokenAddress, authorizedSigner)`. **Owner:** multisig at launch (2-of-3 minimum). One-time `mintLiquidityTo(lpContract)` by owner; `updateAuthorizedSigner(newSigner)` for signer rotation (owner). EIP-712 domain (OpenZeppelin) includes chainId and verifyingContract when deployed.
- **Deployment order:** 1) Deploy CDCUToken. 2) Deploy ClaimVault(CDCUToken, authorizedSigner). 3) CDCUToken.setClaimVault(ClaimVault). 4) (Optional) Transfer ClaimVault ownership to multisig. 5) (When ready) ClaimVault.mintLiquidityTo(lpContract).

**Deploy script:** `AUTHORIZED_SIGNER_ADDRESS=0x... npx hardhat run scripts/deploy-cdcu.ts --network celo` (or `celoSepolia`). Optional: `CLAIMVAULT_OWNER_MULTISIG=0x...` to transfer ClaimVault ownership. Output: `contracts/scripts/cdcu-deployed.json`.

### Pre-deploy checklist

Before deploying CDCUToken + ClaimVault, confirm:

| Item | Status / notes |
|------|----------------|
| **Authorized signer** | Backend wallet is ready; its **address** is passed to the ClaimVault constructor via `AUTHORIZED_SIGNER_ADDRESS`. The signer’s **private key** stays only on the server (env `CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY`). |
| **Nonce replay protection** | ClaimVault uses `usedNonces[nonce]`; each signed claim can be used only once (revert if already used). |
| **Category caps** | ClaimVault enforces `categoryMinted[idx] + amount <= categoryCaps[idx]` per category; no category can mint beyond its allocation. |
| **EIP-712 domain / chainId** | OpenZeppelin EIP712 uses `block.chainid` at runtime, so the domain has the correct chainId for the network you deploy to. For **Celo mainnet** use `--network celo` (chainId 42220). Backend signing must use the **same** chainId: set `NEXT_PUBLIC_CHAIN_ID=42220` (and mainnet RPC) when running on Celo mainnet. |
| **Deploy script output** | Script writes `CDCUToken`, `ClaimVault`, `authorizedSigner`, `chainId`, `network` to `contracts/scripts/cdcu-deployed.json`. Set frontend env `NEXT_PUBLIC_CLAIMVAULT_ADDRESS` to the ClaimVault address from that file. |

Once these are confirmed, the architecture is consistent and there is no blocker for deploying CDCUToken + ClaimVault. The same points → backend eligibility → signed claim → ClaimVault mint flow will work for the Base → Celo claim bridge later.

---

## Decisions (from Q&A)

| Topic | Decision |
|--------|----------|
| Base earning | Claim amount computed from DCU points (cleanups, impact, recyclables, etc.); not fixed “5 cleanups = 250”. |
| Celo earning | Same: backend computes claim from multiplier/points; governance can adjust point weights later. |
| Organizer credits | Count in multiplier like cleanups (1:1); increase aggregate points and thus claimable $cDCU. |
| Governance 250 | Minimum **$cDCU balance** at snapshot to vote/create proposals; not “5 cleanups.” |
| Verification Treasury | Governance passes → multisig submits claim to ClaimVault (category VerificationTreasury). |
| Community Incentives | Backend authorizes claim (category Community) to grantee/campaign lead; internal approval at launch. |
| $bDCU priority | Eligibility only (access to Base→Celo path). Optional later: 10–20% rate bonus. |
| Base→Celo flow | Manual claim; no relayer at launch. |
| Governance eligibility | Balance at snapshot; same 250+ for voting and proposal creation; no locking. |
| Nonce | One global nonce per user (any category). |
| Staking/verifier | Backend-driven; no on-chain query from ClaimVault. |
| Symbol | `cDCU` on-chain/metadata; `$cDCU` in marketing. |
| Telegram | `t.me/DecentralizedCleanup`. |
| Litepaper / tokenomics | `decleanup.net/litepaper`, `decleanup.net/tokenomics`; tokenomics URL live before deploy. |
| Tags | Add: refi, dmrv, public-goods. |
| ClaimVault owner | Multisig at launch (2-of-3 min). |
| Liquidity pre-mint | Single call by owner to LP address; not in constructor. |
| EIP-712 | Include chainId 42220 and verifyingContract. |
| Claim expiry | 30-day max on-chain; backend may use 7 days as policy. |

---

## Still undefined (blockers before deploy)

1. **Point weights and claim formula** — Backend must implement multiplier (cleanup/level, impact, recyclables, referral, streak, organizer) and document in product/backend; governance 250 = balance only.
2. **$bDCU holder rate bonus** — Optional (10–20%); decide yes/no and document if yes.
3. **logoURI** — Final hosted asset from design team (replace placeholder if needed).
4. **Multisig addresses** — ClaimVault owner (2-of-3) and, if different, Verification Treasury executor.

---

## Change Log

| Version | Date | Notes |
|---|---|---|
| 1.0 | 2026-03 | Initial Phase 1 documentation. No contract deployed. |
| 1.1 | 2026-03 | Added max supply enforcement, clarified mint-on-claim model, added signer security architecture, increased liquidity to 3%, updated "earned not purchased" language, defined $bDCU relationship. |
| 1.1a | 2026-03 | Clarified: token enforces MAX_SUPPLY (ClaimVault cannot mint above cap); allocation = caps, mint only on claim; signer rotation/multisig for centralization; liquidity % may be adjusted; "primarily earned through impact" and transferability note. Added "Questions for contract & metadata readiness" and "What I don't understand (need your input)". |
| 1.2 | 2026-03 | Incorporated Q&A: recurring 5:250 rate (Base + Celo); organizer credits 1:1; Verification Treasury + Community claim flows; $bDCU eligibility + optional bonus; governance snapshot + 250+ for proposals; global nonce; backend-driven staking; metadata (symbol, Telegram, tags); multisig owner; EIP-712 domain + 30-day expiry. Replaced Q&A sections with "Decisions" table and "Still undefined" blockers. |
| 1.3 | 2026-03 | Clarified: claim amount derived from DCU points / multiplier (not fixed "5 cleanups = 250"); governance 250 = minimum **balance** at snapshot, not cleanups. Added "Backend claim logic (ClaimVault flow)" and updated Decisions table. |
| 1.4 | 2026-03 | Governance threshold updated from 500 to 250 $cDCU (minimum balance for voting and proposal creation). |
