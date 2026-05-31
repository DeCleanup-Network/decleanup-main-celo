# UI copy inventory (short)

User-facing strings for copy edits. Update code after changes. `{var}` = runtime value.

---

## Home (`app/page.tsx`)

**Pre-login hero:** Log cleanups. Build a verified record. Earn your voice in the network.

**Pre-login hints:** Sign in with Google, email, or wallet · Connect your wallet to start cleaning *(wallet-only mode, when `aaAuth` is false)*

**Logged-in:** No duplicate tagline under DECLEANUP REWARDS (status text only).

**Banners:** Maximum Impact Product level reached. New submissions are closed for this program phase. · Your cleanup is being verified. This usually takes a few hours. · Wallet locked. Passkey required when you submit or claim onchain. · Restore your wallet in Smart account settings.

**Airdrop strip:** Past contributors: check $cDCU airdrop eligibility. / Past contributor? Check or claim your $cDCU airdrop. *(hidden after claim via `PastContributorAirdropStrip`)*

**Claim modals:** Level claimed, bonuses pending · Impact Product claimed · Claim failed

---

## Cleanup flow (`features/cleanup/pages/page.tsx`)

### Gates
Sign in required / Connect Your Wallet · Log in · Smart account settings · Go Back · SUBMISSION CLOSED (max level + Impact Portfolio link)

### Banners
| Title | Body |
|-------|------|
| Invited by a friend | You were referred to DeCleanup Rewards. Submit a cleanup to start. |
| Wrong Network | Chain mismatch + MetaMask Celo instructions |
| Ready to claim | Cleanup #{id} verified. On home, tap CLAIM LEVEL. |
| Submission on Cooldown | Cleanup #{id} pending. Wait before submitting again. |
| Gasless | Preparing gasless submit… / unavailable / activates when loaded |
| Account ready | Optional: Smart account settings |

### Photos
Before/after photos with location. JPEG, JPG, or HEIC, max 10 MB each.

Allow before/after photo on website and social · Location * · Get Location · Enter manually

**LOCATION_PERMISSION_HINT:** Enable location in phone Settings and allow this site in your browser (site settings > Location).

Manual coords: Paste lat, lng from Google Maps (right-click the spot). Saved for this session.

### Impact report
+5 DCU bonus · Optional cleanup details · Photo sharing license * · Required for Hypercerts. Saved as hypercert.rights on your certificate.

Contributors: Attribution only (no DCU). Wallet or ENS (e.g. vitalik.eth).

### Recyclables
+5 DCU bonus · Optional recyclables proof · Enter how much material was recycled.

### Success (review)
Submission successful! · Pending verification (often 2-12 hours). Claim rewards after approval. · Human verifiers decide onchain; AI is guidance only. · Go to Home

### Key errors (no em dash, use onchain)
Impact report upload/hash failures · Wrong network · Clear pending cleanup confirm (onchain) · cleanupFailureHints

---

## Hypercerts rights (`rights-presets.ts`)

| ID | Label |
|----|-------|
| all-rights-reserved | Keep photos private |
| public-display | Public display, no reuse |
| public-display-non-commercial | Public display, non-commercial reuse |
| public-display-commercial | Public display, commercial reuse |
| public-display-commercial-derivatives | Public display, commercial reuse and edits |

---

## Shared modals

AlertModal: OK · ConfirmModal: Confirm / Cancel · SuccessModal: View on Explorer / Close

SignUnlock (cleanup): submit this cleanup · claim your Impact Product level

---

## Other surfaces (unchanged this pass)

Dashboard actions, $cDCU claim, verifier apply, airdrop page, login, wallet, profile, impact portfolio, verifier cabinet. See `frontend/src` for full strings.
