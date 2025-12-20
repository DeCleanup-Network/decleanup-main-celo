# Fee Withdrawal Scheduling

This document explains how to set up automatic fee withdrawals twice per month.

## Treasury Address

**Treasury Wallet:** `0x173D87dfa68aEB0E821C6021f5652B9C3a7556b4`

## Setup Steps

### 1. Set Treasury Address

First, run the setup script to configure the treasury address in both contracts:

```bash
cd contracts
npx hardhat run scripts/setup-treasury.ts --network celoSepolia
```

This will:
- Set treasury address in Submission contract
- Set treasury address in ImpactProductNFT contract

### 2. Choose Scheduling Method

You have several options for scheduling fee withdrawals:

#### Option A: GitHub Actions (Recommended)

Already configured! The workflow runs automatically on the 1st and 15th of each month.

**Required Secrets:**
- `DEPLOYER_PRIVATE_KEY` - Private key of contract owner
- `CELO_SEPOLIA_RPC_URL` - RPC URL for Celo Sepolia

**Manual Trigger:**
You can also trigger it manually from GitHub Actions tab.

#### Option B: Cron Job (Local/Server)

Add to your crontab:

```bash
# Run on 1st and 15th of each month at 00:00 UTC
0 0 1,15 * * cd /path/to/DCUCELOMVP/contracts && npx hardhat run scripts/withdraw-fees.ts --network celoSepolia
```

#### Option C: Blockchain Automation Service

Use services like:
- **Gelato Network** - https://www.gelato.network/
- **Chainlink Automation** - https://chain.link/automation
- **OpenZeppelin Defender** - https://www.openzeppelin.com/defender

These services can call the `withdrawFees()` function on a schedule.

### 3. Manual Withdrawal

You can also withdraw fees manually at any time:

```bash
cd contracts
npx hardhat run scripts/withdraw-fees.ts --network celoSepolia
```

## How It Works

1. **Fee Collection:**
   - Submission fees are collected when users submit cleanups (if fee is enabled)
   - Claim fees are collected when users mint/upgrade NFTs (if fee is enabled)

2. **Fee Storage:**
   - Fees are stored in the contract's native token balance
   - ImpactProductNFT contract has `withdrawFees()` function
   - Submission contract fees may need manual withdrawal or contract upgrade

3. **Withdrawal:**
   - `withdraw-fees.ts` script checks both contracts
   - Calls `withdrawFees()` on ImpactProductNFT
   - Sends all collected fees to treasury address

## Monitoring

To check fee balances:

```bash
# Check ImpactProductNFT balance
npx hardhat run scripts/check-fee-balance.ts --network celoSepolia
```

## Security Notes

- Only contract owner can withdraw fees
- Treasury address is set by owner and can be changed
- Withdrawal sends all fees, not partial amounts
- Consider adding rate limiting or maximum withdrawal amounts for production
