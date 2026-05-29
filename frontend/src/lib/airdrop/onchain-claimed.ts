import 'server-only'

import { createPublicClient, http, type Address, parseAbiItem } from 'viem'
import { REQUIRED_CHAIN_ID, REQUIRED_RPC_URL } from '@/lib/blockchain/chain-constants'

/** ClaimVault PublicDistribution — airdrop category. */
const AIRDROP_CLAIM_CATEGORY = 2

const CLAIMED_EVENT = parseAbiItem(
  'event Claimed(address indexed recipient, uint256 amount, uint8 category, uint256 nonce)'
)

/**
 * True if this wallet already received a PublicDistribution claim on ClaimVault.
 * Repairs stale server store when record-issued failed but the on-chain tx succeeded.
 */
export async function hasAirdropClaimOnChain(recipient: Address): Promise<boolean> {
  const claimVaultAddress = process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS as Address | undefined
  if (!claimVaultAddress) return false

  const client = createPublicClient({
    chain: {
      id: REQUIRED_CHAIN_ID,
      name: 'Celo',
      nativeCurrency: { decimals: 18, name: 'CELO', symbol: 'CELO' },
      rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
    },
    transport: http(REQUIRED_RPC_URL),
  })

  const fromBlockRaw = process.env.CDCU_CLAIM_LOGS_FROM_BLOCK?.trim()
  const fromBlock = fromBlockRaw && /^\d+$/.test(fromBlockRaw) ? BigInt(fromBlockRaw) : 0n

  try {
    const logs = await client.getLogs({
      address: claimVaultAddress,
      event: CLAIMED_EVENT,
      args: { recipient },
      fromBlock,
      toBlock: 'latest',
    })
    return logs.some((log) => Number(log.args.category) === AIRDROP_CLAIM_CATEGORY)
  } catch (e) {
    console.warn('[airdrop] on-chain claimed check failed:', e)
    return false
  }
}
