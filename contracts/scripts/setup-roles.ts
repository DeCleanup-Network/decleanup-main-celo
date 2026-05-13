/**
 * Hand admin/owner/treasury over from the deployer hot key to the production Safe,
 * and grant verifier roles. Idempotent — safe to re-run.
 *
 * Required env (no fallbacks for safety):
 *   ADMIN_SAFE=0x...                     Production multisig. Becomes:
 *                                          - Owner of Submission, ImpactProductNFT, DCURewardManager
 *                                          - Holder of DEFAULT_ADMIN_ROLE + ADMIN_ROLE on Submission
 *
 * Optional env:
 *   TREASURY_ADDRESS=0x...               Defaults to ADMIN_SAFE. Receives Submission/DCURewardManager fees.
 *   VERIFIER_ADDRESS=0x...               Granted VERIFIER_ROLE on Submission (initial human verifier).
 *   GRANT_VERIFIER_ADMIN_ROLE=YES        Also grant ADMIN_ROLE to VERIFIER_ADDRESS (default: NO).
 *   SETUP_SUBMISSION_ADDRESS=0x...       Override Submission address from deployed_addresses.json.
 *   SETUP_IMPACT_PRODUCT_NFT=0x...       Override ImpactProductNFT address.
 *   SETUP_DCU_REWARD_MANAGER=0x...       Override DCURewardManager address.
 *   SKIP_IMPACT_SUBMISSION_LINK=1        Skip ImpactProductNFT.setSubmissionContract step.
 *   SKIP_OWNERSHIP_TRANSFER=1            Skip handing ownership to ADMIN_SAFE (for partial runs).
 *   RENOUNCE_DEPLOYER_ADMIN=YES          After Safe is admin, renounce deployer's DEFAULT_ADMIN_ROLE.
 *                                        ⚠️ Only run this after confirming the Safe can sign a tx.
 *
 * Usage (mainnet):
 *   ADMIN_SAFE=0x7eB8... \
 *   VERIFIER_ADDRESS=0x7D85... \
 *     npx hardhat run contracts/scripts/setup-roles.ts --network celo
 *
 * Then later, after Safe is verified working:
 *   ADMIN_SAFE=0x7eB8... RENOUNCE_DEPLOYER_ADMIN=YES \
 *     npx hardhat run contracts/scripts/setup-roles.ts --network celo
 */

import hre from "hardhat"
import * as fs from "fs"
import * as path from "path"
import { isAddress } from "viem"
import type { Address, Hex } from "viem"

function requireEnvAddress(name: string, value: string | undefined): Address {
  if (!value || !isAddress(value)) {
    throw new Error(`Missing or invalid env ${name}. Provide a 0x-prefixed checksummed address.`)
  }
  return value as Address
}

function optionalEnvAddress(name: string, value: string | undefined): Address | undefined {
  if (!value) return undefined
  if (!isAddress(value)) throw new Error(`Invalid env ${name}: ${value}`)
  return value as Address
}

async function main() {
  const ADMIN_SAFE = requireEnvAddress("ADMIN_SAFE", process.env.ADMIN_SAFE?.trim())
  const TREASURY_ADDRESS =
    optionalEnvAddress("TREASURY_ADDRESS", process.env.TREASURY_ADDRESS?.trim()) ?? ADMIN_SAFE
  const VERIFIER_ADDRESS = optionalEnvAddress("VERIFIER_ADDRESS", process.env.VERIFIER_ADDRESS?.trim())
  const grantVerifierAdmin = process.env.GRANT_VERIFIER_ADMIN_ROLE === "YES"
  const skipImpactLink = process.env.SKIP_IMPACT_SUBMISSION_LINK === "1"
  const skipOwnershipTransfer = process.env.SKIP_OWNERSHIP_TRANSFER === "1"
  const renounceDeployerAdmin = process.env.RENOUNCE_DEPLOYER_ADMIN === "YES"

  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const deployer = walletClient.account.address as Address
  const chainId = await publicClient.getChainId()

  console.log("Network:", hre.network.name, "chainId:", chainId)
  console.log("Deployer (current owner):", deployer)
  console.log("Admin Safe (target owner):", ADMIN_SAFE)
  console.log("Treasury:", TREASURY_ADDRESS)
  console.log("Verifier:", VERIFIER_ADDRESS ?? "(none)")
  console.log("Renounce deployer admin:", renounceDeployerAdmin)

  const deploymentsPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error("deployed_addresses.json not found. Deploy contracts first.")
  }
  const deployedAddresses = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"))

  const submissionAddress = (process.env.SETUP_SUBMISSION_ADDRESS?.trim() ||
    deployedAddresses.Submission) as Address | undefined
  const impactNftAddress = (process.env.SETUP_IMPACT_PRODUCT_NFT?.trim() ||
    deployedAddresses.ImpactProductNFT) as Address | undefined
  const dcuRewardManagerAddress = (process.env.SETUP_DCU_REWARD_MANAGER?.trim() ||
    deployedAddresses.DCURewardManager) as Address | undefined

  if (!submissionAddress) throw new Error("Submission address not found.")

  console.log("\n📋 Contracts:")
  console.log("   Submission:", submissionAddress)
  if (impactNftAddress) console.log("   ImpactProductNFT:", impactNftAddress)
  if (dcuRewardManagerAddress) console.log("   DCURewardManager:", dcuRewardManagerAddress)

  const submission = await hre.viem.getContractAt("Submission", submissionAddress, { walletClient })
  const dcuRewardManager = dcuRewardManagerAddress
    ? await hre.viem.getContractAt("DCURewardManager", dcuRewardManagerAddress, { walletClient })
    : null
  const impact = impactNftAddress
    ? await hre.viem.getContractAt("ImpactProductNFT", impactNftAddress, { walletClient })
    : null

  const DEFAULT_ADMIN_ROLE = (await submission.read.DEFAULT_ADMIN_ROLE()) as Hex
  const ADMIN_ROLE = (await submission.read.ADMIN_ROLE()) as Hex
  const VERIFIER_ROLE = (await submission.read.VERIFIER_ROLE()) as Hex

  // -------------------------------------------------------------------------
  // Renounce-only mode: skip everything else and renounce deployer's admin role.
  // -------------------------------------------------------------------------
  if (renounceDeployerAdmin) {
    console.log("\n🔻 RENOUNCE_DEPLOYER_ADMIN=YES")
    const safeIsAdmin = await submission.read.hasRole([DEFAULT_ADMIN_ROLE, ADMIN_SAFE])
    if (!safeIsAdmin) {
      throw new Error(
        `Refusing to renounce: ADMIN_SAFE (${ADMIN_SAFE}) does not yet hold DEFAULT_ADMIN_ROLE on Submission.`
      )
    }
    const deployerHasAdmin = await submission.read.hasRole([DEFAULT_ADMIN_ROLE, deployer])
    if (!deployerHasAdmin) {
      console.log("   ✅ Deployer already does not hold DEFAULT_ADMIN_ROLE; nothing to do.")
    } else {
      console.log("   ⏳ Renouncing deployer's DEFAULT_ADMIN_ROLE on Submission…")
      const hash = await submission.write.renounceRole([DEFAULT_ADMIN_ROLE, deployer])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ Deployer DEFAULT_ADMIN_ROLE renounced.")
    }
    const deployerHasAdminRoleCustom = await submission.read.hasRole([ADMIN_ROLE, deployer])
    if (deployerHasAdminRoleCustom) {
      console.log("   ⏳ Renouncing deployer's ADMIN_ROLE on Submission…")
      const hash = await submission.write.renounceRole([ADMIN_ROLE, deployer])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ Deployer ADMIN_ROLE renounced.")
    }
    console.log("\n✅ Renounce step complete.")
    return
  }

  // -------------------------------------------------------------------------
  // 1. Treasury: Submission
  // -------------------------------------------------------------------------
  console.log("\n💰 Treasury")
  try {
    const current = (await submission.read.treasury()) as Address
    if (current.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
      console.log("   ⏳ Submission.updateTreasury →", TREASURY_ADDRESS)
      const hash = await submission.write.updateTreasury([TREASURY_ADDRESS])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log("   ✅ Submission treasury set")
    } else {
      console.log("   ✅ Submission treasury already correct")
    }
  } catch (e) {
    console.error("   ❌ Submission treasury:", e instanceof Error ? e.message : e)
  }

  // -------------------------------------------------------------------------
  // 2. Treasury: DCURewardManager
  // -------------------------------------------------------------------------
  if (dcuRewardManager) {
    try {
      const current = (await dcuRewardManager.read.treasury()) as Address
      if (current.toLowerCase() !== TREASURY_ADDRESS.toLowerCase()) {
        console.log("   ⏳ DCURewardManager.updateTreasury →", TREASURY_ADDRESS)
        const hash = await dcuRewardManager.write.updateTreasury([TREASURY_ADDRESS])
        await publicClient.waitForTransactionReceipt({ hash })
        console.log("   ✅ DCURewardManager treasury set")
      } else {
        console.log("   ✅ DCURewardManager treasury already correct")
      }
    } catch (e) {
      console.error("   ❌ DCURewardManager treasury:", e instanceof Error ? e.message : e)
    }
  }

  // -------------------------------------------------------------------------
  // 3. Roles on Submission (still as deployer; deployer still holds DEFAULT_ADMIN_ROLE).
  // -------------------------------------------------------------------------
  console.log("\n🔐 Roles on Submission")

  const grantIfMissing = async (role: Hex, target: Address, label: string) => {
    const has = await submission.read.hasRole([role, target])
    if (has) {
      console.log(`   ✅ ${label} already granted to ${target}`)
      return
    }
    console.log(`   ⏳ grantRole(${label}) → ${target}`)
    const hash = await submission.write.grantRole([role, target])
    await publicClient.waitForTransactionReceipt({ hash })
    console.log(`   ✅ ${label} granted`)
  }

  try {
    await grantIfMissing(DEFAULT_ADMIN_ROLE, ADMIN_SAFE, "DEFAULT_ADMIN_ROLE → Safe")
    await grantIfMissing(ADMIN_ROLE, ADMIN_SAFE, "ADMIN_ROLE → Safe")
    // Deployer keeps VERIFIER_ROLE so the dApp /verifier flow still works from a hot wallet day 1.
    await grantIfMissing(VERIFIER_ROLE, deployer, "VERIFIER_ROLE → Deployer")
    if (VERIFIER_ADDRESS) {
      await grantIfMissing(VERIFIER_ROLE, VERIFIER_ADDRESS, "VERIFIER_ROLE → Verifier")
      if (grantVerifierAdmin) {
        await grantIfMissing(ADMIN_ROLE, VERIFIER_ADDRESS, "ADMIN_ROLE → Verifier")
      }
    }
  } catch (e) {
    console.error("   ❌ grantRole:", e instanceof Error ? e.message : e)
  }

  // -------------------------------------------------------------------------
  // 4. Impact Product NFT ↔ Submission link (must run before transferring NFT ownership).
  // -------------------------------------------------------------------------
  if (impact) {
    if (skipImpactLink) {
      console.log("\n⏭️  SKIP_IMPACT_SUBMISSION_LINK=1 — skipped setSubmissionContract")
    } else {
      try {
        const nftOwner = (await impact.read.owner()) as Address
        const linked = (await impact.read.submissionContract()) as Address
        if (nftOwner.toLowerCase() !== deployer.toLowerCase()) {
          console.error(
            `\n❌ ImpactProductNFT.owner()=${nftOwner} (deployer is ${deployer}) — cannot call setSubmissionContract here.`
          )
        } else if (linked.toLowerCase() !== submissionAddress.toLowerCase()) {
          console.log("\n⏳ ImpactProductNFT.setSubmissionContract →", submissionAddress)
          const hash = await impact.write.setSubmissionContract([submissionAddress])
          await publicClient.waitForTransactionReceipt({ hash })
          console.log("   ✅ Linked")
        } else {
          console.log("\n   ✅ ImpactProductNFT.submissionContract already correct")
        }
      } catch (e) {
        console.error("   ❌ setSubmissionContract:", e instanceof Error ? e.message : e)
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Transfer Ownable ownership of all three contracts to ADMIN_SAFE.
  //    Done LAST so all onlyOwner setup above succeeds while deployer is still owner.
  // -------------------------------------------------------------------------
  console.log("\n👑 Ownership → Safe")

  if (skipOwnershipTransfer) {
    console.log("   ⏭️  SKIP_OWNERSHIP_TRANSFER=1 — leaving ownership with deployer")
  } else {
    const transferOwnership = async (
      contract: { read: { owner: () => Promise<unknown> }; write: { transferOwnership: (args: [Address]) => Promise<Hex> } },
      label: string
    ) => {
      const current = (await contract.read.owner()) as Address
      if (current.toLowerCase() === ADMIN_SAFE.toLowerCase()) {
        console.log(`   ✅ ${label}.owner already Safe`)
        return
      }
      if (current.toLowerCase() !== deployer.toLowerCase()) {
        console.error(
          `   ❌ ${label}.owner=${current} — deployer cannot transfer. Re-run from current owner key.`
        )
        return
      }
      console.log(`   ⏳ ${label}.transferOwnership → ${ADMIN_SAFE}`)
      const hash = await contract.write.transferOwnership([ADMIN_SAFE])
      await publicClient.waitForTransactionReceipt({ hash })
      console.log(`   ✅ ${label}.owner = Safe`)
    }

    try {
      await transferOwnership(submission as any, "Submission")
    } catch (e) {
      console.error("   ❌ Submission.transferOwnership:", e instanceof Error ? e.message : e)
    }
    if (impact) {
      try {
        await transferOwnership(impact as any, "ImpactProductNFT")
      } catch (e) {
        console.error("   ❌ ImpactProductNFT.transferOwnership:", e instanceof Error ? e.message : e)
      }
    }
    if (dcuRewardManager) {
      try {
        await transferOwnership(dcuRewardManager as any, "DCURewardManager")
      } catch (e) {
        console.error("   ❌ DCURewardManager.transferOwnership:", e instanceof Error ? e.message : e)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log("\n📊 Summary")
  console.log("   Submission.owner:", await submission.read.owner())
  console.log("   Submission.treasury:", await submission.read.treasury())
  if (impact) console.log("   ImpactProductNFT.owner:", await impact.read.owner())
  if (dcuRewardManager) {
    console.log("   DCURewardManager.owner:", await dcuRewardManager.read.owner())
    console.log("   DCURewardManager.treasury:", await dcuRewardManager.read.treasury())
  }
  console.log("   Safe DEFAULT_ADMIN_ROLE:", await submission.read.hasRole([DEFAULT_ADMIN_ROLE, ADMIN_SAFE]))
  console.log("   Safe ADMIN_ROLE:", await submission.read.hasRole([ADMIN_ROLE, ADMIN_SAFE]))
  console.log("   Deployer VERIFIER_ROLE:", await submission.read.hasRole([VERIFIER_ROLE, deployer]))
  if (VERIFIER_ADDRESS) {
    console.log("   Verifier VERIFIER_ROLE:", await submission.read.hasRole([VERIFIER_ROLE, VERIFIER_ADDRESS]))
  }
  console.log("   Deployer DEFAULT_ADMIN_ROLE (still admin):", await submission.read.hasRole([DEFAULT_ADMIN_ROLE, deployer]))

  console.log("\n📝 Next:")
  console.log("   1) Test an admin tx from the Safe (e.g. proposing updateTreasury) before renouncing.")
  console.log("   2) Then re-run with RENOUNCE_DEPLOYER_ADMIN=YES to fully hand off.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
