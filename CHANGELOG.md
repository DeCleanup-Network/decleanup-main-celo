CHANGELOG.md
Changelog

All notable changes to this project will be documented in this file.

This project adheres to Semantic Versioning
.

[0.2.0] – 2025-12-02
🚀 Major Refactor: Unified Reward System

This release removes the legacy reward engine, consolidates all reward logic under DCURewardManager, and updates the entire test suite to reflect the new architecture.

Removed

RewardLogic.sol

Fully removed from the codebase

All imports, references, and test files deleted

Removed deprecated functions in Submission.sol:

claimRewards

claimableRewards

getClaimableRewards

RewardClaimed event

Removed legacy reward pathways across the contracts and tests

Removed unused/legacy scripts related to RewardLogic

Added

New external function in DCURewardManager:
distributeRewards(address submissionId, address user)

Centralizes reward minting and distribution

Replaces the old dual reward flow

Added new RewardSource.Submission enum entry

Added utilities and helpers inside the tests to support the new reward flow

Added constructor role setup for DCUToken (MINTER_ROLE)

Changed
Contracts

Submission.sol

Fully migrated to use rewardManager.distributeRewards()

Removed internal state that previously tracked pending rewards

Submission events and logic updated to reflect unified reward flow

DCURewardManager.sol

Integrated reward calculation and minting logic

Updated reward breakdown, eligibility checks, referral logic, verifier reward logic, and POI reward rules

Ensured data consistency and single-source-of-truth architecture

DCUToken.sol

Removed legacy logic tied to RewardLogic

Cleaned constructor

Added MINTER_ROLE for RewardManager

ImpactProductNFT.sol

Updated minting flow to align with new reward system

Deployment scripts

contracts/ignition/modules/DCUContracts.ts

Removed RewardLogic deployment

Added consistent role assignments

Updated constructor params and wiring for new reward architecture

Tests

Entire test suite updated and migrated to new viem-based flow:

Submission.test.ts

DCURewardManager.test.ts

DCUToken.test.ts

ImpactProductNFT.test.ts

InputValidation.test.ts

RewardEvents.test.ts

VerificationSequence.test.ts

Fixed broken mocks, address casing, event listeners, constructor assertions

Updated simulations and expected flows to match new architecture

All tests now pass with the updated reward system

Security & Logic Improvements

Centralized all token minting under a single trusted contract (DCURewardManager)

Removed legacy mint paths that could allow inconsistencies or double-mint

Reduced attack surface by removing redundant state and duplicated logic

Improved auditability and predictability of reward calculations

Notes

This refactor brings the smart contracts much closer to mainnet readiness and reduces complexity by unifying the reward architecture.

Next Version (0.2.1 – unreleased)

Fix remaining TypeScript warnings in tests

Additional refactor for Submission events

Integration of frontend changes with unified reward system


___


## [Unreleased] – Sprint 1 Progress

### 🔧 Core Contract Fixes & Improvements
- Refactored reward logic in `Submission.sol` and `DCURewardManager.sol` to correct:
  - Accurate distribution of rewards for approved submissions  
  - Fully operational impact-report and recyclables-proof reward paths  
  - Stable integration Submission → RewardManager → DCUToken  
- Fixed bug in `userImpactFormCount` tracking.
- Corrected hypercert eligibility logic in `Submission.sol`.
- Reorganized events for clearer, more consistent tracking.

### 🪪 Roles & Access Control (pre–Fix #3)
- Ensured `MAIN_DEPLOYER` has:  
  - `DEFAULT_ADMIN_ROLE`  
  - `ADMIN_ROLE`  
  - Ownership of the `Submission` contract  
- Granted `MINTER_ROLE` on DCUToken to the DCURewardManager via Ignition deployment.
- Improved role initialization in `setup-roles.ts`:
  - Submission + RewardManager treasury both updated to `MAIN_DEPLOYER`
  - Role checks and verification improved

### 📦 Deployment & Hardhat / Ignition Updates
- Updated Ignition modules to deploy all core DCU contracts:
  - `DCUToken`
  - `DCURewardManager`
  - `Submission`
  - `ImpactProductNFT`
  - `DCUStorage` & `DCUAccounting`
- Added automatic grant of `MINTER_ROLE` to the RewardManager during deployment.
- Added structured export of deployed addresses into `deployed_addresses.json`.

### 🛠 Script Improvements
- Updated the post-deployment setup script (`setup-roles.ts`) to:
  - Verify and sync ownership  
  - Update treasuries  
  - Grant core roles  
  - Validate addresses and critical configuration  
