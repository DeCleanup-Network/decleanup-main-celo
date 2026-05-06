/**
 * Compare ClaimVault.authorizedSigner() on-chain to the address from
 * CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY (same rules as claim-request API).
 *
 * Usage (from repo root or frontend/):
 *   node frontend/scripts/check-claimvault-signer.mjs
 *   cd frontend && node scripts/check-claimvault-signer.mjs
 *
 * Reads frontend/.env.local if present (simple KEY=value parser; no export needed).
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPublicClient, http, isAddress } from 'viem'
import { celoSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const envPath = resolve(frontendRoot, '.env.local')

function loadDotLocal() {
  if (!existsSync(envPath)) return
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
      // Strip trailing inline comment: KEY=https://rpc  # note
      val = val.replace(/\s+#.*$/, '').trim()
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}

function normalizePrivateKey(raw) {
  if (!raw || typeof raw !== 'string') return undefined
  const trimmed = raw.trim().replace(/^0x/i, '')
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) return undefined
  return /** @type {const} */ (`0x${trimmed}`)
}

loadDotLocal()

const pk = normalizePrivateKey(process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY)
const claimVault = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || celoSepolia.id)
const rpcUrl =
  process.env.CELO_SEPOLIA_RPC_URL ||
  process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ||
  celoSepolia.rpcUrls.default.http[0]

if (!pk) {
  console.error('Missing or invalid CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY (expect 64 hex chars, optional 0x).')
  process.exit(1)
}
if (!claimVault || !isAddress(claimVault)) {
  console.error('Missing or invalid NEXT_PUBLIC_CLAIMVAULT_ADDRESS.')
  process.exit(1)
}

const account = privateKeyToAccount(pk)
const chain =
  chainId === celoSepolia.id
    ? celoSepolia
    : { ...celoSepolia, id: chainId, rpcUrls: { default: { http: [rpcUrl] } } }

const client = createPublicClient({
  chain,
  transport: http(rpcUrl),
})

const onchain = await client.readContract({
  address: claimVault,
  abi: [
    {
      type: 'function',
      name: 'authorizedSigner',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ type: 'address' }],
    },
  ],
  functionName: 'authorizedSigner',
})

const envAddr = account.address.toLowerCase()
const chainAddr = String(onchain).toLowerCase()
const ok = envAddr === chainAddr

console.log('RPC:', rpcUrl)
console.log('ClaimVault:', claimVault)
console.log('From CLAIM_VAULT_* private key:', account.address)
console.log('On-chain authorizedSigner():', onchain)
console.log(ok ? 'OK: addresses match.' : 'MISMATCH: rotate key on-chain or fix env.')
process.exit(ok ? 0 : 2)
