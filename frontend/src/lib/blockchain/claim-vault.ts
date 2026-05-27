/**
 * Client-side: submit a signed $cDCU claim to ClaimVault.
 * Get the signed claim from POST /api/cdcu/claim-request first.
 */

import { getAccount, getPublicClient, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import type { Config } from 'wagmi'
import { getConfig } from './get-wagmi-config'
import { CONTRACT_ADDRESSES } from './chain-constants'
import { encodeFunctionData, type Address } from 'viem'
import { waitForGaslessUserOperationConfirmation } from '@/lib/smart-account/wait-user-op'

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

async function readNativeBalance(config: Config, address?: Address): Promise<bigint> {
  if (!address) return 0n
  try {
    const publicClient = getPublicClient(config)
    if (!publicClient) return 0n
    return await publicClient.getBalance({ address })
  } catch (error) {
    console.warn('[claimCdcu] Failed to fetch native balance:', error)
    return 0n
  }
}

async function submitClaimViaWagmi(
  config: Config,
  claimVaultAddress: Address,
  signed: SignedClaimParams
): Promise<{ hash: `0x${string}`; receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>> }> {
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

/**
 * Submit a signed $cDCU claim to ClaimVault.claim().
 * Mint recipient is `signed.recipient`; gas can be paid by any connected wallet with CELO.
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
  const wagmiAddress = account.isConnected ? (account.address as Address | undefined) : undefined

  const claimData = encodeFunctionData({
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

  // Prefer MetaMask / browser wallet when it has CELO — even if the airdrop allocation is a smart account.
  if (wagmiAddress) {
    const wagmiBalance = await readNativeBalance(config, wagmiAddress)
    if (wagmiBalance > 0n) {
      return submitClaimViaWagmi(config, claimVaultAddress, signed)
    }
  }

  const claimerAddress = options?.claimerAddress
  if (
    claimerAddress &&
    wagmiAddress &&
    claimerAddress.toLowerCase() === wagmiAddress.toLowerCase()
  ) {
    const claimerBalance = await readNativeBalance(config, claimerAddress)
    if (claimerBalance > 0n) {
      return submitClaimViaWagmi(config, claimVaultAddress, signed)
    }
  }

  if (options?.gaslessClient) {
    const userOpHash = await options.gaslessClient.sendTransaction({
      to: claimVaultAddress,
      data: claimData,
      value: 0n,
    })
    const { transactionHash } = await waitForGaslessUserOperationConfirmation(userOpHash)
    const receipt = await waitForTransactionReceipt(config, { hash: transactionHash })
    return { hash: transactionHash, receipt }
  }

  if (account.isConnected && wagmiAddress) {
    throw new Error(
      'Your connected MetaMask wallet has no CELO for gas on this network. Add CELO on the correct Celo network, or sign in with Google/email, unlock your smart account, and try again for sponsored gas.'
    )
  }

  if (claimerAddress) {
    throw new Error(
      'Your smart account has no CELO for gas. Connect MetaMask with CELO to submit the claim, unlock your wallet in Smart account settings for sponsored gas, or send a small amount of CELO to your smart account address.'
    )
  }

  throw new Error(
    'No wallet connected with gas. Connect MetaMask with CELO, or sign in and unlock your DeCleanup Rewards smart account.'
  )
}
