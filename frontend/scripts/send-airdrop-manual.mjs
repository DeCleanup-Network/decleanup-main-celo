/**
 * Team: mint past-contributor $cDCU to a wallet without the user clicking Claim.
 * Submits ClaimVault.claim() with a backend EIP-712 signature (PublicDistribution).
 *
 * Usage (from frontend/):
 *   node scripts/send-airdrop-manual.mjs --recipient 0xFc8c...           # preview
 *   node scripts/send-airdrop-manual.mjs --recipient 0xFc8c... --confirm
 *
 * Env (frontend/.env.local):
 *   CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY — signs the claim
 *   NEXT_PUBLIC_CLAIMVAULT_ADDRESS
 *   NEXT_PUBLIC_CHAIN_ID (42220 mainnet)
 *   NEXT_PUBLIC_RPC_URL or CELO_RPC_URL
 *   Optional AIRDROP_GAS_PRIVATE_KEY — pays gas (defaults to signer key)
 *   Optional SUPABASE_SERVICE_ROLE_KEY — marks allocation claimed in DB after mint
 */
import { readFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseEther,
  hexToSignature,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { celo, celoSepolia } from 'viem/chains'
import { createClient } from '@supabase/supabase-js'

const CELO_MAINNET_ID = 42220
const PUBLIC_DISTRIBUTION_CATEGORY = 2
const CLAIM_VAULT_DOMAIN = { name: 'ClaimVault', version: '1' }
const MAX_EXPIRY_SECONDS = 7 * 24 * 60 * 60

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')

const CLAIM_ABI = [
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
] 

function loadDotLocal() {
  const envPath = resolve(frontendRoot, '.env.local')
  if (!existsSync(envPath)) {
    console.error('Missing frontend/.env.local')
    process.exit(1)
  }
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    } else {
      val = val.replace(/\s+#.*$/, '').trim()
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function parseArgs(argv) {
  let recipient = ''
  let amountCdcu = '250'
  let confirm = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--recipient' || a === '-r') recipient = (argv[++i] || '').trim()
    else if (a === '--amount-cdcu') amountCdcu = (argv[++i] || '250').trim()
    else if (a === '--confirm') confirm = true
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node scripts/send-airdrop-manual.mjs --recipient 0x... [--amount-cdcu 250] [--confirm]`)
      process.exit(0)
    }
  }
  if (!recipient || !isAddress(recipient)) {
    console.error('Provide --recipient 0x...')
    process.exit(1)
  }
  return { recipient, amountCdcu, confirm }
}

function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return /** @type {const} */ (`0x${trimmed}`)
}

async function markClaimedInSupabase(recipient) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim()
  if (!url || !key) {
    console.warn('No Supabase service key — skip DB claimed flag (add manually if needed).')
    return
  }
  const client = createClient(url, key, { auth: { persistSession: false } })
  const claimedKey = `claimed_${recipient.toLowerCase()}`
  const pendingKey = `pending_${recipient.toLowerCase()}`
  await client.from('airdrop_issued_store').upsert({ key: claimedKey, value: '1' }, { onConflict: 'key' })
  await client.from('airdrop_issued_store').delete().eq('key', pendingKey)
  console.log('Marked claimed in Supabase airdrop_issued_store.')
}

loadDotLocal()
const { recipient, amountCdcu, confirm } = parseArgs(process.argv.slice(2))

const signPk = normalizePrivateKey(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
const gasPk = normalizePrivateKey(process.env.AIRDROP_GAS_PRIVATE_KEY) ?? signPk
const claimVault = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || CELO_SEPOLIA_ID)
const isMainnet = chainId === CELO_MAINNET_ID
const rpcUrl = isMainnet
  ? process.env.NEXT_PUBLIC_RPC_URL || process.env.CELO_RPC_URL || celo.rpcUrls.default.http[0]
  : process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
    process.env.CELO_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    celoSepolia.rpcUrls.default.http[0]

if (!signPk || !gasPk) {
  console.error('Missing CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY (and optional AIRDROP_GAS_PRIVATE_KEY).')
  process.exit(1)
}
if (!claimVault || !isAddress(claimVault)) {
  console.error('Missing NEXT_PUBLIC_CLAIMVAULT_ADDRESS.')
  process.exit(1)
}

const signerAccount = privateKeyToAccount(signPk)
const gasAccount = privateKeyToAccount(gasPk)
const baseChain = isMainnet ? celo : celoSepolia
const chain =
  chainId === baseChain.id
    ? baseChain
    : { ...baseChain, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } }

const publicClient = createPublicClient({ chain, transport: http(rpcUrl) })
const walletClient = createWalletClient({ account: gasAccount, chain, transport: http(rpcUrl) })

const amountWei = parseEther(amountCdcu)
const nonce = BigInt(`0x${randomBytes(16).toString('hex')}`)
const expiry = BigInt(Math.floor(Date.now() / 1000) + MAX_EXPIRY_SECONDS)

console.log('Chain:', chainId, isMainnet ? '(Celo mainnet)' : '(testnet)')
console.log('Recipient:', recipient)
console.log('Amount:', amountCdcu, 'cDCU')
console.log('ClaimVault:', claimVault)
console.log('Signer:', signerAccount.address)
console.log('Gas payer:', gasAccount.address)

const balance = await publicClient.getBalance({ address: gasAccount.address })
console.log('Gas payer CELO balance:', Number(balance) / 1e18)

const signature = await walletClient.signTypedData({
  account: signerAccount,
  domain: { ...CLAIM_VAULT_DOMAIN, chainId, verifyingContract: claimVault },
  types: {
    Claim: [
      { name: 'recipient', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'category', type: 'uint8' },
      { name: 'nonce', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
    ],
  },
  primaryType: 'Claim',
  message: {
    recipient,
    amount: amountWei,
    category: PUBLIC_DISTRIBUTION_CATEGORY,
    nonce,
    expiry,
  },
})

const { r, s, v: vBig } = hexToSignature(signature)
const v = Number(vBig)

if (!confirm) {
  console.log('\nDry run only. Re-run with --confirm to submit ClaimVault.claim() onchain.')
  process.exit(0)
}

if (balance === 0n) {
  console.error('Gas payer has no CELO. Fund', gasAccount.address, 'on Celo mainnet.')
  process.exit(1)
}

console.log('\nSubmitting claim transaction…')
const hash = await walletClient.writeContract({
  address: claimVault,
  abi: CLAIM_ABI,
  functionName: 'claim',
  args: [recipient, amountWei, PUBLIC_DISTRIBUTION_CATEGORY, nonce, expiry, v, r, s],
})

console.log('Tx hash:', hash)
const receipt = await publicClient.waitForTransactionReceipt({ hash })
console.log('Confirmed in block', receipt.blockNumber.toString())

await markClaimedInSupabase(recipient)
console.log('Done. Recipient should see', amountCdcu, 'cDCU at', recipient)
