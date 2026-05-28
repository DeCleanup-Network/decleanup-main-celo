/**
 * Client-side: submit a signed $cDCU claim to ClaimVault.
 * Get the signed claim from POST /api/cdcu/claim-request first.
 */

import { getAccount, getPublicClient, waitForTransactionReceipt } from '@wagmi/core'
import type { Config } from 'wagmi'
import { getConfig } from './get-wagmi-config'
import { CONTRACT_ADDRESSES, REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from './chain-constants'
import { encodeFunctionData, type Address, type Hex } from 'viem'
import { waitForGaslessUserOperationConfirmation } from '@/lib/smart-account/wait-user-op'
import { writeContractViaWalletProvider } from '@/lib/blockchain/wallet-provider-write'

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
    const publicClient = getPublicClient(config, { chainId: REQUIRED_CHAIN_ID })
    if (!publicClient) return 0n
    return await publicClient.getBalance({ address })
  } catch (error) {
    console.warn('[claimCdcu] Failed to fetch native balance:', error)
    return 0n
  }
}

async function submitClaimViaWallet(
  config: Config,
  claimVaultAddress: Address,
  signed: SignedClaimParams,
  options?: { skipSwitch?: boolean; skipSettle?: boolean }
): Promise<{ hash: Hex; receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>> }> {
  const hash = await writeContractViaWalletProvider(
    config,
    {
      address: claimVaultAddress,
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
      gas: 300_000n,
    },
    { skipSwitch: options?.skipSwitch, skipSettle: options?.skipSettle }
  )

  const receipt = await waitForTransactionReceipt(config, { hash, chainId: REQUIRED_CHAIN_ID })
  return { hash, receipt }
}

/**
 * Submit a signed $cDCU claim to ClaimVault.claim().
 * Mint recipient is `signed.recipient`; gas can be paid by any connected wallet with CELO.
 */
export async function claimCdcu(
  signed: SignedClaimParams,
  options?: {
    gaslessClient?: GaslessClient
    claimerAddress?: Address
    /** Airdrop / external wallet: submit via connected wagmi wallet (WalletConnect, MetaMask). */
    preferConnectedWallet?: boolean
    skipSwitch?: boolean
    /** Caller already ran waitForWalletConnectChainReady (e.g. airdrop panel before sign). */
    skipSettle?: boolean
  }
): Promise<{ hash: Hex; receipt: Awaited<ReturnType<typeof waitForTransactionReceipt>> }> {
  const claimVaultAddress = CONTRACT_ADDRESSES.CLAIMVAULT as Address
  if (!claimVaultAddress) {
    throw new Error('ClaimVault address not configured. Set NEXT_PUBLIC_CLAIMVAULT_ADDRESS.')
  }

  const config = getConfig()
  const account = getAccount(config)
  const wagmiAddress = account.isConnected ? (account.address as Address | undefined) : undefined

  if (options?.preferConnectedWallet && wagmiAddress) {
    return submitClaimViaWallet(config, claimVaultAddress, signed, {
      skipSwitch: options.skipSwitch,
      skipSettle: options.skipSettle,
    })
  }

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

  // Prefer MetaMask / browser wallet when it has CELO on the target Celo network.
  if (wagmiAddress) {
    const wagmiBalance = await readNativeBalance(config, wagmiAddress)
    if (wagmiBalance > 0n) {
      return submitClaimViaWallet(config, claimVaultAddress, signed)
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
      return submitClaimViaWallet(config, claimVaultAddress, signed)
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
    const wrongNetwork = account.chainId != null && account.chainId !== REQUIRED_CHAIN_ID
    throw new Error(
      wrongNetwork
        ? `Switch MetaMask to ${REQUIRED_CHAIN_NAME} (Chain ID ${REQUIRED_CHAIN_ID}). You may have CELO on Celo but the wallet is on another network.`
        : `Your connected MetaMask wallet has no CELO for gas on ${REQUIRED_CHAIN_NAME}. Add testnet CELO from https://faucet.celo.org/ or sign in with Google/email for sponsored gas.`
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
