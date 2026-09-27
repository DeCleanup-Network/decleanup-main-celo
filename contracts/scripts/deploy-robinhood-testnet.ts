/**
 * Deploy the Celo-style core stack to Robinhood Chain testnet (46630).
 * Uses ethers so we are not blocked by hardhat-viem missing this chain.
 *
 * Writes contracts/scripts/deployed_addresses.robinhoodchain-testnet.json
 * and does not touch Celo production addresses.
 *
 *   CONFIRM_DEPLOY_CORE_STACK=YES npx hardhat run contracts/scripts/deploy-robinhood-testnet.ts --network robinhoodchain-testnet
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import { ethers } from "ethers"

const DEFAULT_REWARD_WEI = 10n * 10n ** 18n
const ROBINHOOD_TESTNET_CHAIN_ID = 46630
const ZERO = "0x0000000000000000000000000000000000000000"

function requirePrivateKey(): string {
  const raw = process.env.PRIVATE_KEY?.trim()
  if (!raw) throw new Error("PRIVATE_KEY is required")
  return raw.startsWith("0x") ? raw : `0x${raw}`
}

async function main() {
  if (process.env.CONFIRM_DEPLOY_CORE_STACK !== "YES") {
    throw new Error("Refusing to deploy. Set CONFIRM_DEPLOY_CORE_STACK=YES")
  }

  const rpc =
    process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com"
  const provider = new ethers.JsonRpcProvider(rpc, ROBINHOOD_TESTNET_CHAIN_ID, {
    staticNetwork: true,
  })
  const wallet = new ethers.Wallet(requirePrivateKey(), provider)
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== ROBINHOOD_TESTNET_CHAIN_ID) {
    throw new Error(`Expected chain ${ROBINHOOD_TESTNET_CHAIN_ID}, got ${network.chainId}`)
  }

  console.log("Deployer:", wallet.address)
  console.log("Network: robinhoodchain-testnet chainId:", ROBINHOOD_TESTNET_CHAIN_ID)
  console.log("Balance:", ethers.formatEther(await provider.getBalance(wallet.address)), "ETH")

  const deploy = async (name: string, args: unknown[]) => {
    const artifact = await hre.artifacts.readArtifact(name)
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)
    const contract = await factory.deploy(...args)
    await contract.waitForDeployment()
    const address = await contract.getAddress()
    console.log(`${name}:`, address)
    return contract
  }

  const rewardManager = await deploy("DCURewardManager", [ZERO])
  const impactNft = await deploy("ImpactProductNFT", [await rewardManager.getAddress()])

  let tx = await rewardManager.updateNftCollection(await impactNft.getAddress())
  await tx.wait()
  console.log("Linked ImpactProductNFT in DCURewardManager")

  const submission = await deploy("Submission", [await rewardManager.getAddress(), DEFAULT_REWARD_WEI])

  tx = await rewardManager.setSubmissionContract(await submission.getAddress())
  await tx.wait()
  console.log("Linked Submission in DCURewardManager")

  tx = await submission.setImpactProductNFT(await impactNft.getAddress())
  await tx.wait()
  console.log("Linked ImpactProductNFT in Submission")

  tx = await impactNft.setSubmissionContract(await submission.getAddress())
  await tx.wait()
  console.log("Linked Submission in ImpactProductNFT")

  const outPath = path.join(__dirname, "deployed_addresses.robinhoodchain-testnet.json")
  const out = {
    DCURewardManager: await rewardManager.getAddress(),
    ImpactProductNFT: await impactNft.getAddress(),
    Submission: await submission.getAddress(),
    HypercertMinterUUPS: "0xC6a7eC8B1695023D3EE74ADC29972cD341AbA3Ea",
    network: "robinhoodchain-testnet",
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    deployer: wallet.address,
    deployedAt: new Date().toISOString(),
    note: "Robinhood Chain testnet demo stack. Celo-style Submission + official HypercertMinter UUPS.",
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n")
  console.log("\nWrote", outPath)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
