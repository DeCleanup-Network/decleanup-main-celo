/**
 * Turn on ImpactProductNFT.impactClaimRewardsEnabled so mint/upgrade calls
 * DCURewardManager.rewardImpactProductClaim (per-level DCU in claimRewardsAmount).
 *
 * Usage (repo root, signer must be NFT owner). Use the network where the NFT was deployed:
 *   Celo Sepolia: CONFIRM_ENABLE_IMPACT_CLAIM_REWARDS=YES npx hardhat run contracts/scripts/enable-impact-claim-rewards.ts --network celoSepolia
 *   Celo mainnet: ... --network celo   (IMPACT_PRODUCT_NFT must be the mainnet NFT address)
 *
 * Optional env:
 *   IMPACT_PRODUCT_NFT=0x...  — override address (default: ImpactProductNFT in contracts/scripts/deployed_addresses.json)
 *   IMPACT_CLAIM_REWARDS=false — set flag to false instead of true
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import { type Address, zeroAddress } from "viem"

type DeployedAddresses = {
  ImpactProductNFT?: Address
  [key: string]: unknown
}

async function main() {
  if (process.env.CONFIRM_ENABLE_IMPACT_CLAIM_REWARDS !== "YES") {
    throw new Error(
      "Refusing to change impact claim rewards flag. Set CONFIRM_ENABLE_IMPACT_CLAIM_REWARDS=YES."
    )
  }

  const wantEnabled = process.env.IMPACT_CLAIM_REWARDS !== "false"

  const deployedPath = path.join(__dirname, "deployed_addresses.json")
  const fromEnv = process.env.IMPACT_PRODUCT_NFT?.trim()
  let nftAddress: Address | undefined
  if (fromEnv) {
    nftAddress = fromEnv as Address
  } else if (fs.existsSync(deployedPath)) {
    const j = JSON.parse(fs.readFileSync(deployedPath, "utf8")) as DeployedAddresses
    nftAddress = j.ImpactProductNFT
  }

  if (!nftAddress) {
    throw new Error("Impact NFT address missing: set IMPACT_PRODUCT_NFT or maintain deployed_addresses.json")
  }

  const [walletClient] = await hre.viem.getWalletClients()
  const publicClient = await hre.viem.getPublicClient()
  const signer = walletClient.account.address
  const chainId = await publicClient.getChainId()

  const bytecode = await publicClient.getBytecode({ address: nftAddress })
  if (!bytecode || bytecode === "0x") {
    const hint =
      chainId === 42220
        ? "You are on Celo mainnet (42220). Sepolia test NFTs live on celoSepolia (11142220) — use --network celoSepolia or set IMPACT_PRODUCT_NFT to your mainnet ImpactProductNFT."
        : chainId === 11142220
          ? "No contract at this address on Celo Sepolia. Check IMPACT_PRODUCT_NFT and deployed_addresses.json."
          : `No contract at this address on chainId ${chainId}. Fix --network or IMPACT_PRODUCT_NFT.`
    throw new Error(
      `No contract bytecode at ${nftAddress} (chainId ${chainId}). ${hint}`
    )
  }

  console.log("chainId:", chainId, "| target:", nftAddress)

  const nft = await hre.viem.getContractAt("ImpactProductNFT", nftAddress, {
    walletClient,
  })

  const [owner, current, rewards] = await Promise.all([
    nft.read.owner(),
    nft.read.impactClaimRewardsEnabled(),
    nft.read.rewardsContract(),
  ])

  console.log("Signer:", signer)
  console.log("ImpactProductNFT:", nftAddress)
  console.log("Owner:", owner)
  console.log("impactClaimRewardsEnabled (before):", current)
  console.log("rewardsContract:", rewards)

  if (owner.toLowerCase() !== signer.toLowerCase()) {
    throw new Error(`Signer is not NFT owner. Owner=${owner}, signer=${signer}`)
  }

  if (wantEnabled && rewards === zeroAddress) {
    console.warn("⚠️ rewardsContract is zero — rewardImpactProductClaim will still not run until rewardsContract is set.")
  }

  if (current === wantEnabled) {
    console.log(`Already impactClaimRewardsEnabled=${wantEnabled}; nothing to do.`)
    return
  }

  const hash = await nft.write.setImpactClaimRewardsEnabled([wantEnabled], {
    account: walletClient.account,
  })
  await publicClient.waitForTransactionReceipt({ hash })
  console.log(`✅ Set impactClaimRewardsEnabled=${wantEnabled}. Tx:`, hash)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
