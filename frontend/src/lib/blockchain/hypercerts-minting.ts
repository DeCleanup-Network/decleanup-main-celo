// ---------------------------------------------------------------------------
// Hypercerts minting: real minting via Hypercerts SDK
// ---------------------------------------------------------------------------

import { TransferRestrictions } from '@hypercerts-org/sdk'
import { getAccount, waitForTransactionReceipt, writeContract } from '@wagmi/core'
import { getUserSubmissions, getCleanupDetails } from './contracts'
import { aggregateUserCleanups } from './hypercerts/aggregation'
import { buildHypercertMetadata } from './hypercerts/metadata'
import { uploadHypercertMetadataToIPFS } from './ipfs'
import { getConfig } from './get-wagmi-config'
import { HYPERCERTS_CONFIG } from './hypercerts/config'
import { HypercertMinterAbi } from '@hypercerts-org/contracts'

/**
 * Mint Hypercert onchain via Hypercerts SDK
 * @param userAddress User's wallet address
 * @param metadataUri IPFS URI of the metadata (ipfs://CID or https://gateway/ipfs/CID)
 * @returns Transaction result with Hypercert ID
 */
export async function mintHypercertOnChain(
  userAddress: string,
  metadataUri: string
): Promise<{ txHash: string; hypercertId: string }> {
  try {
    console.log('🪙 Minting Hypercert onchain...')
    console.log('  User:', userAddress)
    console.log('  Metadata URI:', metadataUri)

    const config = getConfig()
    const account = getAccount(config)
    const signer = account.address ?? (userAddress as `0x${string}`)
    if (!signer) {
      throw new Error('Wallet not connected. Please connect your wallet first.')
    }

    // Hypercert minter expects a CID-ish metadata ref (SDK passes CID, not full gateway URL).
    let metadataRef = metadataUri
    if (metadataUri.includes('/ipfs/')) {
      const cid = metadataUri.split('/ipfs/')[1].split('?')[0]
      metadataRef = cid
    } else if (metadataUri.startsWith('ipfs://')) {
      metadataRef = metadataUri.replace('ipfs://', '')
    }

    console.log('  Metadata ref:', metadataRef)

    const txHash = await writeContract(config, {
      address: HYPERCERTS_CONFIG.contract.address,
      abi: HypercertMinterAbi as any,
      functionName: 'mintClaim',
      args: [signer, BigInt(10000), metadataRef, TransferRestrictions.AllowAll],
      account: signer,
      chainId: HYPERCERTS_CONFIG.contract.chainId,
    })

    await waitForTransactionReceipt(config, {
      hash: txHash,
      chainId: HYPERCERTS_CONFIG.contract.chainId,
      confirmations: 1,
      pollingInterval: 2000,
      timeout: 120000,
    })

    console.log('✅ Hypercert minted successfully!')
    console.log('  Transaction hash:', txHash)

    // For now, we'll use the txHash as the hypercertId
    // The actual claim ID can be retrieved from contract events if needed
    const hypercertId = txHash

    return {
      txHash,
      hypercertId,
    }
  } catch (error) {
    console.error('❌ Failed to mint Hypercert:', error)
    throw error
  }
}

/**
 * Complete Hypercert minting flow
 * This is called by the user after their request is APPROVED
 * 
 * @param userAddress User's wallet address
 * @param metadata Pre-built metadata from the approved request
 * @returns Minting result with transaction hash and Hypercert ID
 */
export async function mintHypercert(
  userAddress: string,
  metadata?: any
): Promise<{ txHash: string; hypercertId: string; metadataCid: string }> {
  try {
    console.log('🎯 Starting Hypercert minting flow...')

    // If metadata not provided, build it from user's cleanups
    let finalMetadata = metadata
    
    if (!finalMetadata) {
      console.log('📊 Building metadata from user cleanups...')
      
      const submissions = await getUserSubmissions(userAddress as `0x${string}`)
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

      // Aggregate cleanups
      const summary = aggregateUserCleanups(verifiedCleanups)

      // Build metadata
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

    // 1. Upload metadata to IPFS
    console.log('📤 Uploading metadata to IPFS...')
    const ipfsResult = await uploadHypercertMetadataToIPFS(finalMetadata, userAddress)
    const metadataCid = ipfsResult.hash

    console.log('✅ Metadata uploaded:', metadataCid)

    // 2. Mint Hypercert onchain with metadata URI
    console.log('🪙 Minting Hypercert onchain...')
    const mintResult = await mintHypercertOnChain(userAddress, ipfsResult.url)

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