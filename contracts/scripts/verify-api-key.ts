/**
 * Test Celoscan API key validity
 * 
 * This script helps verify that your Celoscan API key is valid
 * before attempting to verify contracts.
 * 
 * Usage:
 *   CELOSCAN_API_KEY=your_key npx hardhat run scripts/verify-api-key.ts --network celoSepolia
 */

import hre from "hardhat"

async function main() {
  console.log("🔑 Testing Celoscan API key...\n")

  const apiKey = process.env.CELOSCAN_API_KEY
  if (!apiKey) {
    console.error("❌ CELOSCAN_API_KEY environment variable is not set!")
    console.error("   Get your API key from: https://celoscan.io/myapikey")
    process.exit(1)
  }

  console.log(`API Key: ${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}`)
  console.log(`Network: celoSepolia\n`)

  // Try to verify a known contract address to test the API key
  // We'll use a simple contract or just test the API connection
  const testAddress = "0xa282c26245d116aB5600fBF7901f2E4827c16B7A" // DCUToken
  
  try {
    console.log("Testing API key by attempting to check contract status...")
    // Try a simple verification check
    await hre.run("verify:verify", {
      address: testAddress,
      constructorArguments: [],
    })
    console.log("✅ API key appears to be valid!")
  } catch (error: any) {
    const errorMsg = error.message || String(error)
    
    if (errorMsg.includes("Already Verified") || 
        errorMsg.includes("already verified")) {
      console.log("✅ API key is valid! (Contract is already verified)")
    } else if (errorMsg.includes("Invalid API Key") ||
               errorMsg.includes("api key") && errorMsg.includes("invalid")) {
      console.error("❌ Invalid API key!")
      console.error("   Please check your API key at: https://celoscan.io/myapikey")
      console.error("   Make sure you copied the full key correctly")
      process.exit(1)
    } else if (errorMsg.includes("Too many invalid api key attempts")) {
      console.error("⚠️  Rate limited - too many failed attempts")
      console.error("   Please wait 5-10 minutes before trying again")
      console.error("   Your API key might be correct, but Celoscan has rate-limited requests")
      process.exit(1)
    } else {
      // Other errors (like wrong constructor args) mean API key is probably valid
      console.log("✅ API key appears to be valid!")
      console.log(`   (Error was: ${errorMsg.substring(0, 100)}...)`)
      console.log("   This error is expected - we're just testing the API key")
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
