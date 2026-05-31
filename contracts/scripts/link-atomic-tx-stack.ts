/**
 * Finish linking after redeploy-atomic-tx-stack.ts (or recover from a partial deploy).
 *
 * Env (required if not in deployed_addresses.json yet):
 *   NEW_SUBMISSION=0x...
 *   NEW_IMPACT_NFT=0x...
 *
 * Runs whatever the connected wallet is authorized to do:
 * - RewardManager owner → setSubmissionContract + updateNftCollection
 * - New contract owner → cross-link Submission ↔ ImpactProductNFT (idempotent)
 *
 * Usage:
 *   NEW_SUBMISSION=0x2f36... NEW_IMPACT_NFT=0x97fa... npx hardhat run contracts/scripts/link-atomic-tx-stack.ts --network celo
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

type DeployedAddresses = {
  DCURewardManager: Address
  Submission: Address
  ImpactProductNFT: Address
  pendingRewardManagerLink?: boolean
  updatedAt?: string
  note?: string
  [key: string]: unknown
}

async function main() {
  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const caller = walletClient.account.address

  const deployedPath = path.join(__dirname, "deployed_addresses.json")
  const current = fs.existsSync(deployedPath)
    ? (JSON.parse(fs.readFileSync(deployedPath, "utf8")) as DeployedAddresses)
    : ({} as DeployedAddresses)

  const rewardManager = current.DCURewardManager
  const newSubmission = (process.env.NEW_SUBMISSION?.trim() || current.Submission) as Address | undefined
  const newImpactNft = (process.env.NEW_IMPACT_NFT?.trim() || current.ImpactProductNFT) as Address | undefined

  if (!rewardManager) throw new Error("DCURewardManager missing in deployed_addresses.json")
  if (!newSubmission || !newImpactNft) {
    throw new Error("Set NEW_SUBMISSION and NEW_IMPACT_NFT (or update deployed_addresses.json first)")
  }

  console.log("Caller:", caller)
  console.log("DCURewardManager:", rewardManager)
  console.log("New Submission:", newSubmission)
  console.log("New ImpactProductNFT:", newImpactNft)

  const rewardContract = await hre.viem.getContractAt("DCURewardManager", rewardManager, { walletClient })
  const submissionContract = await hre.viem.getContractAt("Submission", newSubmission, { walletClient })
  const impactNft = await hre.viem.getContractAt("ImpactProductNFT", newImpactNft, { walletClient })

  const rewardManagerOwner = (await rewardContract.read.owner()) as Address
  const submissionOwner = (await submissionContract.read.owner()) as Address
  const impactOwner = (await impactNft.read.owner()) as Address

  console.log("DCURewardManager owner:", rewardManagerOwner)
  console.log("Submission owner:", submissionOwner)
  console.log("ImpactProductNFT owner:", impactOwner)

  let didAnything = false

  if (caller.toLowerCase() === rewardManagerOwner.toLowerCase()) {
    let h = await rewardContract.write.setSubmissionContract([newSubmission], {
      account: walletClient.account,
    })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("✅ DCURewardManager.setSubmissionContract")

    h = await rewardContract.write.updateNftCollection([newImpactNft], { account: walletClient.account })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("✅ DCURewardManager.updateNftCollection")
    didAnything = true
  } else {
    console.log("⏭️  Skipping RewardManager links (caller is not owner)")
  }

  if (caller.toLowerCase() === submissionOwner.toLowerCase()) {
    const h = await submissionContract.write.setImpactProductNFT([newImpactNft], {
      account: walletClient.account,
    })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("✅ Submission.setImpactProductNFT")
    didAnything = true
  }

  if (caller.toLowerCase() === impactOwner.toLowerCase()) {
    let h = await impactNft.write.setRewardsContract([rewardManager], { account: walletClient.account })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("✅ ImpactProductNFT.setRewardsContract")

    h = await impactNft.write.setSubmissionContract([newSubmission], { account: walletClient.account })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("✅ ImpactProductNFT.setSubmissionContract")

    if (process.env.REDEPLOY_IMPACT_CLAIM_REWARDS_ENABLED !== "false") {
      h = await impactNft.write.setImpactClaimRewardsEnabled([true], { account: walletClient.account })
      await publicClient.waitForTransactionReceipt({ hash: h })
      console.log("✅ ImpactProductNFT.setImpactClaimRewardsEnabled(true)")
    }
    didAnything = true
  }

  if (!didAnything) {
    throw new Error(
      `Caller ${caller} is not authorized for any linking step. Use RewardManager owner (${rewardManagerOwner}) or new contract owner wallet.`
    )
  }

  const onChainSub = (await rewardContract.read.submissionContract()) as Address
  const onChainNft = (await rewardContract.read.nftCollection()) as Address
  const rmLinked =
    onChainSub.toLowerCase() === newSubmission.toLowerCase() &&
    onChainNft.toLowerCase() === newImpactNft.toLowerCase()

  if (fs.existsSync(deployedPath)) {
    const updated: DeployedAddresses = {
      ...current,
      Submission: newSubmission,
      ImpactProductNFT: newImpactNft,
      pendingRewardManagerLink: !rmLinked,
      updatedAt: new Date().toISOString(),
      note: rmLinked
        ? "Atomic tx stack fully linked"
        : "Cross-links done; RewardManager owner still must setSubmissionContract + updateNftCollection",
    }
    fs.writeFileSync(deployedPath, JSON.stringify(updated, null, 2) + "\n")
    console.log("Updated deployed_addresses.json")
  }

  if (!rmLinked) {
    console.warn("")
    console.warn("⚠️  RewardManager still points at old contracts until owner runs this script:")
    console.warn(`    RewardManager owner: ${rewardManagerOwner}`)
    console.warn(`    Current submissionContract: ${onChainSub}`)
    console.warn(`    Current nftCollection: ${onChainNft}`)
  } else {
    console.log("")
    console.log("✅ All links complete. Update frontend env:")
    console.log(`NEXT_PUBLIC_SUBMISSION_CONTRACT=${newSubmission}`)
    console.log(`NEXT_PUBLIC_IMPACT_PRODUCT_NFT=${newImpactNft}`)
    console.log("NEXT_PUBLIC_ATOMIC_CONTRACT_TX=1")
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
