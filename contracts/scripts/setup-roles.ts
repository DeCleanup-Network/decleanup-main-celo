import { HardhatRuntimeEnvironment } from "hardhat/types";
import hardhat from "hardhat";

/**
 * Setup script to configure wallet roles and addresses
 * 
 * Wallets:
 * - 0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4 (decleanupnet.eth) - Community wallet (has 5000 cRECY reserve)
 * - 0x520e40e346ea85d72661fce3ba3f81cb2c560d84 - Main deployer/admin (receives contract fees)
 * - 0x7d85fcbb505d48e6176483733b62b51704e0bf95 - Verifier (has ADMIN_ROLE for approving submissions)
 */
async function main() {
  const { ethers } = hardhat as any;
  const [deployer] = await ethers.getSigners();
  console.log("Setting up roles with account:", deployer.address);

  // Wallet addresses
  const COMMUNITY_WALLET = "0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4";
  const MAIN_DEPLOYER = "0x520e40e346ea85d72661fce3ba3f81cb2c560d84";
  const VERIFIER = "0x7d85fcbb505d48e6176483733b62b51704e0bf95";

  // Get contract addresses from deployment
  const deploymentsPath = require("path").join(__dirname, "deployed_addresses.json");
  const fs = require("fs");
  
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ deployed_addresses.json not found. Please deploy contracts first.");
    process.exit(1);
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const submissionAddress = deployedAddresses.Submission;
  const dcuRewardManagerAddress = deployedAddresses.DCURewardManager;

  if (!submissionAddress) {
    console.error("❌ Submission contract address not found in deployed_addresses.json");
    process.exit(1);
  }

  console.log("\n📋 Contract Addresses:");
  console.log("   Submission:", submissionAddress);
  if (dcuRewardManagerAddress) {
    console.log("   DCURewardManager:", dcuRewardManagerAddress);
  }

  // Connect to contracts
  const Submission = await ethers.getContractFactory("Submission");
  const submission = Submission.attach(submissionAddress);
  
  let dcuRewardManager = null;
  if (dcuRewardManagerAddress) {
    const DCURewardManager = await ethers.getContractFactory("DCURewardManager");
    dcuRewardManager = DCURewardManager.attach(dcuRewardManagerAddress);
  }

  // ADMIN_ROLE hash (must match contract)
  const ADMIN_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("ADMIN_ROLE"));
  const DEFAULT_ADMIN_ROLE = ethers.constants.HashZero; // 0x0000000000000000000000000000000000000000000000000000000000000000

  console.log("\n🔐 Setting up roles...\n");

  // 1. Transfer ownership to main deployer (if not already)
  try {
    const currentOwner = await submission.owner();
    console.log("   Current owner:", currentOwner);
    
    if (currentOwner.toLowerCase() !== MAIN_DEPLOYER.toLowerCase()) {
      console.log("   ⏳ Transferring ownership to main deployer...");
      const tx = await submission.transferOwnership(MAIN_DEPLOYER);
      await tx.wait();
      console.log("   ✅ Ownership transferred to:", MAIN_DEPLOYER);
    } else {
      console.log("   ✅ Owner is already set to main deployer");
    }
  } catch (error: any) {
    console.error("   ❌ Error transferring ownership:", error.message);
  }

  // 2. Grant DEFAULT_ADMIN_ROLE to main deployer (if not already)
  try {
    const hasDefaultAdmin = await submission.hasRole(DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER);
    if (!hasDefaultAdmin) {
      console.log("   ⏳ Granting DEFAULT_ADMIN_ROLE to main deployer...");
      const tx = await submission.grantRole(DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER);
      await tx.wait();
      console.log("   ✅ DEFAULT_ADMIN_ROLE granted to:", MAIN_DEPLOYER);
    } else {
      console.log("   ✅ Main deployer already has DEFAULT_ADMIN_ROLE");
    }
  } catch (error: any) {
    console.error("   ❌ Error granting DEFAULT_ADMIN_ROLE:", error.message);
  }

  // 3. Grant ADMIN_ROLE to main deployer (if not already)
  try {
    const hasAdminRole = await submission.hasRole(ADMIN_ROLE, MAIN_DEPLOYER);
    if (!hasAdminRole) {
      console.log("   ⏳ Granting ADMIN_ROLE to main deployer...");
      const tx = await submission.grantRole(ADMIN_ROLE, MAIN_DEPLOYER);
      await tx.wait();
      console.log("   ✅ ADMIN_ROLE granted to:", MAIN_DEPLOYER);
    } else {
      console.log("   ✅ Main deployer already has ADMIN_ROLE");
    }
  } catch (error: any) {
    console.error("   ❌ Error granting ADMIN_ROLE to main deployer:", error.message);
  }

  // 4. Grant VERIFIER_ROLE to verifier
  try {
    const VERIFIER_ROLE = await submission.VERIFIER_ROLE();
    const hasVerifierRole = await submission.hasRole(VERIFIER_ROLE, VERIFIER);
    if (!hasVerifierRole) {
      console.log("   ⏳ Granting VERIFIER_ROLE to verifier...");
      const tx = await submission.grantRole(VERIFIER_ROLE, VERIFIER);
      await tx.wait();
      console.log("   ✅ VERIFIER_ROLE granted to verifier:", VERIFIER);
    } else {
      console.log("   ✅ Verifier already has VERIFIER_ROLE");
    }
  } catch (error: any) {
    console.error("   ❌ Error granting VERIFIER_ROLE to verifier:", error.message);
  }

  // 5. Grant ADMIN_ROLE to verifier (optional, for additional permissions)
  try {
    const hasAdminRole = await submission.hasRole(ADMIN_ROLE, VERIFIER);
    if (!hasAdminRole) {
      console.log("   ⏳ Granting ADMIN_ROLE to verifier...");
      const tx = await submission.grantRole(ADMIN_ROLE, VERIFIER);
      await tx.wait();
      console.log("   ✅ ADMIN_ROLE granted to verifier:", VERIFIER);
    } else {
      console.log("   ✅ Verifier already has ADMIN_ROLE");
    }
  } catch (error: any) {
    console.error("   ❌ Error granting ADMIN_ROLE to verifier:", error.message);
  }

  // 6. Update treasury address to main deployer (fees go here)
  try {
    const currentTreasury = await submission.treasury();
    console.log("   Current treasury:", currentTreasury);
    
    if (currentTreasury.toLowerCase() !== MAIN_DEPLOYER.toLowerCase()) {
      console.log("   ⏳ Updating treasury address to main deployer...");
      const tx = await submission.updateTreasury(MAIN_DEPLOYER);
      await tx.wait();
      console.log("   ✅ Treasury updated to:", MAIN_DEPLOYER);
      console.log("   📝 All submission fees will now go to main deployer");
    } else {
      console.log("   ✅ Treasury is already set to main deployer");
    }
  } catch (error: any) {
    console.error("   ❌ Error updating treasury:", error.message);
  }

  // 7. Update DCURewardManager treasury (if contract exists)
  if (dcuRewardManager) {
    try {
      const currentTreasury = await dcuRewardManager.treasury();
      console.log("   DCURewardManager current treasury:", currentTreasury);
      
      if (currentTreasury.toLowerCase() !== MAIN_DEPLOYER.toLowerCase()) {
        console.log("   ⏳ Updating DCURewardManager treasury to main deployer...");
        const tx = await dcuRewardManager.updateTreasury(MAIN_DEPLOYER);
        await tx.wait();
        console.log("   ✅ DCURewardManager treasury updated to:", MAIN_DEPLOYER);
        console.log("   📝 All claim fees will now go to main deployer");
      } else {
        console.log("   ✅ DCURewardManager treasury is already set to main deployer");
      }
    } catch (error: any) {
      console.error("   ❌ Error updating DCURewardManager treasury:", error.message);
    }
  }

  // Summary
  console.log("\n✅ Setup Complete!\n");
  console.log("📊 Role Summary:");
  console.log("   Submission Owner:", await submission.owner());
  console.log("   Submission Treasury:", await submission.treasury());
  if (dcuRewardManager) {
    console.log("   DCURewardManager Treasury:", await dcuRewardManager.treasury());
  }
  console.log("   Main Deployer has DEFAULT_ADMIN_ROLE:", await submission.hasRole(DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER));
  console.log("   Main Deployer has ADMIN_ROLE:", await submission.hasRole(ADMIN_ROLE, MAIN_DEPLOYER));
  console.log("   Verifier has ADMIN_ROLE:", await submission.hasRole(ADMIN_ROLE, VERIFIER));
  console.log("\n💡 Wallet Configuration:");
  console.log("   📦 Community wallet (decleanupnet.eth):", COMMUNITY_WALLET);
  console.log("      → Holds 5000 cRECY reserve");
  console.log("      → Transfer cRECY to RecyclablesReward contract, then call syncReserve()");
  console.log("   👤 Main deployer:", MAIN_DEPLOYER);
  console.log("      → Receives all contract fees automatically");
  console.log("      → Has owner and admin roles");
  console.log("      → Can update contract settings");
  console.log("   ✅ Verifier:", VERIFIER);
  console.log("      → Can approve/reject submissions");
  console.log("      → Will see 'VERIFIER CABINET' button in dashboard");
  console.log("\n📝 Next Steps:");
  console.log("   1. Transfer 5000 cRECY from community wallet to RecyclablesReward contract");
  console.log("   2. Call syncReserve() on RecyclablesReward contract");
  console.log("   3. Connect verifier wallet to see the VERIFIER CABINET button");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

