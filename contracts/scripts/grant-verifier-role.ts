import hardhat from "hardhat";
import { getContract, Address } from "viem";
import * as fs from "fs";
import * as path from "path";

/**
 * Script to grant VERIFIER_ROLE to an address
 * 
 * Usage: npx hardhat run scripts/grant-verifier-role.ts --network celoSepolia
 */
async function main() {
  const [deployer] = await hardhat.viem.getWalletClients();
  console.log("Granting VERIFIER_ROLE with account:", deployer.account.address);

  // Verifier address to grant role to
  const VERIFIER_ADDRESS = (process.env.VERIFIER_ADDRESS || "0x7D85fCbB505D48E6176483733b62b51704e0bF95") as Address;
  
  // Get contract address from deployment - check multiple locations
  let deployedAddresses: any = null;
  let submissionAddress: Address | null = null;
  
  // Try scripts directory first
  const scriptsDeploymentsPath = path.join(__dirname, "deployed_addresses.json");
  if (fs.existsSync(scriptsDeploymentsPath)) {
    deployedAddresses = JSON.parse(fs.readFileSync(scriptsDeploymentsPath, "utf8"));
    submissionAddress = deployedAddresses.Submission as Address;
  }
  
  // If not found, try Ignition deployments (for chain-11142220 = Celo Sepolia)
  if (!submissionAddress) {
    const ignitionDeploymentsPath = path.join(__dirname, "..", "ignition", "deployments", "chain-11142220", "deployed_addresses.json");
    if (fs.existsSync(ignitionDeploymentsPath)) {
      deployedAddresses = JSON.parse(fs.readFileSync(ignitionDeploymentsPath, "utf8"));
      // Ignition uses format "DCUContracts#Submission"
      submissionAddress = (deployedAddresses["DCUContracts#Submission"] || deployedAddresses.Submission) as Address;
    }
  }
  
  // Also check env var as fallback
  if (!submissionAddress && process.env.SUBMISSION_CONTRACT) {
    submissionAddress = process.env.SUBMISSION_CONTRACT as Address;
  }
  
  if (!submissionAddress) {
    console.error("❌ Submission contract address not found.");
    console.error("   Checked:");
    console.error("   - contracts/scripts/deployed_addresses.json");
    console.error("   - contracts/ignition/deployments/chain-11142220/deployed_addresses.json");
    console.error("   - SUBMISSION_CONTRACT env var");
    console.error("   Please deploy contracts first or set SUBMISSION_CONTRACT env var.");
    process.exit(1);
  }


  console.log("\n📋 Contract Addresses:");
  console.log("   Submission:", submissionAddress);
  console.log("   Verifier Address:", VERIFIER_ADDRESS);

  // Get contract ABI
  const submissionArtifact = await hardhat.artifacts.readArtifact("contracts/contracts/Submission.sol:Submission");
  const publicClient = await hardhat.viem.getPublicClient();

  // Connect to contract
  const submission = getContract({
    address: submissionAddress,
    abi: submissionArtifact.abi,
    client: {
      public: publicClient,
      wallet: deployer,
    },
  });

  // Get VERIFIER_ROLE constant
  const VERIFIER_ROLE = await submission.read.VERIFIER_ROLE();
  console.log("\n🔐 VERIFIER_ROLE:", VERIFIER_ROLE);

  // Check if address already has the role
  const hasRole = await submission.read.hasRole([VERIFIER_ROLE, VERIFIER_ADDRESS]);
  
  if (hasRole) {
    console.log("   ✅ Address already has VERIFIER_ROLE");
    return;
  }

  // Grant VERIFIER_ROLE
  try {
    console.log("   ⏳ Granting VERIFIER_ROLE...");
    const hash = await submission.write.grantRole([VERIFIER_ROLE, VERIFIER_ADDRESS]);
    console.log("   📝 Transaction hash:", hash);
    
    // Wait for transaction receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("   ✅ VERIFIER_ROLE granted successfully!");
    console.log("   📦 Block number:", receipt.blockNumber);
    console.log("   🔗 Transaction:", `https://celo-sepolia.blockscout.com/tx/${hash}`);
    
    // Wait a moment for state to update
    console.log("   ⏳ Waiting for state to update...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verify
    const hasRoleAfter = await submission.read.hasRole([VERIFIER_ROLE, VERIFIER_ADDRESS]);
    if (hasRoleAfter) {
      console.log("   ✅ Verification: Address now has VERIFIER_ROLE");
    } else {
      console.warn("   ⚠️  Immediate verification failed, but transaction was successful.");
      console.warn("   This might be a timing issue. Please check the transaction on the block explorer.");
      console.warn("   Or wait a few seconds and try accessing the verifier dashboard again.");
    }
  } catch (error: any) {
    console.error("   ❌ Error granting VERIFIER_ROLE:", error.message);
    if (error.shortMessage) {
      console.error("   Short message:", error.shortMessage);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

