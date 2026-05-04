/**
 * Setup script to configure wallet roles and addresses
 *
 * Wallets:
 * - 0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4 (decleanupnet.eth) - Community wallet
 * - 0x520e40e346ea85d72661fce3ba3f81cb2c560d84 - Main deployer/admin (fees + VERIFIER_ROLE for dApp verifier cabinet)
 * - 0x7d85fcbb505d48e6176483733b62b51704e0bf95 - Verifier (has ADMIN_ROLE for approving submissions)
 *
 * Requires: @nomicfoundation/hardhat-toolbox-viem (no hardhat-ethers — use hre.viem).
 *
 * Usage:
 *   npx hardhat run contracts/scripts/setup-roles.ts --network celoSepolia
 *
 * Optional env (override `contracts/scripts/deployed_addresses.json`):
 *   SETUP_SUBMISSION_ADDRESS=0x...   — Submission contract to link on Impact NFT and use for role setup
 *   SETUP_IMPACT_PRODUCT_NFT=0x...   — Impact Product NFT address (default: ImpactProductNFT in JSON)
 *   SKIP_IMPACT_SUBMISSION_LINK=1    — skip ImpactProductNFT.setSubmissionContract (e.g. signer is not NFT owner)
 *
 * Impact NFT link (`setSubmissionContract`) is onlyOwner. If the Hardhat signer is not the Impact NFT owner,
 * that step is skipped with an error unless SKIP_IMPACT_SUBMISSION_LINK=1 (then it is skipped quietly).
 *
 * After linking, users approved under the old Submission may still need a one-off:
 *   VERIFY_POI_ADDRESS=0x... npx hardhat run contracts/scripts/verify-poi.ts --network celoSepolia
 * (use the address that calls safeMint — often the smart account for gasless claims).
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"
import type { Address, Hex } from "viem"

const COMMUNITY_WALLET = "0x173d87dfa68aeb0e821c6021f5652b9c3a7556b4" as Address
const MAIN_DEPLOYER = "0x520e40e346ea85d72661fce3ba3f81cb2c560d84" as Address
const VERIFIER = "0x7d85fcbb505d48e6176483733b62b51704e0bf95" as Address

async function main() {
  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const signer = walletClient.account.address
  console.log("Setting up roles with account:", signer)

  const deploymentsPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deploymentsPath)) {
    console.error("❌ deployed_addresses.json not found. Please deploy contracts first.")
    process.exit(1)
  }

  const deployedAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"))
  const submissionFromEnv = process.env.SETUP_SUBMISSION_ADDRESS?.trim()
  const impactFromEnv = process.env.SETUP_IMPACT_PRODUCT_NFT?.trim()
  const skipImpactLink = process.env.SKIP_IMPACT_SUBMISSION_LINK === "1"

  const submissionAddress = (submissionFromEnv || deployedAddresses.Submission) as Address
  const dcuRewardManagerAddress = deployedAddresses.DCURewardManager as Address | undefined
  const impactNftFromJson = deployedAddresses.ImpactProductNFT as Address | undefined
  const impactNftAddress = (impactFromEnv || impactNftFromJson) as Address | undefined

  if (!submissionAddress) {
    console.error("❌ Submission contract address not found (deployed_addresses.json or SETUP_SUBMISSION_ADDRESS)")
    process.exit(1)
  }

  console.log("\n📋 Contract Addresses:")
  if (submissionFromEnv) console.log("   (SETUP_SUBMISSION_ADDRESS override)")
  if (impactFromEnv) console.log("   (SETUP_IMPACT_PRODUCT_NFT override)")
  console.log("   Submission:", submissionAddress)
  if (impactNftAddress) console.log("   ImpactProductNFT:", impactNftAddress)
  if (dcuRewardManagerAddress) {
    console.log("   DCURewardManager:", dcuRewardManagerAddress)
  }

  const submission = await hre.viem.getContractAt("Submission", submissionAddress, {
    walletClient,
  })

  const dcuRewardManager = dcuRewardManagerAddress
    ? await hre.viem.getContractAt("DCURewardManager", dcuRewardManagerAddress, {
        walletClient,
      })
    : null

  const DEFAULT_ADMIN_ROLE = (await submission.read.DEFAULT_ADMIN_ROLE()) as Hex
  const ADMIN_ROLE = (await submission.read.ADMIN_ROLE()) as Hex

  console.log("\n🔐 Setting up roles...\n")

  // 0. Submission treasury (onlyOwner — must run before transferOwnership)
  try {
    const currentTreasury = (await submission.read.treasury()) as Address
    console.log("   Current Submission treasury:", currentTreasury)
    if (currentTreasury.toLowerCase() !== MAIN_DEPLOYER.toLowerCase()) {
      console.log("   ⏳ Updating Submission treasury to main deployer...")
      const hash = await submission.write.updateTreasury([MAIN_DEPLOYER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ Submission treasury updated to:", MAIN_DEPLOYER)
    } else {
      console.log("   ✅ Submission treasury already main deployer")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error updating Submission treasury:", error instanceof Error ? error.message : error)
  }

  // 1. Transfer ownership to main deployer (if not already)
  try {
    const currentOwner = (await submission.read.owner()) as Address
    console.log("   Current owner:", currentOwner)

    if (currentOwner.toLowerCase() !== MAIN_DEPLOYER.toLowerCase()) {
      console.log("   ⏳ Transferring ownership to main deployer...")
      const hash = await submission.write.transferOwnership([MAIN_DEPLOYER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ Ownership transferred to:", MAIN_DEPLOYER)
    } else {
      console.log("   ✅ Owner is already set to main deployer")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error transferring ownership:", error instanceof Error ? error.message : error)
  }

  // 2. Grant DEFAULT_ADMIN_ROLE to main deployer (if not already)
  try {
    const hasDefaultAdmin = await submission.read.hasRole([DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER])
    if (!hasDefaultAdmin) {
      console.log("   ⏳ Granting DEFAULT_ADMIN_ROLE to main deployer...")
      const hash = await submission.write.grantRole([DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ DEFAULT_ADMIN_ROLE granted to:", MAIN_DEPLOYER)
    } else {
      console.log("   ✅ Main deployer already has DEFAULT_ADMIN_ROLE")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error granting DEFAULT_ADMIN_ROLE:", error instanceof Error ? error.message : error)
  }

  // 3. Grant ADMIN_ROLE to main deployer (if not already)
  try {
    const hasAdminRole = await submission.read.hasRole([ADMIN_ROLE, MAIN_DEPLOYER])
    if (!hasAdminRole) {
      console.log("   ⏳ Granting ADMIN_ROLE to main deployer...")
      const hash = await submission.write.grantRole([ADMIN_ROLE, MAIN_DEPLOYER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ ADMIN_ROLE granted to:", MAIN_DEPLOYER)
    } else {
      console.log("   ✅ Main deployer already has ADMIN_ROLE")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error granting ADMIN_ROLE to main deployer:", error instanceof Error ? error.message : error)
  }

  // 4. Grant VERIFIER_ROLE to verifier
  try {
    const VERIFIER_ROLE = (await submission.read.VERIFIER_ROLE()) as Hex
    const hasVerifierRole = await submission.read.hasRole([VERIFIER_ROLE, VERIFIER])
    if (!hasVerifierRole) {
      console.log("   ⏳ Granting VERIFIER_ROLE to verifier...")
      const hash = await submission.write.grantRole([VERIFIER_ROLE, VERIFIER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ VERIFIER_ROLE granted to verifier:", VERIFIER)
    } else {
      console.log("   ✅ Verifier already has VERIFIER_ROLE")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error granting VERIFIER_ROLE to verifier:", error instanceof Error ? error.message : error)
  }

  // 5. Grant VERIFIER_ROLE to main deployer (same on-chain gate as /verifier UI)
  try {
    const VERIFIER_ROLE = (await submission.read.VERIFIER_ROLE()) as Hex
    const deployerHasVerifier = await submission.read.hasRole([VERIFIER_ROLE, MAIN_DEPLOYER])
    if (!deployerHasVerifier) {
      console.log("   ⏳ Granting VERIFIER_ROLE to main deployer...")
      const hash = await submission.write.grantRole([VERIFIER_ROLE, MAIN_DEPLOYER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ VERIFIER_ROLE granted to main deployer:", MAIN_DEPLOYER)
    } else {
      console.log("   ✅ Main deployer already has VERIFIER_ROLE")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error granting VERIFIER_ROLE to main deployer:", error instanceof Error ? error.message : error)
  }

  // 6. Grant ADMIN_ROLE to verifier (optional, for additional permissions)
  try {
    const hasAdminRole = await submission.read.hasRole([ADMIN_ROLE, VERIFIER])
    if (!hasAdminRole) {
      console.log("   ⏳ Granting ADMIN_ROLE to verifier...")
      const hash = await submission.write.grantRole([ADMIN_ROLE, VERIFIER])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ ADMIN_ROLE granted to verifier:", VERIFIER)
    } else {
      console.log("   ✅ Verifier already has ADMIN_ROLE")
    }
  } catch (error: unknown) {
    console.error("   ❌ Error granting ADMIN_ROLE to verifier:", error instanceof Error ? error.message : error)
  }

  // 8. Update DCURewardManager treasury (if contract exists)
  if (dcuRewardManager) {
    try {
      const currentTreasury = (await dcuRewardManager.read.treasury()) as Address
      console.log("   DCURewardManager current treasury:", currentTreasury)

      if (currentTreasury.toLowerCase() !== MAIN_DEPLOYER.toLowerCase()) {
        console.log("   ⏳ Updating DCURewardManager treasury to main deployer...")
        const hash = await dcuRewardManager.write.updateTreasury([MAIN_DEPLOYER])
        await publicClient.waitForTransactionReceipt({ hash })
        console.log("   ✅ DCURewardManager treasury updated to:", MAIN_DEPLOYER)
        console.log("   📝 All claim fees will now go to main deployer")
      } else {
        console.log("   ✅ DCURewardManager treasury is already set to main deployer")
      }
    } catch (error: unknown) {
      console.error("   ❌ Error updating DCURewardManager treasury:", error instanceof Error ? error.message : error)
    }
  }

  const VERIFIER_ROLE_SUMMARY = (await submission.read.VERIFIER_ROLE()) as Hex

  // Ensure ImpactProductNFT.submissionContract matches current Submission (otherwise verifyPOI fails on approve and users cannot mint)
  if (impactNftAddress) {
    if (skipImpactLink) {
      console.log("\n   ⏭️  SKIP_IMPACT_SUBMISSION_LINK=1 — skipped ImpactProductNFT.setSubmissionContract check")
    } else {
      try {
        const impact = await hre.viem.getContractAt("ImpactProductNFT", impactNftAddress, {
          walletClient,
        })
        const nftOwner = (await impact.read.owner()) as Address
        const linked = (await impact.read.submissionContract()) as Address
        if (signer.toLowerCase() !== nftOwner.toLowerCase()) {
          console.error("\n❌ Impact Product NFT owner mismatch — cannot call setSubmissionContract (onlyOwner).")
          console.error("   ImpactProductNFT:", impactNftAddress)
          console.error("   NFT owner (required signer):", nftOwner)
          console.error("   Your Hardhat signer:          ", signer)
          console.error("   → Use the NFT owner key in hardhat.config, or run setSubmissionContract from that wallet.")
          console.error("   → Or set SKIP_IMPACT_SUBMISSION_LINK=1 to skip this step and continue other role setup.")
        } else if (linked.toLowerCase() !== submissionAddress.toLowerCase()) {
          console.log("\n⏳ ImpactProductNFT submissionContract mismatch (fixes POI + Impact Product mint):")
          console.log("   Stored on NFT:", linked)
          console.log("   Target Submission:", submissionAddress)
          const hash = await impact.write.setSubmissionContract([submissionAddress])
          await publicClient.waitForTransactionReceipt({ hash })
          console.log("   ✅ setSubmissionContract — new approvals will auto-verify POI")
          console.log(
            "   📝 Users approved before this fix may still need: VERIFY_POI_ADDRESS=0x... npx hardhat run contracts/scripts/verify-poi.ts --network celoSepolia"
          )
        } else {
          console.log("\n   ✅ ImpactProductNFT.submissionContract matches Submission")
        }
      } catch (error: unknown) {
        console.error(
          "   ❌ Could not sync ImpactProductNFT.setSubmissionContract:",
          error instanceof Error ? error.message : error
        )
      }
    }
  } else {
    console.log("\n   ⏭️  No ImpactProductNFT in deployed_addresses.json (and no SETUP_IMPACT_PRODUCT_NFT) — skipped link step")
  }

  console.log("\n✅ Setup Complete!\n")
  console.log("📊 Role Summary:")
  console.log("   Submission Owner:", await submission.read.owner())
  console.log("   Submission Treasury:", await submission.read.treasury())
  if (dcuRewardManager) {
    console.log("   DCURewardManager Treasury:", await dcuRewardManager.read.treasury())
  }
  console.log("   Main Deployer has DEFAULT_ADMIN_ROLE:", await submission.read.hasRole([DEFAULT_ADMIN_ROLE, MAIN_DEPLOYER]))
  console.log("   Main Deployer has ADMIN_ROLE:", await submission.read.hasRole([ADMIN_ROLE, MAIN_DEPLOYER]))
  console.log("   Main Deployer has VERIFIER_ROLE:", await submission.read.hasRole([VERIFIER_ROLE_SUMMARY, MAIN_DEPLOYER]))
  console.log("   Verifier has VERIFIER_ROLE:", await submission.read.hasRole([VERIFIER_ROLE_SUMMARY, VERIFIER]))
  console.log("   Verifier has ADMIN_ROLE:", await submission.read.hasRole([ADMIN_ROLE, VERIFIER]))
  console.log("\n💡 Wallet Configuration:")
  console.log("   📦 Community wallet (decleanupnet.eth):", COMMUNITY_WALLET)
  console.log("   👤 Main deployer:", MAIN_DEPLOYER)
  console.log("      → Receives all contract fees automatically")
  console.log("      → Has owner and admin roles")
  console.log("      → Has VERIFIER_ROLE: can use /verifier and onlyRole(VERIFIER_ROLE) txs")
  console.log("      → Can update contract settings")
  console.log("   ✅ Verifier:", VERIFIER)
  console.log("      → Can approve/reject submissions")
  console.log("      → Will see 'VERIFIER CABINET' button in dashboard")
  console.log("\n📝 Next Steps:")
  console.log("   1. Connect main deployer or verifier wallet for the VERIFIER CABINET / /verifier flows")
  console.log("   2. Impact reports and recyclables are separate onchain buckets (5 DCU each per verified submission).")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
