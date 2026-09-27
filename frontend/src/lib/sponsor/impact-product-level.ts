import { createPublicClient, defineChain, http, type Address } from 'viem'
import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
  CHAIN_CONFIGS,
  ROBINHOOD_TESTNET_CHAIN_ID,
  getChainConfig,
  type SupportedChainId,
} from '@/lib/blockchain/chain-constants'

const IMPACT_PRODUCT_LEVEL_ABI = [
  {
    type: 'function',
    name: 'getUserNFTData',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'tokenId', type: 'uint256' },
      { name: 'impact', type: 'uint256' },
      { name: 'level', type: 'uint256' },
    ],
  },
] as const

const SPONSOR_ELIGIBILITY_CHAINS: SupportedChainId[] = [
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
]

function nativeCurrency(chainId: SupportedChainId) {
  if (chainId === CELO_MAINNET_CHAIN_ID || chainId === CELO_SEPOLIA_CHAIN_ID) {
    return { name: 'CELO', symbol: 'CELO', decimals: 18 }
  }
  return { name: 'ETH', symbol: 'ETH', decimals: 18 }
}

/** On-chain Impact Product level for one address on one experience (0 if none / unreadable). */
export async function getImpactProductLevel(
  address: Address,
  chainId?: SupportedChainId
): Promise<number> {
  const id = chainId ?? CELO_MAINNET_CHAIN_ID
  const config = getChainConfig(id)
  const nft = config.contracts.IMPACT_PRODUCT?.trim()
  if (!nft) return 0
  try {
    const publicClient = createPublicClient({
      chain: defineChain({
        id,
        name: config.name,
        nativeCurrency: nativeCurrency(id),
        rpcUrls: { default: { http: [config.rpcUrl] } },
      }),
      transport: http(config.rpcUrl),
    })
    const nftData = (await publicClient.readContract({
      address: nft as Address,
      abi: IMPACT_PRODUCT_LEVEL_ABI,
      functionName: 'getUserNFTData',
      args: [address],
    })) as [bigint, bigint, bigint]
    return Number(nftData[2])
  } catch {
    return 0
  }
}

/** Highest Impact Product level across Celo, Base, and Robinhood for this wallet. */
export async function getMaxImpactProductLevel(
  primary: Address,
  linked?: Address | null
): Promise<number> {
  const addresses = [primary]
  if (linked && linked.toLowerCase() !== primary.toLowerCase()) addresses.push(linked)

  const reads = SPONSOR_ELIGIBILITY_CHAINS.flatMap((chainId) => {
    if (!CHAIN_CONFIGS[chainId].contracts.IMPACT_PRODUCT?.trim()) return []
    return addresses.map((addr) => getImpactProductLevel(addr, chainId))
  })
  if (reads.length === 0) return 0
  return Math.max(0, ...(await Promise.all(reads)))
}
