/**
 * Deploy $rDCU on Robinhood Chain testnet and mint a demo supply.
 *
 *   CONFIRM_DEPLOY_RDCU=YES npx hardhat run contracts/scripts/deploy-robinhood-rdcu.ts --network robinhoodchain-testnet
 */

import hre from 'hardhat'
import fs from 'fs'
import path from 'path'
import { ethers } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const ROBINHOOD_TESTNET_CHAIN_ID = 46630
const SUBMISSION = '0xdB960937821678fb7d029d1611059a04bf1F3046'
const REWARD_MANAGER = '0x9423d79dcd7f108dF5749a537fbE92577CdE1902'
const DEMO_MINT = 10_000n * 10n ** 18n
const DEMO_HOLDER = '0x7D85fCbB505D48E6176483733b62b51704e0bF95'

function requirePrivateKey(): string {
  const raw = process.env.PRIVATE_KEY?.trim()
  if (!raw) throw new Error('PRIVATE_KEY is required')
  return raw.startsWith('0x') ? raw : `0x${raw}`
}

async function main() {
  if (process.env.CONFIRM_DEPLOY_RDCU !== 'YES') {
    throw new Error('Refusing to deploy. Set CONFIRM_DEPLOY_RDCU=YES')
  }

  const rpc =
    process.env.ROBINHOOD_TESTNET_RPC_URL || 'https://rpc.testnet.chain.robinhood.com'
  const provider = new ethers.JsonRpcProvider(rpc, ROBINHOOD_TESTNET_CHAIN_ID, {
    staticNetwork: true,
  })
  const wallet = new ethers.Wallet(requirePrivateKey(), provider)
  const network = await provider.getNetwork()
  if (Number(network.chainId) !== ROBINHOOD_TESTNET_CHAIN_ID) {
    throw new Error(`Expected chain ${ROBINHOOD_TESTNET_CHAIN_ID}, got ${network.chainId}`)
  }

  console.log('Deployer:', wallet.address)
  console.log('Balance:', ethers.formatEther(await provider.getBalance(wallet.address)), 'ETH')

  const artifact = await hre.artifacts.readArtifact('RDCUToken')
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet)
  const token = await factory.deploy(SUBMISSION, REWARD_MANAGER)
  await token.waitForDeployment()
  const address = await token.getAddress()
  console.log('RDCUToken:', address)
  console.log('Submission:', SUBMISSION)
  console.log('RewardManager:', REWARD_MANAGER)

  const mintTx = await token.mint(wallet.address, DEMO_MINT)
  await mintTx.wait()
  console.log('Minted', ethers.formatEther(DEMO_MINT), 'rDCU to', wallet.address)

  if (DEMO_HOLDER.toLowerCase() !== wallet.address.toLowerCase()) {
    const demoTx = await token.mint(DEMO_HOLDER, DEMO_MINT)
    await demoTx.wait()
    console.log('Minted', ethers.formatEther(DEMO_MINT), 'rDCU to', DEMO_HOLDER)
  }

  const outPath = path.join(__dirname, 'deployed_addresses.robinhoodchain-testnet.json')
  const prev = fs.existsSync(outPath)
    ? (JSON.parse(fs.readFileSync(outPath, 'utf8')) as Record<string, unknown>)
    : {}
  const next = {
    ...prev,
    previousRDCUToken: prev.RDCUToken ?? null,
    RDCUToken: address,
    rDCUSubmission: SUBMISSION,
    rDCURewardManager: REWARD_MANAGER,
    rDCUVerifyReward: '10',
    rDCUMintedTo: [wallet.address, DEMO_HOLDER],
    rDCUDeployedAt: new Date().toISOString(),
  }
  fs.writeFileSync(outPath, `${JSON.stringify(next, null, 2)}\n`)
  console.log('Wrote', outPath)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
