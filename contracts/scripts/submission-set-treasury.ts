/**
 * One-shot: Submission.updateTreasury(treasury). Caller must be Submission owner.
 *
 * Usage (PRIVATE_KEY in root .env = Submission owner, usually main deployer after setup-roles):
 *   SUBMISSION_TREASURY=0xYourTreasury npx hardhat run contracts/scripts/submission-set-treasury.ts --network celoSepolia
 *
 * Default SUBMISSION_TREASURY: same as msg.sender (owner).
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

async function main() {
  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const signer = walletClient.account.address

  const deployedPath = path.join(__dirname, "deployed_addresses.json")
  const { Submission: submissionAddress } = JSON.parse(fs.readFileSync(deployedPath, "utf8")) as {
    Submission: Address
  }

  const treasury = (process.env.SUBMISSION_TREASURY?.trim() || signer) as Address

  const submission = await hre.viem.getContractAt("Submission", submissionAddress, { walletClient })
  const owner = (await submission.read.owner()) as Address
  if (owner.toLowerCase() !== signer.toLowerCase()) {
    throw new Error(
      `PRIVATE_KEY account ${signer} is not Submission owner ${owner}. Use owner key or transferOwnership first.`
    )
  }

  console.log("Submission:", submissionAddress)
  console.log("Owner (signer):", signer)
  console.log("Setting treasury to:", treasury)

  const hash = await submission.write.updateTreasury([treasury], { account: walletClient.account })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log("Done. Tx:", hash)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
