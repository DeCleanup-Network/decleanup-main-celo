/**
 * Impact Product IPFS Utilities
 * Functions for uploading and managing Impact Product images and metadata on IPFS
 */

import { uploadToIPFS, uploadJSONToIPFS, type IPFSUploadResult } from '@/lib/blockchain/ipfs'
import { getLevelName, CONSTANT_TRAITS, LEVEL_PROGRESSION } from './impact-product'

export interface ImpactProductMetadata {
  name: string
  description: string
  image: string // IPFS URL
  animation_url?: string // IPFS URL for level 10 GIF
  external_url?: string
  attributes: Array<{
    trait_type: string
    value: string | number
  }>
}

/**
 * Upload a single impact product image to IPFS
 * @param file Image file (PNG or GIF)
 * @param level Level number (1-10)
 * @returns IPFS hash and URL
 */
export async function uploadImpactProductImage(
  file: File,
  level: number
): Promise<IPFSUploadResult> {
  // Validate level
  if (level < 1 || level > 10) {
    throw new Error('Level must be between 1 and 10')
  }

  // Validate file type
  const validTypes = ['image/png', 'image/gif']
  if (!validTypes.includes(file.type)) {
    throw new Error('File must be PNG or GIF')
  }

  // Upload to IPFS
  const result = await uploadToIPFS(file)
  
  return result
}

/**
 * Upload all impact product images to IPFS
 * @param images Array of image files in order (IP1.png, IP2.png, ..., IP10.png, IP10.gif)
 * @returns Array of IPFS results with level mapping
 */
export async function uploadAllImpactProductImages(
  images: File[]
): Promise<Map<number, IPFSUploadResult>> {
  const results = new Map<number, IPFSUploadResult>()
  
  // Upload all images
  const uploadPromises = images.map(async (file, index) => {
    const level = index + 1
    if (level <= 10) {
      const result = await uploadImpactProductImage(file, level)
      results.set(level, result)
    }
  })

  await Promise.all(uploadPromises)
  
  return results
}

/**
 * Create metadata JSON for an impact product
 * @param level Level number (1-10)
 * @param imageHash IPFS hash of the image
 * @param animationHash Optional IPFS hash of animation (for level 10)
 * @param cleanupsCompleted Number of cleanups completed
 * @param hypercertsEarned Number of hypercerts earned
 * @returns Metadata object ready for IPFS upload
 */
export function createImpactProductMetadata(
  level: number,
  imageHash: string,
  animationHash?: string,
  cleanupsCompleted?: number,
  hypercertsEarned: number = 0
): ImpactProductMetadata {
  const levelName = getLevelName(level)
  // Use specific level number for Impact Value, not a range
  const impactValue = String(level)
  // Level = number of cleanups completed (each level represents one verified cleanup)
  const actualCleanupsCompleted = cleanupsCompleted ?? level
  const imageUrl = `ipfs://${imageHash}`
  const animationUrl = animationHash ? `ipfs://${animationHash}` : undefined

  const metadata: ImpactProductMetadata = {
    name: `DeCleanup Impact Product - Level ${level}`,
    description: `A tokenized representation of environmental cleanup impact. Level ${level} (${levelName}) Impact Product with ${actualCleanupsCompleted} cleanups completed and ${hypercertsEarned} hypercerts earned.`,
    image: imageUrl,
    external_url: process.env.NEXT_PUBLIC_APP_URL || 'https://decleanup.network',
    attributes: [
      // Constant Traits
      {
        trait_type: 'Type',
        value: CONSTANT_TRAITS.type,
      },
      {
        trait_type: 'Impact',
        value: CONSTANT_TRAITS.impact,
      },
      {
        trait_type: 'Category',
        value: CONSTANT_TRAITS.category,
      },
      // Dynamic Traits
      {
        trait_type: 'Impact Value',
        value: impactValue,
      },
      {
        trait_type: 'Level',
        value: levelName,
      },
      {
        trait_type: 'Level Number',
        value: level,
      },
      {
        trait_type: 'Cleanups Completed',
        value: actualCleanupsCompleted,
      },
      {
        trait_type: 'Hypercerts Earned',
        value: hypercertsEarned,
      },
    ],
  }

  // Add animation URL for level 10
  if (level === 10 && animationUrl) {
    metadata.animation_url = animationUrl
  }

  return metadata
}

/**
 * Upload impact product metadata to IPFS
 * @param level Level number (1-10)
 * @param imageHash IPFS hash of the image
 * @param animationHash Optional IPFS hash of animation (for level 10)
 * @param cleanupsCompleted Number of cleanups completed
 * @param hypercertsEarned Number of hypercerts earned
 * @returns IPFS hash and URL of the metadata
 */
export async function uploadImpactProductMetadata(
  level: number,
  imageHash: string,
  animationHash?: string,
  cleanupsCompleted: number = 0,
  hypercertsEarned: number = 0
): Promise<IPFSUploadResult> {
  const metadata = createImpactProductMetadata(
    level,
    imageHash,
    animationHash,
    cleanupsCompleted,
    hypercertsEarned
  )

  const result = await uploadJSONToIPFS(metadata, `impact-product-level-${level}`)
  
  return result
}

/**
 * Get IPFS URL from hash
 * @param hash IPFS hash (with or without ipfs:// prefix)
 * @returns Full IPFS URL
 */
export function getImpactProductIPFSUrl(hash: string): string {
  // Remove ipfs:// prefix if present
  const cleanHash = hash.replace(/^ipfs:\/\//, '')
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
  return `${gateway}${cleanHash}`
}

/**
 * Batch upload all impact product images and metadata
 * This is useful for initial setup
 * @param images Array of 10 PNG files (levels 1-10)
 * @param animation Optional GIF file for level 10
 * @returns Map of level to metadata IPFS hash
 */
export async function batchUploadImpactProducts(
  images: File[],
  animation?: File
): Promise<Map<number, { imageHash: string; metadataHash: string; animationHash?: string }>> {
  if (images.length !== 10) {
    throw new Error('Must provide exactly 10 image files (one for each level)')
  }

  const results = new Map<number, { imageHash: string; metadataHash: string; animationHash?: string }>()

  // Upload all images
  const imageResults = await uploadAllImpactProductImages(images)
  
  // Upload animation if provided
  let animationHash: string | undefined
  if (animation) {
    const animationResult = await uploadImpactProductImage(animation, 10)
    animationHash = animationResult.hash
  }

  // Upload metadata for each level
  for (let level = 1; level <= 10; level++) {
    const imageResult = imageResults.get(level)
    if (!imageResult) {
      throw new Error(`Failed to upload image for level ${level}`)
    }

    const metadataResult = await uploadImpactProductMetadata(
      level,
      imageResult.hash,
      level === 10 ? animationHash : undefined,
      0, // cleanupsCompleted - will be updated dynamically
      0  // hypercertsEarned - will be updated dynamically
    )

    results.set(level, {
      imageHash: imageResult.hash,
      metadataHash: metadataResult.hash,
      animationHash: level === 10 ? animationHash : undefined,
    })
  }

  return results
}

