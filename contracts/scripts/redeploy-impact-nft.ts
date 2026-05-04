import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

type DeployedAddresses = {
  DCUToken?: Address
  DCURewardManager: Address
  Submission: Address
  ImpactProductNFT: Address
  oldImpactProductNFT?: Address
  updatedAt?: string
  note?: string
  [key: string]: unknown
}

/**
 * Optional: `REDEPLOY_IMPACT_CLAIM_REWARDS_ENABLED=false` to leave impactClaimRewardsEnabled off after redeploy.
 * Default when unset: true (production — mint/upgrade triggers rewardImpactProductClaim when rewardsContract is set).
 */

async function main() {
  if (process.env.CONFIRM_REDEPLOY_NFT !== "YES") {
    throw new Error(
      "Refusing to redeploy ImpactProductNFT. Set CONFIRM_REDEPLOY_NFT=YES to acknowledge address replacement."
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
  const submission = current.Submission
  const oldImpactNft = current.ImpactProductNFT

  if (!rewardManager || !submission || !oldImpactNft) {
    throw new Error("Missing required addresses in deployed_addresses.json")
  }

  console.log("Redeploying with account:", deployer)
  console.log("Using DCURewardManager:", rewardManager)
  console.log("Using Submission:", submission)
  console.log("Old ImpactProductNFT:", oldImpactNft)

  const newImpactNft = await hre.viem.deployContract("ImpactProductNFT", [rewardManager], {
    account: walletClient.account,
  })
  console.log("New ImpactProductNFT deployed:", newImpactNft.address)

  const submissionContract = await hre.viem.getContractAt("Submission", submission, {
    walletClient,
  })
  const rewardContract = await hre.viem.getContractAt("DCURewardManager", rewardManager, {
    walletClient,
  })

  const setSubmissionHash = await newImpactNft.write.setSubmissionContract([submission], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: setSubmissionHash })
  console.log("Linked Submission in new ImpactProductNFT")

  const setImpactHash = await submissionContract.write.setImpactProductNFT([newImpactNft.address], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: setImpactHash })
  console.log("Linked new ImpactProductNFT in Submission")

  const setRewardNftHash = await rewardContract.write.updateNftCollection([newImpactNft.address], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: setRewardNftHash })
  console.log("Linked new ImpactProductNFT in DCURewardManager")

  // Production default: accrue per-level DCU via rewardImpactProductClaim when user mints/upgrades.
  // Opt out with REDEPLOY_IMPACT_CLAIM_REWARDS_ENABLED=false (e.g. staging only-NFT policy).
  const impactClaimRewardsEnabled = process.env.REDEPLOY_IMPACT_CLAIM_REWARDS_ENABLED !== "false"
  const impactRewardsHash = await newImpactNft.write.setImpactClaimRewardsEnabled([impactClaimRewardsEnabled], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: impactRewardsHash })
  console.log(`Set impactClaimRewardsEnabled=${impactClaimRewardsEnabled} (REDEPLOY_IMPACT_CLAIM_REWARDS_ENABLED=false to disable)`)

  const updated: DeployedAddresses = {
    ...current,
    oldImpactProductNFT: oldImpactNft,
    ImpactProductNFT: newImpactNft.address,
    updatedAt: new Date().toISOString(),
    note: `ImpactProductNFT redeployed; impactClaimRewardsEnabled=${impactClaimRewardsEnabled}`,
  }

  fs.writeFileSync(deployedPath, JSON.stringify(updated, null, 2) + "\n")
  console.log("Updated deployed_addresses.json")
  console.log("New ImpactProductNFT:", updated.ImpactProductNFT)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
