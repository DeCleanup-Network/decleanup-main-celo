import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy RecyclablesReward contract and wire it into Submission
 * 
 * Prerequisites:
 * - Submission contract must be deployed
 * - cRECY token address (or use placeholder for testing)
 * 
 * Usage:
 * SUBMISSION_CONTRACT=0x... npx hardhat run scripts/deploy-recyclables.ts --network celoSepolia
 */

async function main() {
  console.log("Deploying RecyclablesReward contract...\n");

  // Get deployed addresses from Ignition deployment
  // You can also pass these as env vars
  const submissionAddress = 
    process.env.SUBMISSION_CONTRACT ||
    process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT ||
    "0x0000000000000000000000000000000000000000";

  // cRECY token address - for Sepolia, use a placeholder or existing token
  // On mainnet, this will be the real cRECY token address (0x34C11A932853Ae24E845Ad4B633E3cEf91afE583)
  const cRecyTokenAddress = 
    process.env.CRECY_TOKEN_ADDRESS ||
    "0x0000000000000000000000000000000000000000"; // Placeholder for testing

  if (submissionAddress === "0x0000000000000000000000000000000000000000") {
    console.error("❌ SUBMISSION_CONTRACT not set!");
    console.error("   Set it in .env or pass as env var:");
    console.error("   SUBMISSION_CONTRACT=0x... npx hardhat run scripts/deploy-recyclables.ts --network celoSepolia");
    process.exit(1);
  }

  if (cRecyTokenAddress === "0x0000000000000000000000000000000000000000") {
    console.warn("⚠️  CRECY_TOKEN_ADDRESS not set, using placeholder address");
    console.warn("   This contract will work but rewards won't be claimable until cRECY is set");
    console.warn("   On mainnet, use: 0x34C11A932853Ae24E845Ad4B633E3cEf91afE583\n");
  }

  console.log("Configuration:");
  console.log(`  Submission Contract: ${submissionAddress}`);
  console.log(`  cRECY Token: ${cRecyTokenAddress}\n`);

  const [deployer] = await hre.viem.getWalletClients();
  const publicClient = await hre.viem.getPublicClient();
  
  console.log(`Deploying with account: ${deployer.account.address}`);
  const balance = await publicClient.getBalance({ address: deployer.account.address });
  console.log(`Account balance: ${balance / BigInt(10 ** 18)} CELO\n`);

  // Deploy RecyclablesReward
  console.log("Deploying RecyclablesReward...");
  const recyclablesReward = await hre.viem.deployContract(
    "contracts/contracts/RecyclablesReward.sol:RecyclablesReward",
    [
      cRecyTokenAddress as `0x${string}`,
      submissionAddress as `0x${string}`,
    ]
  );

  const recyclablesRewardAddress = recyclablesReward.address;
  console.log(`✅ RecyclablesReward deployed at: ${recyclablesRewardAddress}\n`);

  // Wire RecyclablesReward into Submission contract
  console.log("Wiring RecyclablesReward into Submission contract...");
  const submission = await hre.viem.getContractAt(
    "Submission",
    submissionAddress as `0x${string}`
  );
  
  try {
    const tx = await submission.write.updateRecyclablesRewardContract([
      recyclablesRewardAddress as `0x${string}`,
    ], {
      account: deployer.account,
    });

    console.log(`✅ Transaction sent: ${tx}`);
    console.log(`   Waiting for confirmation...`);
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
    
    console.log(`✅ RecyclablesReward wired into Submission!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed}\n`);
  } catch (error: any) {
    console.error("❌ Failed to wire RecyclablesReward into Submission:");
    console.error(`   ${error.message}`);
    console.error("\n   You may need to call this manually:");
    console.error(`   submission.updateRecyclablesRewardContract("${recyclablesRewardAddress}")`);
    process.exit(1);
  }

  // Save deployment info
  const deploymentInfo = {
    RecyclablesReward: recyclablesRewardAddress,
    Submission: submissionAddress,
    cRecyToken: cRecyTokenAddress,
    network: hre.network.name,
    chainId: publicClient.chain.id,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.join(__dirname, "recyclables-deployment.json");
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log(`📝 Deployment info saved to: ${outputPath}\n`);

  console.log("✅ Deployment complete!");
  console.log("\nNext steps:");
  console.log("1. Add to frontend/.env.local:");
  console.log(`   NEXT_PUBLIC_RECYCLABLES_CONTRACT=${recyclablesRewardAddress}`);
  console.log("\n2. On mainnet:");
  console.log("   - Transfer 5000 cRECY from community wallet to RecyclablesReward contract");
  console.log("   - Call syncReserve() on RecyclablesReward contract");
  if (cRecyTokenAddress === "0x0000000000000000000000000000000000000000") {
    console.log("   - Update cRECY token address to: 0x34C11A932853Ae24E845Ad4B633E3cEf91afE583");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

