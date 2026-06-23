// ---------------------------------------------------------------------------
// Hypercerts minting: real minting via Hypercerts SDK
// ---------------------------------------------------------------------------

import { TransferRestrictions } from '@hypercerts-org/sdk'
import { encodeFunctionData, type Address, type Hex } from 'viem'
import { getAccount, waitForTransactionReceipt } from '@wagmi/core'
import { lockedWriteContract } from '@/lib/blockchain/wallet-write-mutex'
import { getUserSubmissions, getCleanupDetails } from './contracts'
import { aggregateUserCleanups } from './hypercerts/aggregation'
import { buildHypercertMetadata } from './hypercerts/metadata'
import { uploadHypercertMetadataToIPFS } from './ipfs'
import { getConfig } from './get-wagmi-config'
import { HYPERCERTS_CONFIG } from './hypercerts/config'
import type { MintHypercertOptions } from './hypercerts/mint-options'
import { HypercertMinterAbi } from '@hypercerts-org/contracts'
import { waitForGaslessUserOperationConfirmation } from '@/lib/smart-account/wait-user-op'

function normalizeMetadataRef(metadataUri: string): string {
  if (metadataUri.includes('/ipfs/')) {
    return metadataUri.split('/ipfs/')[1].split('?')[0]
  }
  if (metadataUri.startsWith('ipfs://')) {
    return metadataUri.replace('ipfs://', '')
  }
  return metadataUri
}

async function executeMintClaim(
  recipient: Address,
  metadataRef: string,
  options?: MintHypercertOptions
): Promise<Hex> {
  const mintArgs = [recipient, BigInt(10000), metadataRef, TransferRestrictions.AllowAll] as const
  const contract = HYPERCERTS_CONFIG.contract.address
  const abi = HypercertMinterAbi as readonly unknown[]

  if (options?.gaslessClient) {
    const data = encodeFunctionData({
      abi,
      functionName: 'mintClaim',
      args: mintArgs,
    })
    return options.gaslessClient.sendTransaction({
      to: contract,
      data,
      value: 0n,
    })
  }

  if (options?.embeddedEoaWrite) {
    return options.embeddedEoaWrite({
      address: contract,
      abi,
      functionName: 'mintClaim',
      args: mintArgs,
    })
  }

  const config = getConfig()
  const account = getAccount(config)
  const signer = account.address ?? recipient
  if (!signer) {
    throw new Error('Wallet not connected. Please connect your wallet first.')
  }

  return lockedWriteContract(config, {
    address: contract,
    abi,
    functionName: 'mintClaim',
    args: mintArgs,
    account: signer,
    chainId: HYPERCERTS_CONFIG.contract.chainId,
  })
}

async function confirmMintTransaction(hash: Hex, options?: MintHypercertOptions): Promise<string> {
  if (options?.gaslessClient) {
    const confirmed = await waitForGaslessUserOperationConfirmation(hash)
    return confirmed.transactionHash
  }

  await waitForTransactionReceipt(getConfig(), {
    hash,
    chainId: HYPERCERTS_CONFIG.contract.chainId,
    confirmations: 1,
    pollingInterval: 2000,
    timeout: 120000,
  })
  return hash
}

/**
 * Mint Hypercert onchain. NFT is always minted to `recipient` (the user's EOA).
 * Embedded users: Safe + Pimlico paymaster sends the tx; recipient remains the EOA.
 */
export async function mintHypercertOnChain(
  recipient: string,
  metadataUri: string,
  options?: MintHypercertOptions
): Promise<{ txHash: string; hypercertId: string }> {
  try {
    const recipientAddr = recipient as Address
    const metadataRef = normalizeMetadataRef(metadataUri)

    console.log('🪙 Minting Hypercert onchain...')
    console.log('  Recipient (EOA):', recipientAddr)
    console.log('  Metadata ref:', metadataRef)
    console.log('  Gasless:', Boolean(options?.gaslessClient))

    const pendingHash = await executeMintClaim(recipientAddr, metadataRef, options)
    const txHash = await confirmMintTransaction(pendingHash, options)

    console.log('✅ Hypercert minted successfully!')
    console.log('  Transaction hash:', txHash)

    return {
      txHash,
      hypercertId: txHash,
    }
  } catch (error) {
    console.error('❌ Failed to mint Hypercert:', error)
    throw error
  }
}

/**
 * Complete Hypercert minting flow (after verifier approval).
 * `userAddress` must be the public EOA — same address exportable to MetaMask.
 */
export async function mintHypercert(
  userAddress: string,
  metadata?: unknown,
  options?: MintHypercertOptions
): Promise<{ txHash: string; hypercertId: string; metadataCid: string }> {
  try {
    console.log('🎯 Starting Hypercert minting flow...')

    const cleanupOwner = (options?.submissionOwnerAddress ?? userAddress) as Address
    let finalMetadata = metadata

    if (!finalMetadata) {
      console.log('📊 Building metadata from user cleanups...')

      const submissions = await getUserSubmissions(cleanupOwner)
      const verifiedCleanups = []
      let totalReports = 0

      for (const id of submissions) {
        try {
          const details = await getCleanupDetails(id)
          if (details.verified) {
            verifiedCleanups.push({
              cleanupId: id.toString(),
              verifiedAt: Number(details.timestamp),
            })
            if (details.hasImpactForm) totalReports++
          }
        } catch (error) {
          console.warn('Error fetching cleanup details:', error)
        }
      }

      const summary = aggregateUserCleanups(verifiedCleanups)

      const metadataInput = {
        userAddress,
        cleanups: verifiedCleanups,
        summary: {
          totalCleanups: summary.totalCleanups,
          totalReports,
          timeframeStart: summary.timeframeStart,
          timeframeEnd: summary.timeframeEnd,
        },
        issuer: 'DeCleanup Network',
        version: 'v1',
        narrative: {
          description: 'Environmental cleanup impact certificate from DeCleanup Network.',
          locations: [],
          wasteTypes: [],
          challenges: 'Community-driven environmental restoration',
          preventionIdeas: 'Continued environmental education and cleanup initiatives',
        },
      }

      finalMetadata = buildHypercertMetadata(metadataInput)
    }

    console.log('📤 Uploading metadata to IPFS...')
    const ipfsResult = await uploadHypercertMetadataToIPFS(finalMetadata, userAddress)
    const metadataCid = ipfsResult.hash

    console.log('✅ Metadata uploaded:', metadataCid)

    console.log('🪙 Minting Hypercert onchain...')
    const mintResult = await mintHypercertOnChain(userAddress, ipfsResult.url, options)

    console.log('🎉 Hypercert minting complete!')
    console.log('  Metadata CID:', metadataCid)
    console.log('  Hypercert ID:', mintResult.hypercertId)
    console.log('  Transaction:', mintResult.txHash)

    return {
      ...mintResult,
      metadataCid,
    }
  } catch (error) {
    console.error('❌ Hypercert minting failed:', error)
    throw error
  }
}
