import type { Address } from 'viem'
import { lockedWriteContract } from '@/lib/blockchain/wallet-write-mutex'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'
import { ROBINHOOD_HYPERCERT_MINTER, ROBINHOOD_TESTNET_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { uploadHypercertMetadataToIPFS } from '@/lib/blockchain/ipfs'
import type { HypercertMetadata } from './types'

const HYPERCERT_MINTER_ABI = [
  {
    type: 'function',
    name: 'mintClaim',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'units', type: 'uint256' },
      { name: 'uri', type: 'string' },
      { name: 'restrictions', type: 'uint8' },
    ],
    outputs: [],
  },
] as const

/** AllowAll — same default used on other Hypercerts test deploys. */
const TRANSFER_ALLOW_ALL = 0
const FULL_UNITS = 10_000n

export async function mintHypercertOnRobinhood(params: {
  account: Address
  metadata: HypercertMetadata
}): Promise<{ txHash: `0x${string}`; uri: string }> {
  const uploaded = await uploadHypercertMetadataToIPFS(params.metadata, params.account)
  const uri = uploaded.url || `ipfs://${uploaded.hash}`

  const txHash = await lockedWriteContract(getConfig(), {
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    address: ROBINHOOD_HYPERCERT_MINTER as Address,
    abi: HYPERCERT_MINTER_ABI,
    functionName: 'mintClaim',
    args: [params.account, FULL_UNITS, uri, TRANSFER_ALLOW_ALL],
    account: params.account,
  })

  return { txHash, uri }
}
