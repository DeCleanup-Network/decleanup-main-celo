import 'server-only'

import { createPublicClient, http, type Address, parseAbiItem } from 'viem'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'

/** ClaimVault PublicDistribution — airdrop category. */
const AIRDROP_CLAIM_CATEGORY = 2

const CLAIMED_EVENT = parseAbiItem(
  'event Claimed(address indexed recipient, uint256 amount, uint8 category, uint256 nonce)'
)

const ONCHAIN_CLAIM_LOG_TIMEOUT_MS = 12_000

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

function claimLogsFromBlock(): bigint | null {
  const fromBlockRaw = process.env.CDCU_CLAIM_LOGS_FROM_BLOCK?.trim()
  if (fromBlockRaw && /^\d+$/.test(fromBlockRaw)) {
    return BigInt(fromBlockRaw)
  }
  // Scanning from genesis on mainnet is too slow for serverless (40s+). Require deploy block.
  if (REQUIRED_CHAIN_ID === 42220) {
    return null
  }
  return 0n
}

/**
 * True if this wallet already received a PublicDistribution claim on ClaimVault.
 * Repairs stale server store when record-issued failed but the onchain tx succeeded.
 */
export async function hasAirdropClaimOnChain(recipient: Address): Promise<boolean> {
  const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined
  if (!claimVaultAddress) return false

  const fromBlock = claimLogsFromBlock()
  if (fromBlock === null) {
    console.warn(
      '[airdrop] Skipping onchain claimed check: set CDCU_CLAIM_LOGS_FROM_BLOCK to ClaimVault deploy block on mainnet.'
    )
    return false
  }

  const client = createPublicClient({
    chain: {
      id: REQUIRED_CHAIN_ID,
      name: 'Celo',
      nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
      rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
    },
    transport: http(REQUIRED_RPC_URL),
  })

  try {
    const logs = await withTimeout(
      client.getLogs({
        address: claimVaultAddress,
        event: CLAIMED_EVENT,
        args: { recipient },
        fromBlock,
        toBlock: 'latest',
      }),
      ONCHAIN_CLAIM_LOG_TIMEOUT_MS,
      null
    )
    if (logs === null) {
      console.warn('[airdrop] Onchain claimed check timed out; using Supabase store only.')
      return false
    }
    return logs.some((log) => Number(log.args.category) === AIRDROP_CLAIM_CATEGORY)
  } catch (e) {
    console.warn('[airdrop] onchain claimed check failed:', e)
    return false
  }
}
