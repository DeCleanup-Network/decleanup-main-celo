/**
 * Greenfield deploy: DCURewardManager → ImpactProductNFT → link NFT → Submission → link all.
 * Does not deploy ClaimVault / CDCUToken (use deploy-cdcu.ts after this).
 *
 * Requires root `.env` with PRIVATE_KEY for --network celoSepolia|celo.
 *
 * Optional env:
 *   DEPLOY_IMPACT_CLAIM_REWARDS_ENABLED=false — skip `setImpactClaimRewardsEnabled(true)` on ImpactProductNFT (default: enable).
 *
 * Usage:
 *   CONFIRM_DEPLOY_CORE_STACK=YES npx hardhat run contracts/scripts/deploy-core-stack.ts --network celoSepolia
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

const DEFAULT_REWARD_WEI = 10n * 10n ** 18n

type DeployedAddresses = {
  DCURewardManager: Address
  ImpactProductNFT: Address
  Submission: Address
  network: string
  chainId: number
  deployedAt: string
  updatedAt: string
  note: string
  ClaimVault?: Address
  CDCUToken?: Address
  oldDCURewardManager?: Address
  oldSubmission?: Address
  oldImpactProductNFT?: Address
  [key: string]: unknown
}

async function main() {
  if (process.env.CONFIRM_DEPLOY_CORE_STACK !== "YES") {
    throw new Error(
      "Refusing to deploy. Set CONFIRM_DEPLOY_CORE_STACK=YES (writes new addresses to contracts/scripts/deployed_addresses.json)."
    )
  }

  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const deployer = walletClient.account.address
  const chainId = await publicClient.getChainId()

  console.log("Deployer:", deployer)
  console.log("Network:", hre.network.name, "chainId:", chainId)

  const placeholderNft = "0x0000000000000000000000000000000000000000" as Address
  const rewardManager = await hre.viem.deployContract("DCURewardManager", [placeholderNft], {
    account: walletClient.account,
  })
  console.log("DCURewardManager:", rewardManager.address)

  const impactNft = await hre.viem.deployContract("ImpactProductNFT", [rewardManager.address], {
    account: walletClient.account,
  })
  console.log("ImpactProductNFT:", impactNft.address)

  let h = await rewardManager.write.updateNftCollection([impactNft.address], { account: walletClient.account })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked ImpactProductNFT in DCURewardManager (updateNftCollection)")

  const submission = await hre.viem.deployContract(
    "Submission",
    [rewardManager.address, DEFAULT_REWARD_WEI],
    { account: walletClient.account }
  )
  console.log("Submission:", submission.address)

  h = await rewardManager.write.setSubmissionContract([submission.address], { account: walletClient.account })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked Submission in DCURewardManager")

  const submissionC = await hre.viem.getContractAt("Submission", submission.address, { walletClient })
  h = await submissionC.write.setImpactProductNFT([impactNft.address], { account: walletClient.account })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked ImpactProductNFT in Submission")

  const impactC = await hre.viem.getContractAt("ImpactProductNFT", impactNft.address, { walletClient })
  h = await impactC.write.setSubmissionContract([submission.address], { account: walletClient.account })
  await publicClient.waitForTransactionReceipt({ hash: h })
  console.log("Linked Submission in ImpactProductNFT (verifyPOI caller)")

  const enableImpactClaimRewards = process.env.DEPLOY_IMPACT_CLAIM_REWARDS_ENABLED !== "false"
  if (enableImpactClaimRewards) {
    h = await impactC.write.setImpactClaimRewardsEnabled([true], { account: walletClient.account })
    await publicClient.waitForTransactionReceipt({ hash: h })
    console.log("ImpactProductNFT: impactClaimRewardsEnabled=true (mint/upgrade → rewardImpactProductClaim)")
  } else {
    console.log("Skipped impactClaimRewardsEnabled (DEPLOY_IMPACT_CLAIM_REWARDS_ENABLED=false)")
  }

  const deployedPath = path.join(__dirname, "deployed_addresses.json")
  let previous: Record<string, unknown> = {}
  if (fs.existsSync(deployedPath)) {
    try {
      previous = JSON.parse(fs.readFileSync(deployedPath, "utf8")) as Record<string, unknown>
    } catch {
      /* ignore */
    }
  }

  const rest = { ...previous }
  delete rest.ClaimVault
  delete rest.CDCUToken
  delete rest.cdcuDeployedAt
  delete rest.DCUToken

  const out: DeployedAddresses = {
    ...rest,
    DCURewardManager: rewardManager.address,
    ImpactProductNFT: impactNft.address,
    Submission: submission.address,
    network: hre.network.name,
    chainId,
    deployedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    note: "Greenfield core stack (DCURewardManager + ImpactProductNFT + Submission); $cDCU via deploy-cdcu.ts",
  } as DeployedAddresses

  fs.writeFileSync(deployedPath, JSON.stringify(out, null, 2) + "\n")
  console.log("\nWrote", deployedPath)

  console.log("\n--- Next: $cDCU (new token + vault, or skip if reusing existing) ---")
  console.log(
    "  AUTHORIZED_SIGNER_ADDRESS=0xYourBackendSigner npx hardhat run contracts/scripts/deploy-cdcu.ts --network " +
      hre.network.name
  )
  console.log("\n--- Then: verifier roles (optional) ---")
  console.log("  npx hardhat run contracts/scripts/setup-roles.ts --network " + hre.network.name)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
