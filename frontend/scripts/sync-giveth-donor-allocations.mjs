#!/usr/bin/env node
/**
 * Merge verified Giveth donations (Decentralized Cleanup Network) into giveth-donors.ts.
 * Keeps existing file addresses and adds any new donor wallets from the API.
 *
 * Usage (from frontend/): npm run airdrop:sync-giveth-donors
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { getAddress } from 'viem'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_FILE = path.join(__dirname, '../src/lib/airdrop/giveth-donors.ts')
const GIVETH_GRAPHQL = 'https://mainnet.serve.giveth.io/graphql'
const PROJECT_SLUG = 'decentralized-cleanup-network'

async function gql(query, variables) {
  const res = await fetch(GIVETH_GRAPHQL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }
  return json.data
}

function parseExistingAddresses(fileText) {
  const matches = fileText.matchAll(/'(0x[a-fA-F0-9]{40})'/g)
  return [...matches].map((m) => getAddress(m[1]))
}

async function fetchProjectId() {
  const data = await gql(
    `query ($slug: String!) { projectBySlug(slug: $slug) { id } }`,
    { slug: PROJECT_SLUG }
  )
  const id = data?.projectBySlug?.id
  if (!id) throw new Error(`Project not found: ${PROJECT_SLUG}`)
  return Number(id)
}

async function fetchDonorAddresses(projectId) {
  const donors = new Set()
  let skip = 0
  const take = 100
  const orderBy = { field: 'CreationDate', direction: 'DESC' }

  while (true) {
    const data = await gql(
      `query ($projectId: Int!, $skip: Int!, $take: Int!, $orderBy: SortBy!) {
        donationsByProjectId(projectId: $projectId, skip: $skip, take: $take, traceable: true, orderBy: $orderBy) {
          donations { fromWalletAddress user { walletAddress } status }
        }
      }`,
      { projectId, skip, take, orderBy }
    )
    const batch = data.donationsByProjectId?.donations ?? []
    if (!batch.length) break

    for (const row of batch) {
      if (row.status && String(row.status).toLowerCase() !== 'verified') continue
      const raw = row.fromWalletAddress ?? row.user?.walletAddress
      if (raw && /^0x[a-fA-F0-9]{40}$/.test(raw)) {
        donors.add(getAddress(raw))
      }
    }

    if (batch.length < take) break
    skip += take
  }

  return donors
}

function writeDonorsFile(addresses) {
  const sorted = [...addresses].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  const lines = sorted.map((a) => `  '${a}',`).join('\n')
  const content = `import type { Address } from 'viem'

/**
 * Giveth donors — 250 cDCU each (see manual-allocations.ts).
 * Static list used at claim time; not fetched live from Giveth.
 * Regenerate / merge from API: \`npm run airdrop:sync-giveth-donors\` (frontend/).
 */
export const GIVETH_DONOR_WALLET_ADDRESSES: readonly Address[] = [
${lines}
] as const
`
  writeFileSync(OUT_FILE, content, 'utf8')
}

async function main() {
  const existingText = readFileSync(OUT_FILE, 'utf8')
  const existing = parseExistingAddresses(existingText)
  const projectId = await fetchProjectId()
  const fromApi = await fetchDonorAddresses(projectId)

  const merged = new Set([...existing, ...fromApi])
  const addedFromApi = [...fromApi].filter((a) => !existing.some((e) => e.toLowerCase() === a.toLowerCase()))

  writeDonorsFile(merged)

  console.log(`Project id: ${projectId}`)
  console.log(`Verified donors from API: ${fromApi.size}`)
  console.log(`Previous file count: ${existing.length}`)
  console.log(`Merged total: ${merged.size}`)
  console.log(`New from API this run: ${addedFromApi.length}`)
  if (addedFromApi.length) {
    for (const a of addedFromApi.sort()) console.log(`  + ${a}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
