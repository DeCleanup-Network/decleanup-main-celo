/**
 * Grant VERIFIER_ROLE on the Robinhood testnet Submission contract.
 * Uses ethers so hardhat-viem does not need this chain in its registry.
 */

import hre from "hardhat"
import fs from "fs"
import path from "path"
import { ethers } from "ethers"

const ROBINHOOD_TESTNET_CHAIN_ID = 46630

function requirePrivateKey(): string {
  const raw = process.env.PRIVATE_KEY?.trim()
  if (!raw) throw new Error("PRIVATE_KEY is required")
  return raw.startsWith("0x") ? raw : `0x${raw}`
}

function parseTargets(): string[] {
  const raw =
    process.env.VERIFIER_ADDRESSES?.trim() ||
    process.env.VERIFIER_ADDRESS?.trim() ||
    ""
  if (!raw) throw new Error("Set VERIFIER_ADDRESS or VERIFIER_ADDRESSES")
  return [...new Set(raw.split(",").map((p) => p.trim()).filter(Boolean))]
}

async function main() {
  const targets = parseTargets()
  const rpc =
    process.env.ROBINHOOD_TESTNET_RPC_URL || "https://rpc.testnet.chain.robinhood.com"
  const provider = new ethers.JsonRpcProvider(rpc, ROBINHOOD_TESTNET_CHAIN_ID, {
    staticNetwork: true,
  })
  const wallet = new ethers.Wallet(requirePrivateKey(), provider)

  const deployedPath = path.join(__dirname, "deployed_addresses.robinhoodchain-testnet.json")
  const deployed = JSON.parse(fs.readFileSync(deployedPath, "utf8")) as { Submission?: string }
  const submissionAddress =
    process.env.SETUP_SUBMISSION_ADDRESS?.trim() || deployed.Submission
  if (!submissionAddress) throw new Error("Submission address not found")

  const artifact = await hre.artifacts.readArtifact("Submission")
  const submission = new ethers.Contract(submissionAddress, artifact.abi, wallet)
  const VERIFIER_ROLE = await submission.VERIFIER_ROLE()

  console.log("Submission:", submissionAddress)
  console.log("Signer:", wallet.address)

  for (const target of targets) {
    const has = await submission.hasRole(VERIFIER_ROLE, target)
    if (has) {
      console.log("Already granted", target)
      continue
    }
    const tx = await submission.grantRole(VERIFIER_ROLE, target)
    await tx.wait()
    console.log("Granted", target, tx.hash)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
