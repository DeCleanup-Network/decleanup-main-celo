/**
 * Diagnostic script to check API key configuration
 * 
 * This helps debug why API key verification is failing
 * 
 * Usage:
 *   CELOSCAN_API_KEY=your_key npx hardhat run scripts/check-api-key-config.ts --network celoSepolia
 */

import hre from "hardhat"

async function main() {
  console.log("🔍 Checking API Key Configuration...\n")

  // Check environment variable
  const envApiKey = process.env.CELOSCAN_API_KEY
  console.log("1. Environment Variable Check:")
  if (envApiKey) {
    console.log(`   ✅ CELOSCAN_API_KEY is set`)
    console.log(`   📝 Length: ${envApiKey.length} characters`)
    console.log(`   📝 Preview: ${envApiKey.substring(0, 8)}...${envApiKey.substring(envApiKey.length - 4)}`)
    
    // Check for common issues
    if (envApiKey.includes(" ")) {
      console.log(`   ⚠️  WARNING: API key contains spaces!`)
    }
    if (envApiKey.length < 20) {
      console.log(`   ⚠️  WARNING: API key seems too short (expected ~30-40 chars)`)
    }
    if (envApiKey.length > 100) {
      console.log(`   ⚠️  WARNING: API key seems too long`)
    }
  } else {
    console.log(`   ❌ CELOSCAN_API_KEY is NOT set!`)
    console.log(`   💡 Set it with: export CELOSCAN_API_KEY=your_key`)
    console.log(`   💡 Or add to .env file in project root`)
    process.exit(1)
  }

  // Check Hardhat config
  console.log("\n2. Hardhat Config Check:")
  const config = hre.config
  if (config.etherscan) {
    console.log(`   ✅ Etherscan config found`)
    
    if (typeof config.etherscan.apiKey === "string") {
      const configApiKey = config.etherscan.apiKey
      console.log(`   ✅ API key in config (string format)`)
      if (configApiKey) {
        console.log(`   📝 Config API key: ${configApiKey.substring(0, 8)}...${configApiKey.substring(configApiKey.length - 4)}`)
        
        // Compare with env
        if (configApiKey === envApiKey) {
          console.log(`   ✅ Config API key matches environment variable`)
        } else {
          console.log(`   ⚠️  WARNING: Config API key differs from environment variable!`)
        }
      } else {
        console.log(`   ❌ Config API key is empty!`)
      }
    } else if (typeof config.etherscan.apiKey === "object") {
      console.log(`   ✅ API key in config (object format)`)
      const apiKeyObj = config.etherscan.apiKey as any
      console.log(`   📝 Keys: ${Object.keys(apiKeyObj).join(", ")}`)
    } else {
      console.log(`   ❌ API key format unexpected: ${typeof config.etherscan.apiKey}`)
    }

    // Check custom chains
    if (config.etherscan.customChains) {
      console.log(`   ✅ Custom chains configured: ${config.etherscan.customChains.length}`)
      const celoSepoliaChain = config.etherscan.customChains.find(
        (chain: any) => chain.network === "celoSepolia"
      )
      if (celoSepoliaChain) {
        console.log(`   ✅ celoSepolia custom chain found`)
        console.log(`   📝 API URL: ${celoSepoliaChain.urls?.apiURL}`)
        console.log(`   📝 Browser URL: ${celoSepoliaChain.urls?.browserURL}`)
      } else {
        console.log(`   ❌ celoSepolia custom chain NOT found!`)
      }
    } else {
      console.log(`   ⚠️  No custom chains configured`)
    }
  } else {
    console.log(`   ❌ No etherscan config found!`)
  }

  // Check network
  console.log("\n3. Network Check:")
  const network = await hre.network
  console.log(`   📝 Network name: ${network.name}`)
  console.log(`   📝 Chain ID: ${network.config.chainId}`)
  
  if (network.name === "celoSepolia") {
    console.log(`   ✅ Network is celoSepolia`)
  } else {
    console.log(`   ⚠️  Network is ${network.name}, expected celoSepolia`)
  }

  // Test API key format
  console.log("\n4. API Key Format Check:")
  const apiKeyPattern = /^[A-Za-z0-9]+$/
  if (apiKeyPattern.test(envApiKey)) {
    console.log(`   ✅ API key format looks valid (alphanumeric)`)
  } else {
    console.log(`   ⚠️  API key contains non-alphanumeric characters`)
    console.log(`   💡 Make sure there are no quotes, spaces, or special characters`)
  }

  console.log("\n" + "=".repeat(60))
  console.log("📋 Summary:")
  console.log("=".repeat(60))
  console.log("If all checks pass, your API key should work.")
  console.log("If verification still fails:")
  console.log("  1. Double-check the API key at https://celoscan.io/myapikey")
  console.log("  2. Make sure you copied the FULL key (no truncation)")
  console.log("  3. Wait 5-10 minutes if you got rate-limited")
  console.log("  4. Try generating a NEW API key if the current one is invalid")
  console.log("\n")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
