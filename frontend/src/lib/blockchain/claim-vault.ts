/**
 * Client-side: submit a signed $cDCU claim to ClaimVault.
 * Get the signed claim from POST /api/cdcu/claim-request first.
 */

import { getPublicClient, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { getConfig } from './get-wagmi-config'
import { CONTRACT_ADDRESSES } from './chain-constants'
import type { Address } from 'viem'

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
] as const

export interface SignedClaimParams {
  recipient: Address
  amount: string
  category: number
  nonce: string
  expiry: number
  v: number
  r: `0x${string}`
  s: `0x${string}`
}

/**
 * Submit a signed $cDCU claim to ClaimVault.claim().
 * Returns transaction hash and receipt.
 */
export async function claimCdcu(signed: SignedClaimParams): Promise<{ hash: `0x${string}`; receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>> }> {
  const claimVaultAddress = CONTRACT_ADDRESSES.CLAIMVAULT as Address
  if (!claimVaultAddress) {
    throw new Error('ClaimVault address not configured. Set NEXT_PUBLIC_CLAIMVAULT_ADDRESS.')
  }

  const config = getConfig()

  // Celo rejects txs with tip cap 0. Some embedded wallets may submit with zero tip unless
  // gas fields are provided explicitly, so fetch network gas price and enforce a non-zero floor.
  let gasPrice: bigint = 1n
  try {
    const publicClient = getPublicClient(config)
    if (publicClient) {
      const networkGasPrice = await publicClient.getGasPrice()
      gasPrice = networkGasPrice > 0n ? networkGasPrice : 1n
    }
  } catch (error) {
    console.warn('[claimCdcu] Failed to fetch gas price, using floor:', error)
  }

  const hash = await writeContract(config, {
    address: claimVaultAddress,
    abi: CLAIMVAULT_ABI,
    functionName: 'claim',
    gasPrice,
    args: [
      signed.recipient,
      BigInt(signed.amount),
      signed.category,
      BigInt(signed.nonce),
      BigInt(signed.expiry),
      signed.v,
      signed.r,
      signed.s,
    ],
  })

  const receipt = await waitForTransactionReceipt(config, { hash })
  return { hash, receipt }
}
