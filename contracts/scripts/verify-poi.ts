/**
 * Manually verify POI on ImpactProductNFT (owner-only).
 * Use when a user was approved while Impact NFT pointed at the wrong Submission contract.
 *
 * Usage:
 *   VERIFY_POI_ADDRESS=0x... npx hardhat run contracts/scripts/verify-poi.ts --network celoSepolia
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import type { Address } from "viem"

async function main() {
  const raw = (process.env.VERIFY_POI_ADDRESS || "").trim()
  if (!raw || !raw.startsWith("0x")) {
    throw new Error("Set VERIFY_POI_ADDRESS=0x... to the submitter smart account or EOA.")
  }
  const user = raw as Address

  const deploymentsPath = path.join(__dirname, "deployed_addresses.json")
  const deployed = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"))
  const impact = deployed.ImpactProductNFT as Address
  if (!impact) throw new Error("ImpactProductNFT missing in deployed_addresses.json")

  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()

  const nft = await hre.viem.getContractAt("ImpactProductNFT", impact, { walletClient })
  const owner = (await nft.read.owner()) as Address
  if (owner.toLowerCase() !== walletClient.account.address.toLowerCase()) {
    throw new Error(
      `Signer ${walletClient.account.address} is not ImpactProductNFT owner (${owner}). Use owner key.`
    )
  }

  const before = await nft.read.verifiedPOI([user])
  console.log("verifiedPOI before:", before, user)

  const hash = await nft.write.verifyPOI([user])
  await publicClient.waitForTransactionReceipt({ hash })

  const after = await nft.read.verifiedPOI([user])
  console.log("verifiedPOI after:", after, "tx:", hash)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
