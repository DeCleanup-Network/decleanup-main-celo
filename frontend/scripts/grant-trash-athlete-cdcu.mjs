/**
 * Ops: mint Trash Athlete 150 $cDCU via ClaimVault (EIP-712 + claim()).
 * Safe does not need a $cDCU balance — ClaimVault mints to the recipient.
 *
 * Pass the **signer EOA** (MetaMask / import address from trash_athlete_challenges.wallet_address),
 * not the smart account.
 *
 * Usage (from frontend/):
 *   node scripts/grant-trash-athlete-cdcu.mjs --wallet 0x... [--confirm]
 *   node scripts/grant-trash-athlete-cdcu.mjs --wallets 0xA,0xB --confirm
 *
 * Requires frontend/.env.local:
 *   CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY
 *   NEXT_PUBLIC_CLAIMVAULT_ADDRESS
 *   Optional: CLAIM_VAULT_RELAYER_PRIVATE_KEY (gas payer; else signer pays gas)
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
  parseEther,
  hexToSignature,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const path = resolve(frontendRoot, '.env.local')
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
}

loadEnvLocal()

const CLAIM_CATEGORY_COMMUNITY_INCENTIVES = 5
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60

const CLAIMVAULT_ABI = [
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'uint8' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'v', type: 'uint8' },
      { name: 'r', type: 'bytes32' },
      { name: 's', type: 'bytes32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'authorizedSigner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
]

const argv = process.argv.slice(2)
let wallets = []
let confirm = false
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--wallet') wallets.push((argv[++i] || '').trim())
  else if (argv[i] === '--wallets') {
    wallets.push(
      ...(argv[++i] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  } else if (argv[i] === '--confirm') confirm = true
}

wallets = [...new Set(wallets.map((w) => w.toLowerCase()))]
if (wallets.length === 0 || wallets.some((w) => !isAddress(w))) {
  console.error(
    'Usage: node scripts/grant-trash-athlete-cdcu.mjs --wallet 0x... [--wallet 0x...] [--confirm]'
  )
  process.exit(1)
}

function normalizePk(raw) {
  if (!raw) return undefined
  const t = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(t)) return undefined
  return `0x${t}`
}

const signerPk = normalizePk(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
const relayerPk = normalizePk(process.env.CLAIM_VAULT_RELAYER_PRIVATE_KEY) || signerPk
const claimVault = (process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS || '').trim()
if (!signerPk || !relayerPk || !isAddress(claimVault)) {
  console.error('Need CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY + NEXT_PUBLIC_CLAIMVAULT_ADDRESS')
  process.exit(1)
}

const rpc = process.env.NEXT_PUBLIC_RPC_URL || process.env.RPC_URL || 'https://forno.celo.org'
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 42220)
const chain = chainId === 11142220 ? celoSepolia : celo
const amount = parseEther('150')
const amountLabel = '150'

const signerAccount = privateKeyToAccount(signerPk)
const relayerAccount = privateKeyToAccount(relayerPk)
const publicClient = createPublicClient({ chain, transport: http(rpc) })
const walletClient = createWalletClient({
  account: relayerAccount,
  chain,
  transport: http(rpc),
})

const onchainSigner = await publicClient.readContract({
  address: claimVault,
  abi: CLAIMVAULT_ABI,
  functionName: 'authorizedSigner',
})

console.log('--- Trash Athlete $cDCU ClaimVault mint ---')
console.log('claimVault:     ', claimVault)
console.log('chain:          ', chain.name, chainId)
console.log('amount:         ', amountLabel, '$cDCU each')
console.log('category:       ', CLAIM_CATEGORY_COMMUNITY_INCENTIVES, '(CommunityIncentives)')
console.log('signer address: ', signerAccount.address)
console.log('onchain signer: ', onchainSigner)
console.log('gas payer:      ', relayerAccount.address)
console.log('recipients:     ', wallets.join(', '))

if (signerAccount.address.toLowerCase() !== String(onchainSigner).toLowerCase()) {
  console.error('\nERROR: CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY does not match ClaimVault.authorizedSigner')
  process.exit(1)
}

if (!confirm) {
  console.log('\nDry run. Re-run with --confirm to mint.')
  process.exit(0)
}

const domain = {
  name: 'ClaimVault',
  version: '1',
  chainId,
  verifyingContract: claimVault,
}

const types = {
  Claim: [
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'category', type: 'uint8' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint256' },
  ],
}

for (const recipient of wallets) {
  const nonce = BigInt(`0x${randomBytes(16).toString('hex')}`)
  const expiry = Math.floor(Date.now() / 1000) + MAX_EXPIRY_SECONDS
  const message = {
    recipient,
    amount,
    category: CLAIM_CATEGORY_COMMUNITY_INCENTIVES,
    nonce,
    expiry,
  }

  const signature = await signerAccount.signTypedData({
    domain,
    types,
    primaryType: 'Claim',
    message,
  })
  const { v, r, s } = hexToSignature(signature)

  console.log('\n→ minting to', recipient)
  const hash = await walletClient.writeContract({
    address: claimVault,
    abi: CLAIMVAULT_ABI,
    functionName: 'claim',
    args: [recipient, amount, CLAIM_CATEGORY_COMMUNITY_INCENTIVES, nonce, BigInt(expiry), Number(v), r, s],
    gas: 350_000n,
  })
  console.log('  tx:', hash)
  const receipt = await publicClient.waitForTransactionReceipt({ hash })
  console.log('  status:', receipt.status)
  if (receipt.status !== 'success') {
    console.error('  FAILED for', recipient)
    process.exit(1)
  }
}

console.log('\nOK: minted', amountLabel, '$cDCU to', wallets.length, 'recipient(s).')
