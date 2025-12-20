/**
 * Setup treasury address for fee collection
 * 
 * Sets the treasury address in both Submission and ImpactProductNFT contracts
 * so that fees can be collected and sent to the treasury wallet.
 * 
 * Usage:
 *   npx hardhat run scripts/setup-treasury.ts --network celoSepolia
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"

const TREASURY_ADDRESS = "0x173D87dfa68aEB0E821C6021f5652B9C3a7556b4" as const

async function main() {
  console.log("💰 Setting up treasury for fee collection...\n")

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
  console.log(`   Treasury: ${TREASURY_ADDRESS}`)
  console.log(`   Submission: ${submissionAddress}`)
  console.log(`   ImpactProductNFT: ${impactProductNFTAddress}\n`)

  // Get signer
  const [deployer] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  
  console.log(`Using account: ${deployer.account.address}\n`)

  // Step 1: Set treasury in Submission contract
  console.log("📊 Step 1: Setting treasury in Submission contract...")
  const submission = await hre.viem.getContractAt(
    "Submission",
    submissionAddress,
    { walletClient: deployer }
  )
  
  const currentSubmissionTreasury = await submission.read.treasury()
  console.log(`   Current treasury: ${currentSubmissionTreasury}`)
  
  if (currentSubmissionTreasury.toLowerCase() === TREASURY_ADDRESS.toLowerCase()) {
    console.log(`   ✅ Treasury already set correctly\n`)
  } else {
    console.log(`   🔗 Setting treasury address...`)
    // Submission contract uses updateTreasury function
    const hash = await submission.write.updateTreasury([TREASURY_ADDRESS as `0x${string}`])
    console.log(`   Transaction hash: ${hash}`)
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`   ✅ Treasury set in Submission contract\n`)
  }

  // Step 2: Set treasury in ImpactProductNFT contract
  console.log("📊 Step 2: Setting treasury in ImpactProductNFT contract...")
  const impactProductNFT = await hre.viem.getContractAt(
    "ImpactProductNFT",
    impactProductNFTAddress,
    { walletClient: deployer }
  )
  
  let currentNFTTreasury: string = "0x0000000000000000000000000000000000000000"
  try {
    currentNFTTreasury = await impactProductNFT.read.treasury()
    console.log(`   Current treasury: ${currentNFTTreasury}`)
  } catch (error) {
    console.log(`   ⚠️  Could not read treasury (contract may need redeployment): ${error}`)
    console.log(`   🔗 Setting treasury address anyway...`)
  }
  
  if (currentNFTTreasury.toLowerCase() === TREASURY_ADDRESS.toLowerCase()) {
    console.log(`   ✅ Treasury already set correctly\n`)
  } else {
    console.log(`   🔗 Setting treasury address...`)
    const hash = await impactProductNFT.write.setTreasury([TREASURY_ADDRESS as `0x${string}`])
    console.log(`   Transaction hash: ${hash}`)
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`   ✅ Treasury set in ImpactProductNFT contract\n`)
  }

  console.log("✅ Treasury setup complete!")
  console.log("\n📝 Summary:")
  console.log(`   Treasury address: ${TREASURY_ADDRESS}`)
  console.log("   Fees from Submission contract will be sent to this address")
  console.log("   Fees from ImpactProductNFT contract will be sent to this address")
  console.log("\n💡 Next steps:")
  console.log("   - Run withdraw-fees.ts script twice per month to collect fees")
  console.log("   - Or set up automated scheduling (cron/GitHub Actions/etc.)")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
