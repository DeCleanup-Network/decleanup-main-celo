/**
 * IPFS Upload Utility
 * Handles photo uploads to IPFS using Pinata
 */

export interface IPFSUploadResult {
  hash: string
  url: string
}

/**
 * Upload file to IPFS using Pinata
 * @param file File to upload
 * @returns IPFS hash (CID) and URL
 */
export async function uploadToIPFS(file: File): Promise<IPFSUploadResult> {
  try {
    // Use API route to avoid CORS issues
    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: 'cleanup-photo',
        timestamp: new Date().toISOString(),
      },
    })
    formData.append('metadata', metadata)

    // Add options
    const options = JSON.stringify({
      cidVersion: 1,
      wrapWithDirectory: false,
    })
    formData.append('options', options)

    // Upload via our API route (avoids CORS)
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('IPFS upload error:', errorData)
      throw new Error(`Failed to upload to IPFS: ${errorData.error || response.statusText || 'Network error'}`)
    }

    const data = await response.json()
    const ipfsHash = data.hash
    const ipfsUrl = data.url

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from upload')
    }

    return {
      hash: ipfsHash,
      url: ipfsUrl,
    }
  } catch (error) {
    console.error('IPFS upload error:', error)
    if (error instanceof Error) {
      // Provide more helpful error messages
      if (error.message.includes('Network') || error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Please check your internet connection and try again.')
      }
      throw error
    }
    throw new Error('Failed to upload to IPFS')
  }
}

/**
 * Upload multiple files to IPFS
 * @param files Array of files to upload
 * @returns Array of IPFS hashes and URLs
 */
export async function uploadMultipleToIPFS(files: File[]): Promise<IPFSUploadResult[]> {
  const uploadPromises = files.map(file => uploadToIPFS(file))
  return Promise.all(uploadPromises)
}

/**
 * Upload JSON data to IPFS using Pinata
 * @param data JSON data to upload
 * @param name Name for the metadata
 * @returns IPFS hash (CID) and URL
 */
export async function uploadJSONToIPFS(data: any, name: string = 'data'): Promise<IPFSUploadResult> {
  try {
    // Create JSON blob
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const jsonFile = new File([jsonBlob], `${name}.json`, { type: 'application/json' })

    // Use the same upload function (which uses API route)
    return await uploadToIPFS(jsonFile)
  } catch (error) {
    console.error('IPFS JSON upload error:', error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error('Failed to upload JSON to IPFS')
  }
}

/**
 * Get IPFS URL from hash with fallback gateways
 * @param hash IPFS hash
 * @returns Full IPFS URL (uses first gateway, fallbacks handled in image onError)
 */
export function getIPFSUrl(hash: string): string {
  if (!hash) return ''
  
  // Clean hash (remove any query params or fragments)
  const cleanHash = hash.split('?')[0].split('#')[0]
  
  // Use configured gateway or default to ipfs.io (better CORS support)
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
  return `${gateway}${cleanHash}`
}

/**
 * Get fallback IPFS gateways for a hash
 * @param hash IPFS hash
 * @returns Array of fallback gateway URLs
 */
export function getIPFSFallbackUrls(hash: string): string[] {
  if (!hash) return []
  
  const cleanHash = hash.split('?')[0].split('#')[0]
  
  // List of IPFS gateways that support CORS
  const gateways = [
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
  ]
  
  return gateways.map(gateway => `${gateway}${cleanHash}`)
}

/**
 * Upload Hypercert metadata to IPFS
 * This creates a properly formatted JSON file for Hypercert metadata
 * @param metadata Hypercert metadata object
 * @param userAddress User's wallet address (for filename)
 * @returns IPFS hash (CID) and URL
 */
export async function uploadHypercertMetadataToIPFS(
  metadata: any,
  userAddress: string
): Promise<IPFSUploadResult> {
  try {
    console.log('📤 Uploading Hypercert metadata to IPFS...')
    
    // Create a properly formatted metadata object
    const hypercertMetadata = {
      ...metadata,
      type: 'hypercert-metadata',
      standard: 'hypercerts-v1',
    }

    // Upload as JSON with descriptive name
    const timestamp = Date.now()
    const filename = `hypercert-${userAddress.slice(0, 8)}-${timestamp}`
    
    const result = await uploadJSONToIPFS(hypercertMetadata, filename)
    
    console.log('✅ Hypercert metadata uploaded:', result.hash)
    return result
  } catch (error) {
    console.error('❌ Failed to upload Hypercert metadata:', error)
    throw error
  }
}