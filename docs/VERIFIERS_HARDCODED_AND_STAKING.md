# Verifiers: Are They Hardcoded? What’s Missing for Staking-Based Verifiers?

## 1. Are verifiers hardcoded? Yes.

**Where**

- **`contracts/scripts/setup-roles.ts`**  
  A single address is hardcoded:
  ```ts
  const VERIFIER = "0x7d85fcbb505d48e6176483733b62b51704e0bf95";
  ```
  The script grants **`VERIFIER_ROLE`** (and **`ADMIN_ROLE`**) on the **Submission** contract to that address. Adding another verifier = adding another address to the script (or calling `grantRole` from an admin) and re-running.

**How it works on-chain**

- **Submission.sol** uses OpenZeppelin **AccessControl**:
  - `approveSubmission(uint256 submissionId)` and `rejectSubmission(uint256 submissionId)` are protected by **`onlyRole(VERIFIER_ROLE)`**.
  - So only addresses that have been **explicitly granted** `VERIFIER_ROLE` (via `grantRole` by an admin) can verify.
- There is **no** check for:
  - staking,
  - cDCU balance,
  - or Impact Product level.

So today: **verifier = any address an admin has granted `VERIFIER_ROLE` to**, and that list is effectively hardcoded via the setup script (and any one-off `grantRole` calls).

---

## 2. Your target rule: who should be a verifier?

You want verifiers to be users who:

1. **Stake at least 51% of their tokens** (staked ≥ 51% of their total cDCU holdings).
2. **Reach level 3** (Impact Product NFT level).
3. **Have at least 30 cDCU** (minimum stake; we assume this means **staked** ≥ 30 cDCU).

So: **verifier** = user for whom, at the time of calling `approveSubmission` / `rejectSubmission`:

- `impactProductNFT.getUserNFTData(user).level >= 3`
- `stakedBalance(user) >= 30 * 10^18` (30 cDCU, 18 decimals)
- `stakedBalance(user) >= 0.51 * (stakedBalance(user) + dcuToken.balanceOf(user))`  
  i.e. staked share of their total holdings ≥ 51%.

---

## 3. What is missing to get there?

### 3.1 Staking contract (does not exist yet)

- There is **no staking contract** in the repo. The staking page is mock / “coming soon”.
- You need a contract that:
  - Holds **staked cDCU** (users transfer cDCU in and get a “staked” balance).
  - Exposes at least:
    - **`stakedBalance(address user) → uint256`** (staked amount for that user).
  - Optionally: unstake and slashing rules, lock period, etc., depending on product.

Without this, you cannot define “51% staked” or “30 cDCU staked” on-chain.

### 3.2 Submission contract: verifier logic

Today Submission only checks **`onlyRole(VERIFIER_ROLE)`**. To switch to your rule you need one of:

**Option A – Eligibility check inside Submission (recommended)**

- Submission gets references to:
  - **DCU token** (already has `dcuToken`),
  - **Staking contract** (new),
  - **ImpactProductNFT** (already has `impactProductNFT`).
- Add a **view** that implements your rule, e.g.:
  ```text
  canVerify(user) =
    level >= 3
    && stakedBalance(user) >= 30e18
    && stakedBalance(user) * 100 >= 51 * (stakedBalance(user) + dcuToken.balanceOf(user))
  ```
- In **`approveSubmission`** and **`rejectSubmission`**:
  - Replace (or add to) `onlyRole(VERIFIER_ROLE)` with a require that uses this view for `msg.sender`, e.g. `require(canVerify(msg.sender), "Not eligible to verify")`.
- Then you can stop using the hardcoded verifier list for access control (you may still keep `VERIFIER_ROLE` for other uses or remove it from these two functions).

**Option B – Staking contract grants/revokes VERIFIER_ROLE**

- Staking contract (or a small “VerifierRegistry”) calls Submission’s `grantRole(VERIFIER_ROLE, user)` when a user first meets the criteria (level ≥ 3, staked ≥ 30 cDCU, staked ≥ 51% of holdings), and `revokeRole(VERIFIER_ROLE, user)` when they no longer do.
- Submission stays as it is (`onlyRole(VERIFIER_ROLE)`).
- You need to:
  - Give the staking/registry contract permission to grant/revoke `VERIFIER_ROLE` (e.g. admin grants it `VERIFIER_ROLE` or a custom role that can call a `setVerifier(address,bool)` on Submission).
  - Update eligibility whenever: user stakes/unstakes, and when their level or balance changes (e.g. on level-up or large transfers). That can be complex (events, keeper, or user-triggered “refresh”); Option A avoids that by checking at call time.

### 3.3 Level and 30 cDCU / 51% – what exists today

- **Level:** Submission already has **`impactProductNFT`** and the NFT exposes **`getUserNFTData(user)`** returning `(tokenId, impact, level)`. So **level ≥ 3** can be enforced on-chain as soon as you add the check.
- **30 cDCU and 51%:** Need **staked balance** and **unstaked balance**:
  - **Staked:** only available once a **staking contract** exists and exposes `stakedBalance(user)`.
  - **Unstaked:** **`dcuToken.balanceOf(user)`** is already available; Submission already has `dcuToken`.

So:

- **Level 3:** on-chain data is there; only the rule (level ≥ 3) and the call to `getUserNFTData` in the verifier check are missing.
- **30 cDCU min and 51% staked:** both require a **staking contract** and a link from Submission (or the registry) to that contract.

---

## 4. Summary checklist

| Requirement | Status | What’s missing |
|------------|--------|----------------|
| Verifiers today | Hardcoded | Single address in `setup-roles.ts`; access = `VERIFIER_ROLE` on Submission. |
| Level ≥ 3 | Data exists | Add check in Submission (or registry) using `impactProductNFT.getUserNFTData(user).level >= 3`. |
| Staked ≥ 30 cDCU | No data | Implement staking contract with `stakedBalance(user)`; then add check `stakedBalance(user) >= 30e18`. |
| Staked ≥ 51% of tokens | No data | Same staking contract + `dcuToken.balanceOf(user)`; then require `stakedBalance(user) * 100 >= 51 * (stakedBalance(user) + dcuToken.balanceOf(user))`. |
| Use this in `approveSubmission` / `rejectSubmission` | Not done | Add eligibility check (Option A) or staking/registry that grants/revokes `VERIFIER_ROLE` (Option B). |

**Short answer:** Verifiers are hardcoded in the setup script and on-chain as holders of `VERIFIER_ROLE`. To make verifiers = “stake ≥ 51% of their tokens, level ≥ 3, and ≥ 30 cDCU staked”, you need: **(1) a staking contract** that exposes `stakedBalance(user)`, **(2)** Submission (or a small registry) to **enforce the three conditions** (level, 30 cDCU, 51%) in `approveSubmission`/`rejectSubmission`, and **(3)** wiring (e.g. new config on Submission for the staking contract and optional view helper).
