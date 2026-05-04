import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

type DeployedAddresses = {
  /** @deprecated Removed from core stack; may still exist in older deployed_addresses.json */
  DCUToken?: Address
  DCURewardManager: Address
  Submission: Address
  ImpactProductNFT: Address
  oldDCURewardManager?: Address
  oldSubmission?: Address
  updatedAt?: string
  note?: string
  [key: string]: unknown
}

const DEFAULT_REWARD_WEI = 10n * 10n ** 18n

async function main() {
  if (process.env.CONFIRM_REDEPLOY !== "YES") {
    throw new Error(
      "Refusing to redeploy. Set CONFIRM_REDEPLOY=YES to acknowledge state reset for Submission/RewardManager."
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
  const impactProductNFT = current.ImpactProductNFT
  const oldRewardManager = current.DCURewardManager
  const oldSubmission = current.Submission

  if (!impactProductNFT || !oldRewardManager || !oldSubmission) {
    throw new Error("Missing required addresses in deployed_addresses.json")
  }

  console.log("Deploying with account:", deployer)
  console.log("Using ImpactProductNFT:", impactProductNFT)
  console.log("Old DCURewardManager:", oldRewardManager)
  console.log("Old Submission:", oldSubmission)

  const newRewardManager = await hre.viem.deployContract("DCURewardManager", [impactProductNFT])
  console.log("New DCURewardManager deployed:", newRewardManager.address)

  const newSubmission = await hre.viem.deployContract("Submission", [
    newRewardManager.address,
    DEFAULT_REWARD_WEI,
  ])
  console.log("New Submission deployed:", newSubmission.address)

  const setSubmissionHash = await newRewardManager.write.setSubmissionContract([newSubmission.address], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: setSubmissionHash })
  console.log("Linked new Submission in new DCURewardManager")

  const impactNftContract = await hre.viem.getContractAt("ImpactProductNFT", impactProductNFT, {
    walletClient,
  })
  const setRewardsHash = await impactNftContract.write.setRewardsContract([newRewardManager.address])
  await publicClient.waitForTransactionReceipt({ hash: setRewardsHash })
  console.log("Linked new DCURewardManager in ImpactProductNFT")

  const setImpactProductHash = await newSubmission.write.setImpactProductNFT([impactProductNFT], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: setImpactProductHash })
  console.log("Linked ImpactProductNFT in new Submission")

  // Required: safeMint checks verifiedPOI; approveSubmission calls verifyPOI from Submission — Impact NFT must trust THIS Submission address.
  const setSubmissionOnImpactHash = await impactNftContract.write.setSubmissionContract([newSubmission.address], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash: setSubmissionOnImpactHash })
  console.log("Linked new Submission in ImpactProductNFT (authorized caller for verifyPOI)")

  const updated: DeployedAddresses = {
    ...current,
    oldDCURewardManager: oldRewardManager,
    oldSubmission: oldSubmission,
    DCURewardManager: newRewardManager.address,
    Submission: newSubmission.address,
    updatedAt: new Date().toISOString(),
    note: "Submission and DCURewardManager redeployed for separate 5+5 onchain report/recyclables buckets",
  }

  fs.writeFileSync(deployedPath, JSON.stringify(updated, null, 2) + "\n")
  console.log("Updated deployed_addresses.json")
  console.log("New DCURewardManager:", updated.DCURewardManager)
  console.log("New Submission:", updated.Submission)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
