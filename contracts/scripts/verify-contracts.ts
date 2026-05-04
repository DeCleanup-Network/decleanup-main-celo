/**
 * Verify all deployed contracts on Celoscan (Celo Sepolia)
 * 
 * This script verifies all contracts listed in deployed_addresses.json
 * on the Celo Sepolia block explorer (Celoscan).
 * 
 * Prerequisites:
 *   1. Set CELOSCAN_API_KEY environment variable
 *      Get your API key from: https://celoscan.io/myapikey
 *   2. Contracts must be deployed and source code must match
 *   3. Hardhat verify plugin must be configured in hardhat.config.ts
 * 
 * Usage:
 *   CELOSCAN_API_KEY=your_api_key npx hardhat run scripts/verify-contracts.ts --network celoSepolia
 * 
 * Note: Constructor arguments are automatically determined from deployed_addresses.json.
 * If verification fails, you may need to manually verify with correct constructor args.
 * 
 * Manual verification example:
 *   npx hardhat verify --network celoSepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARG1> <CONSTRUCTOR_ARG2> ...
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"

// Helper function to get constructor arguments from deployed addresses
function getConstructorArgs(contractName: string, deployedAddresses: any): any[] {
  switch (contractName) {
    case "DCURewardManager":
      return [deployedAddresses.ImpactProductNFT]
    case "Submission":
      return [deployedAddresses.DCURewardManager, "10000000000000000000"]
    case "ImpactProductNFT":
      // Constructor: (address _rewardsContract)
      return [deployedAddresses.DCURewardManager]
    default:
      return []
  }
}

interface ContractInfo {
  name: string
  address: string
  constructorArgs?: any[]
}

async function verifyContract(contractInfo: ContractInfo, retryDelay: number = 0) {
  const { name, address, constructorArgs = [] } = contractInfo
  
  // Add delay if retrying
  if (retryDelay > 0) {
    console.log(`   ⏳ Waiting ${retryDelay} seconds before retry...`)
    await new Promise(resolve => setTimeout(resolve, retryDelay * 1000))
  }
  
  console.log(`\n🔍 Verifying ${name} at ${address}...`)
  
  try {
    // Try to verify using Hardhat's verify plugin
    await hre.run("verify:verify", {
      address: address,
      constructorArguments: constructorArgs,
    })
    console.log(`✅ ${name} verified successfully!`)
    return true
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    
    if (errorMsg.includes("Already Verified") || 
        errorMsg.includes("already verified") ||
        errorMsg.includes("Contract source code already verified")) {
      console.log(`ℹ️  ${name} is already verified`)
      return true
    } else if (errorMsg.includes("Too many invalid api key attempts") ||
               errorMsg.includes("rate limit") ||
               errorMsg.includes("try again later")) {
      console.error(`⚠️  ${name}: Rate limited or API key issue`)
      console.error(`   Error: ${errorMsg}`)
      console.error(`   💡 Suggestions:`)
      console.error(`   1. Wait 5-10 minutes before retrying`)
      console.error(`   2. Verify your API key is correct at https://celoscan.io/myapikey`)
      console.error(`   3. Check if your API key has sufficient quota`)
      return false
    } else if (errorMsg.includes("Invalid API Key") ||
               errorMsg.includes("api key") && errorMsg.includes("invalid")) {
      console.error(`❌ ${name}: Invalid API key`)
      console.error(`   Please check your CELOSCAN_API_KEY`)
      console.error(`   Get a new key at: https://celoscan.io/myapikey`)
      return false
    } else if (errorMsg.includes("deprecated V1 endpoint") || 
               errorMsg.includes("V2")) {
      console.error(`❌ ${name}: API version issue`)
      console.error(`   Error: ${errorMsg}`)
      console.error(`   Try manual verification:`)
      if (constructorArgs.length > 0) {
        console.error(`   npx hardhat verify --network celoSepolia ${address} ${constructorArgs.join(' ')}`)
      } else {
        console.error(`   npx hardhat verify --network celoSepolia ${address}`)
      }
      return false
    } else {
      console.error(`❌ Failed to verify ${name}:`, errorMsg)
      return false
    }
  }
}

async function main() {
  console.log("🔐 Verifying contracts on Celoscan (Celo Sepolia)...\n")

  // Check for API key
  const apiKey = process.env.CELOSCAN_API_KEY
  if (!apiKey) {
    console.error("❌ CELOSCAN_API_KEY environment variable is not set!")
    console.error("   Get your API key from: https://celoscan.io/myapikey")
    console.error("   Then run: CELOSCAN_API_KEY=your_key npx hardhat run scripts/verify-contracts.ts --network celoSepolia")
    process.exit(1)
  }

  // Load deployed addresses
  const deployedAddressesPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error("❌ deployed_addresses.json not found!")
    process.exit(1)
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf-8"))
  const network = deployedAddresses.network || "celo-sepolia"
  
  console.log(`Network: ${network}`)
  console.log(`Chain ID: ${deployedAddresses.chainId || "N/A"}\n`)

  const contractsToVerify: ContractInfo[] = [
    { name: "ImpactProductNFT", address: deployedAddresses.ImpactProductNFT, constructorArgs: getConstructorArgs("ImpactProductNFT", deployedAddresses) },
    { name: "DCURewardManager", address: deployedAddresses.DCURewardManager, constructorArgs: getConstructorArgs("DCURewardManager", deployedAddresses) },
    { name: "Submission", address: deployedAddresses.Submission, constructorArgs: getConstructorArgs("Submission", deployedAddresses) },
  ].filter(contract => contract.address)

  if (contractsToVerify.length === 0) {
    console.error("❌ No contracts found to verify!")
    process.exit(1)
  }

  console.log(`Found ${contractsToVerify.length} contracts to verify:\n`)
  contractsToVerify.forEach(contract => {
    console.log(`  - ${contract.name}: ${contract.address}`)
  })

  // Verify each contract sequentially to avoid rate limiting
  // Add delay between verifications to be respectful to API
  const results: PromiseSettledResult<boolean>[] = []
  for (let i = 0; i < contractsToVerify.length; i++) {
    const contract = contractsToVerify[i]
    // Add 2 second delay between verifications (except first one)
    const delay = i > 0 ? 2 : 0
    const result = await verifyContract(contract, delay)
    results.push({ status: "fulfilled", value: result } as PromiseFulfilledResult<boolean>)
  }

  // Summary
  console.log("\n" + "=".repeat(60))
  console.log("📊 Verification Summary")
  console.log("=".repeat(60))
  
  let successCount = 0
  let failCount = 0
  let alreadyVerifiedCount = 0

  results.forEach((result, index) => {
    const contract = contractsToVerify[index]
    if (result.status === "fulfilled" && result.value) {
      successCount++
      console.log(`✅ ${contract.name}: Verified`)
    } else {
      failCount++
      console.log(`❌ ${contract.name}: Failed`)
    }
  })

  console.log("\n" + "=".repeat(60))
  console.log(`Total: ${contractsToVerify.length}`)
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log("=".repeat(60))

  // Generate Celoscan links
  console.log("\n🔗 View contracts on Celoscan:")
  contractsToVerify.forEach(contract => {
    const explorerUrl = `https://celoscan.io/address/${contract.address}`
    console.log(`  ${contract.name}: ${explorerUrl}`)
  })

  if (failCount > 0) {
    console.log("\n⚠️  Some contracts failed to verify. Please check:")
    console.log("   1. Contract source code matches deployed bytecode")
    console.log("   2. Constructor arguments are correct")
    console.log("   3. CELOSCAN_API_KEY is valid")
    console.log("   4. Network is correct (celo-sepolia)")
    process.exit(1)
  } else {
    console.log("\n🎉 All contracts verified successfully!")
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
