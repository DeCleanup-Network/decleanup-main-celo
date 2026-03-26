# Milestone 2 Changelog

This file tracks all changes made during the implementation of Milestone 2: $cDCU Token Launch and Claim/Stake Function.

## Changes

### 2026-01-08

- **DCUToken.sol**: Evaluated for mainnet readiness. Confirmed transferable ERC20 with controlled minting by MINTER_ROLE. No changes needed as token remains transferable per requirements.
- **contracts/scripts/airdrop-cdcu.ts**: Created script for controlled airdrop to V1 users and testnet participants.
- **frontend/src/components/layout/Footer.tsx**: Added governance link to specific Gardens.fund garden URL in footer resources.
- **frontend/src/app/staking/page.tsx**: Created mockup staking page with coming soon banner, disabled wallet connection, staking form, transaction history, and responsive design.
- **Mainnet deployment**: Hardhat config already includes Celo mainnet network configuration.
- **Governance vote**: Defined first proposal - "Welcome to DeCleanup Governance - First Community Vote" with eligibility for cDCU holders.
- **Reward distribution**: Verified RewardManager uses correct cDCU token with consistent reward amounts and no duplication.

