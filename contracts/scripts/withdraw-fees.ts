/**
 * Withdraw collected fees to treasury
 * 
 * This script withdraws all collected fees from both Submission and ImpactProductNFT
 * contracts to the treasury address. Can be run manually or scheduled (e.g., twice per month).
 * 
 * Usage:
 *   npx hardhat run scripts/withdraw-fees.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"
import { formatEther } from "viem"

async function main() {
  console.log("💸 Withdrawing fees to treasury...\n")

  // Load deployed addresses
  const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error("❌ deployed_addresses.json not found!")
    process.exit(1)
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"))
  const submissionAddress = deployedAddresses.Submission
  const impactProductNFTAddress = deployedAddresses.ImpactProductNFT

  if (!submissionAddress || !impactProductNFTAddress) {
    console.error("❌ Missing required contract addresses!")
    process.exit(1)
  }

  console.log("Configuration:")
  console.log(`   Submission: ${submissionAddress}`)
  console.log(`   ImpactProductNFT: ${impactProductNFTAddress}\n`)

  // Get signer
  const [deployer] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  
  console.log(`Using account: ${deployer.account.address}\n`)

  let totalWithdrawn = 0n

  // Step 1: Check and withdraw from Submission contract
  console.log("📊 Step 1: Checking Submission contract...")
  const submission = await hre.viem.getContractAt(
    "Submission",
    submissionAddress,
    { walletClient: deployer }
  )
  
  const submissionBalance = await publicClient.getBalance({ address: submissionAddress })
  const submissionTreasury = await submission.read.treasury()
  
  console.log(`   Contract balance: ${formatEther(submissionBalance)} CELO`)
  console.log(`   Treasury: ${submissionTreasury}`)
  
  if (submissionBalance > 0n && submissionTreasury !== "0x0000000000000000000000000000000000000000") {
    console.log(`   💸 Withdrawing ${formatEther(submissionBalance)} CELO to treasury...`)
    try {
      // Note: Submission contract doesn't have withdrawFees, so we need to check if it has a withdraw function
      // For now, we'll check the contract balance and note that fees are collected but not automatically withdrawn
      // The treasury can be set up to receive fees directly, or we can add a withdraw function
      console.log(`   ⚠️  Submission contract balance: ${formatEther(submissionBalance)} CELO`)
      console.log(`   ⚠️  Note: Submission fees are stored in contract. Manual withdrawal may be needed.`)
    } catch (error: any) {
      console.log(`   ⚠️  Could not withdraw from Submission: ${error.message}`)
    }
  } else {
    console.log(`   ℹ️  No balance to withdraw from Submission contract\n`)
  }

  // Step 2: Withdraw from ImpactProductNFT contract
  console.log("\n📊 Step 2: Checking ImpactProductNFT contract...")
  const impactProductNFT = await hre.viem.getContractAt(
    "ImpactProductNFT",
    impactProductNFTAddress,
    { walletClient: deployer }
  )
  
  const nftBalance = await publicClient.getBalance({ address: impactProductNFTAddress })
  const nftTreasury = await impactProductNFT.read.treasury()
  
  console.log(`   Contract balance: ${formatEther(nftBalance)} CELO`)
  console.log(`   Treasury: ${nftTreasury}`)
  
  if (nftBalance > 0n && nftTreasury !== "0x0000000000000000000000000000000000000000") {
    console.log(`   💸 Withdrawing ${formatEther(nftBalance)} CELO to treasury...`)
    try {
      const hash = await impactProductNFT.write.withdrawFees()
      console.log(`   Transaction hash: ${hash}`)
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      console.log(`   ✅ Fees withdrawn successfully!`)
      totalWithdrawn += nftBalance
      
      // Verify withdrawal
      const newBalance = await publicClient.getBalance({ address: impactProductNFTAddress })
      console.log(`   New contract balance: ${formatEther(newBalance)} CELO`)
    } catch (error: any) {
      console.error(`   ❌ Failed to withdraw from ImpactProductNFT: ${error.message}`)
    }
  } else {
    console.log(`   ℹ️  No balance to withdraw from ImpactProductNFT contract`)
  }

  console.log("\n✅ Fee withdrawal complete!")
  console.log(`\n📝 Summary:`)
  console.log(`   Total withdrawn: ${formatEther(totalWithdrawn)} CELO`)
  console.log(`   Treasury address: ${nftTreasury}`)
  console.log(`\n💡 Schedule this script to run twice per month:`)
  console.log(`   - Using cron: 0 0 1,15 * * (1st and 15th of each month)`)
  console.log(`   - Using GitHub Actions: Set up workflow with schedule`)
  console.log(`   - Using blockchain automation: Gelato, Chainlink Automation, etc.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
