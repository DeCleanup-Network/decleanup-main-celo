import { createPublicClient, defineChain, http, type Address } from 'viem'
import {
  CONTRACT_ADDRESSES,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

const requiredChain = defineChain({
  id: REQUIRED_CHAIN_ID,
  name: REQUIRED_CHAIN_NAME,
  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
  rpcUrls: { default: { http: [REQUIRED_RPC_URL] } },
})

const publicClient = createPublicClient({
  chain: requiredChain,
  transport: http(REQUIRED_RPC_URL),
})

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

/** On-chain Impact Product level for one address (0 if none / unreadable). */
export async function getImpactProductLevel(address: Address): Promise<number> {
  if (!CONTRACT_ADDRESSES.IMPACT_PRODUCT) return 0
  try {
    const nftData = (await publicClient.readContract({
      address: CONTRACT_ADDRESSES.IMPACT_PRODUCT as Address,
      abi: IMPACT_PRODUCT_LEVEL_ABI,
      functionName: 'getUserNFTData',
      args: [address],
    })) as [bigint, bigint, bigint]
    return Number(nftData[2])
  } catch {
    return 0
  }
}

/** Max level across primary + optional linked (EOA / smart account). */
export async function getMaxImpactProductLevel(
  primary: Address,
  linked?: Address | null
): Promise<number> {
  const a = await getImpactProductLevel(primary)
  if (!linked || linked.toLowerCase() === primary.toLowerCase()) return a
  const b = await getImpactProductLevel(linked)
  return Math.max(a, b)
}
