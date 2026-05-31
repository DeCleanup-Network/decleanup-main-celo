/**
 * Redeploy Submission + ImpactProductNFT with atomic tx helpers while keeping DCURewardManager.
 * Preserves participation ledger (DCU points) on RewardManager; resets on-chain submission history.
 *
 * DCURewardManager.setSubmissionContract / updateNftCollection require the RewardManager owner wallet.
 * New Submission + ImpactProductNFT linking uses the deployer wallet (owner of those new contracts).
 *
 * Usage:
 *   CONFIRM_REDEPLOY_ATOMIC_TX=YES npx hardhat run contracts/scripts/redeploy-atomic-tx-stack.ts --network celo
 *
 * If deploy already happened but linking failed, finish with:
 *   NEW_SUBMISSION=0x... NEW_IMPACT_NFT=0x... npx hardhat run contracts/scripts/link-atomic-tx-stack.ts --network celo
 *
 * After deploy, set on frontend / Vercel:
 *   NEXT_PUBLIC_SUBMISSION_CONTRACT=<new Submission>
 *   NEXT_PUBLIC_IMPACT_PRODUCT_NFT=<new ImpactProductNFT>
 *   NEXT_PUBLIC_ATOMIC_CONTRACT_TX=1
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

type DeployedAddresses = {
  DCURewardManager: Address
  Submission: Address
  ImpactProductNFT: Address
  oldSubmission?: Address
  oldImpactProductNFT?: Address
  updatedAt?: string
  note?: string
  pendingRewardManagerLink?: boolean
  [key: string]: unknown
}

const DEFAULT_REWARD_WEI = 10n * 10n ** 18n

async function main() {
  if (process.env.CONFIRM_REDEPLOY_ATOMIC_TX !== "YES") {
    throw new Error(
      "Refusing to redeploy. Set CONFIRM_REDEPLOY_ATOMIC_TX=YES (replaces Submission + ImpactProductNFT addresses)."
    )
  }

  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const deployer = walletClient.account.address

  const deployedPath = path.join(__dirname, "deployed_addresses.json")
  if (!fs.existsSync(deployedPath)) {
    throw new Error("deployed_addresses.json not found")
  }

  const current = JSON.parse(fs.readFileSync(deployedPath, "utf8")) as DeployedAddresses
  const rewardManager = current.DCURewardManager
  const oldSubmission = current.Submission
  const oldImpactNft = current.ImpactProductNFT

  if (!rewardManager || !oldSubmission || !oldImpactNft) {
    throw new Error("Missing DCURewardManager, Submission, or ImpactProductNFT in deployed_addresses.json")
  }

  console.log("Deployer:", deployer)
  console.log("Keeping DCURewardManager:", rewardManager)
  console.log("Old Submission:", oldSubmission)
  console.log("Old ImpactProductNFT:", oldImpactNft)

  const newSubmission = await hre.viem.deployContract("Submission", [rewardManager, DEFAULT_REWARD_WEI], {
    account: walletClient.account,
  })
  console.log("New Submission:", newSubmission.address)

  const newImpactNft = await hre.viem.deployContract("ImpactProductNFT", [rewardManager], {
    account: walletClient.account,
  })
  console.log("New ImpactProductNFT:", newImpactNft.address)

  const rewardContract = await hre.viem.getContractAt("DCURewardManager", rewardManager, { walletClient })
  const rewardManagerOwner = (await rewardContract.read.owner()) as Address
  console.log("DCURewardManager owner:", rewardManagerOwner)

  let pendingRewardManagerLink = false

  if (rewardManagerOwner.toLowerCase() === deployer.toLowerCase()) {
    let h = await rewardContract.write.setSubmissionContract([newSubmission.address], {
      account: walletClient.account,
    })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("Linked new Submission in DCURewardManager")

    h = await rewardContract.write.updateNftCollection([newImpactNft.address], {
      account: walletClient.account,
    })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("Linked new ImpactProductNFT in DCURewardManager")
  } else {
    pendingRewardManagerLink = true
    console.warn("")
    console.warn("⚠️  Deployer is NOT DCURewardManager owner — skipping RewardManager linking.")
    console.warn("    Have the owner run link-atomic-tx-stack.ts with the owner wallet, or call:")
    console.warn(`    setSubmissionContract(${newSubmission.address})`)
    console.warn(`    updateNftCollection(${newImpactNft.address})`)
    console.warn(`    on DCURewardManager ${rewardManager}`)
    console.warn("")
  }

  let h = await newSubmission.write.setImpactProductNFT([newImpactNft.address], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked new ImpactProductNFT in Submission")

  h = await newImpactNft.write.setRewardsContract([rewardManager], { account: walletClient.account })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked DCURewardManager in new ImpactProductNFT")

  h = await newImpactNft.write.setSubmissionContract([newSubmission.address], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked new Submission in ImpactProductNFT (verifyPOI + bonus claim callback)")

  const enableImpactRewards = process.env.REDEPLOY_IMPACT_CLAIM_REWARDS_ENABLED !== "false"
  if (enableImpactRewards) {
    h = await newImpactNft.write.setImpactClaimRewardsEnabled([true], { account: walletClient.account })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("Enabled impactClaimRewardsEnabled on new ImpactProductNFT")
  }

  const updated: DeployedAddresses = {
    ...current,
    oldSubmission,
    oldImpactProductNFT: oldImpactNft,
    Submission: newSubmission.address,
    ImpactProductNFT: newImpactNft.address,
    updatedAt: new Date().toISOString(),
    pendingRewardManagerLink,
    note: pendingRewardManagerLink
      ? "Atomic tx stack deployed; RewardManager owner must run link-atomic-tx-stack.ts"
      : "Submission + ImpactProductNFT redeployed for createSubmissionWithRecyclables and safeMintWithBonus / upgradeNFTWithBonus",
  }

  fs.writeFileSync(deployedPath, JSON.stringify(updated, null, 2) + "\n")
  console.log("Updated deployed_addresses.json")

  if (pendingRewardManagerLink) {
    console.log("")
    console.log("Finish RewardManager linking (owner wallet):")
    console.log(
      `NEW_SUBMISSION=${newSubmission.address} NEW_IMPACT_NFT=${newImpactNft.address} npx hardhat run contracts/scripts/link-atomic-tx-stack.ts --network celo`
    )
  } else {
    console.log("Set NEXT_PUBLIC_ATOMIC_CONTRACT_TX=1 on frontend after updating contract env vars")
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
