/**
 * Client-side: submit a signed $cDCU claim to ClaimVault.
 * Get the signed claim from POST /api/cdcu/claim-request first.
 */

import { getAccount, getPublicClient, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { getConfig } from './get-wagmi-config'
import { CONTRACT_ADDRESSES } from './chain-constants'
import { encodeFunctionData, type Address } from 'viem'

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

type GaslessClient = {
  sendTransaction: (params: { to: Address; data?: `0x${string}`; value?: bigint }) => Promise<`0x${string}`>
}

/**
 * Submit a signed $cDCU claim to ClaimVault.claim().
 * Returns transaction hash and receipt.
 */
export async function claimCdcu(
  signed: SignedClaimParams,
  options?: { gaslessClient?: GaslessClient; claimerAddress?: Address }
): Promise<{ hash: `0x${string}`; receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>> }> {
  const claimVaultAddress = CONTRACT_ADDRESSES.CLAIMVAULT as Address
  if (!claimVaultAddress) {
    throw new Error('ClaimVault address not configured. Set NEXT_PUBLIC_CLAIMVAULT_ADDRESS.')
  }

  const config = getConfig()
  const account = getAccount(config)
  const fromAddress = options?.claimerAddress ?? (account.address as Address | undefined)

  let nativeBalance = 0n
  if (fromAddress) {
    try {
      const publicClient = getPublicClient(config)
      if (publicClient) {
        nativeBalance = await publicClient.getBalance({ address: fromAddress })
      }
    } catch (error) {
      console.warn('[claimCdcu] Failed to fetch native balance:', error)
    }
  }

  if (nativeBalance === 0n) {
    if (options?.gaslessClient) {
      const data = encodeFunctionData({
        abi: CLAIMVAULT_ABI,
        functionName: 'claim',
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

      const hash = await options.gaslessClient.sendTransaction({
        to: claimVaultAddress,
        data,
        value: 0n,
      })
      const receipt = await waitForTransactionReceipt(config, { hash })
      return { hash, receipt }
    }

    throw new Error('No CELO balance for gas and sponsored claim is unavailable. Reconnect embedded wallet or fund gas.')
  }

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
