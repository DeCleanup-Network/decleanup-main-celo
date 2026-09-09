/**
 * Ops helper (Safe / owner): after Trash Athlete is APPROVED in the verifier UI,
 * grant 30 DCU via DCURewardManager.distributeRewards to the **signer EOA**
 * (`trash_athlete_challenges.wallet_address` — MetaMask / import address).
 *
 * Level 3 and 150 $cDCU are also manual for now (Safe):
 *   - $cDCU: ClaimVault mint to the same signer EOA
 *   - Level: verifyPOI + mint/upgrade for that signer EOA
 *
 * Usage (from frontend/):
 *   node scripts/grant-trash-athlete-dcu.mjs --wallet 0x... [--confirm]
 *
 * Requires in .env.local a key that can call distributeRewards (Safe owner execution
 * or a hot key that still owns DCURewardManager — usually not available if ownership
 * is only on the Safe; then run the same call from Safe Transaction Builder).
 *
 *   DCU_REWARD_OWNER_PRIVATE_KEY (or CONTRACT_OWNER_PRIVATE_KEY)
 *   NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT
 *   NEXT_PUBLIC_RPC_URL
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWalletClient, createPublicClient, http, isAddress, parseEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const path = resolve(frontendRoot, '.env.local')
  try {
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i === -1) continue
      const key = t.slice(0, i).trim()
      let val = t.slice(i + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.error('Missing frontend/.env.local')
    process.exit(1)
  }
}

loadEnvLocal()

const argv = process.argv.slice(2)
let wallet = ''
let confirm = false
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--wallet') wallet = (argv[++i] || '').trim()
  else if (argv[i] === '--confirm') confirm = true
}

if (!wallet || !isAddress(wallet)) {
  console.error('Usage: node scripts/grant-trash-athlete-dcu.mjs --wallet 0x... [--confirm]')
  process.exit(1)
}

const pkRaw =
  process.env.DCU_REWARD_OWNER_PRIVATE_KEY ||
  process.env.CONTRACT_OWNER_PRIVATE_KEY ||
  process.env.DEPLOYER_PRIVATE_KEY
const pk = pkRaw?.trim().replace(/^0x/i, '')
if (!pk || !/^[0-9a-fA-F]{64}$/.test(pk)) {
  console.error('Set DCU_REWARD_OWNER_PRIVATE_KEY (owner of DCURewardManager) in .env.local')
  process.exit(1)
}

const rewardManager = (process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT ||
  process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_ADDRESS ||
  process.env.NEXT_PUBLIC_DCUREWARDMANAGER_ADDRESS ||
  '').trim()
if (!isAddress(rewardManager)) {
  console.error('Missing NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT')
  process.exit(1)
}

const rpc =
  process.env.NEXT_PUBLIC_RPC_URL ||
  process.env.RPC_URL ||
  'https://forno.celo.org'
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.REQUIRED_CHAIN_ID || 42220)
const chain = chainId === 11142220 ? celoSepolia : celo
const amount = parseEther('30')

console.log('--- Trash Athlete DCU grant preview ---')
console.log('wallet:         ', wallet)
console.log('reward manager: ', rewardManager)
console.log('amount:         ', '30 DCU')
console.log('chain:          ', chain.name, chainId)

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to send distributeRewards.')
  process.exit(0)
}

const account = privateKeyToAccount(`0x${pk}`)
const publicClient = createPublicClient({ chain, transport: http(rpc) })
const walletClient = createWalletClient({ account, chain, transport: http(rpc) })

const abi = [
  {
    type: 'function',
    name: 'distributeRewards',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const hash = await walletClient.writeContract({
  address: rewardManager,
  abi,
  functionName: 'distributeRewards',
  args: [wallet, amount],
})
console.log('tx sent:', hash)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log('status:', receipt.status)
console.log('OK: 30 DCU granted. Level 3 NFT still needs separate ops (mint + upgrades or contract upgrade).')
