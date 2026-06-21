/**
 * IPFS Upload Utility
 * Handles photo uploads to IPFS using Pinata
 */

export interface IPFSUploadResult {
  hash: string
  url: string
}

type IpfsDiagnostic = {
  pinataEnv?: string
  pinataReachable?: 'unknown' | 'ok' | 'failed'
  pinataTestStatus?: number | null
  pinataTestError?: string | null
}

const UPLOAD_RETRIES = 3
const UPLOAD_RETRY_DELAY_MS = 2_000
const UPLOAD_TIMEOUT_MS = 120_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function getIpfsDiagnosticHint(): Promise<string | null> {
  try {
    const res = await fetch('/api/ipfs/upload', { method: 'GET' })
    if (!res.ok) return null
    const data = (await res.json().catch(() => ({}))) as IpfsDiagnostic
    if (data.pinataEnv === 'missing') {
      return 'Server is missing PINATA_JWT. Set it in server environment and restart the app process.'
    }
    if (data.pinataReachable === 'failed') {
      return `Server cannot reach Pinata (${data.pinataTestError || 'network error'}). Check VPS outbound HTTPS and DNS.`
    }
    if (typeof data.pinataTestStatus === 'number' && data.pinataTestStatus !== 200) {
      return `Pinata rejected credentials (status ${data.pinataTestStatus}). Regenerate PINATA_JWT and update server env.`
    }
    return null
  } catch {
    return null
  }
}

/**
 * Upload file to IPFS using Pinata
 * @param file File to upload
 * @returns IPFS hash (CID) and URL
 */
export async function uploadToIPFS(
  file: File,
  options?: { pinataKeyvalueType?: string; retries?: number }
): Promise<IPFSUploadResult> {
  const maxAttempts = options?.retries ?? UPLOAD_RETRIES
  let lastError: Error | null = null

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await uploadToIPFSOnce(file, options?.pinataKeyvalueType)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      const retryable =
        attempt < maxAttempts - 1 &&
        (/network|fetch|timeout|429|502|503|504/i.test(lastError.message) ||
          lastError.message.includes('Could not reach'))
      if (!retryable) break
      await sleep(UPLOAD_RETRY_DELAY_MS * (attempt + 1))
    }
  }

  throw lastError ?? new Error('Failed to upload to IPFS')
}

async function uploadToIPFSOnce(
  file: File,
  pinataKeyvalueType?: string
): Promise<IPFSUploadResult> {
  try {
    // Use API route to avoid CORS issues
    const formData = new FormData()
    formData.append('file', file)

    // Add metadata
    const metadata = JSON.stringify({
      name: file.name,
      keyvalues: {
        type: pinataKeyvalueType ?? 'cleanup-photo',
        timestamp: new Date().toISOString(),
      },
    })
    formData.append('metadata', metadata)

    const pinataBodyOptions = JSON.stringify({
      cidVersion: 1,
      wrapWithDirectory: false,
    })
    formData.append('options', pinataBodyOptions)

    // Upload via our API route (avoids CORS)
    const response = await fetch('/api/ipfs/upload', {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('IPFS upload error:', errorData)
      const baseMessage = errorData.error || response.statusText || 'Network error'
      const baseString = String(baseMessage)
      const looksLikePinataAuthIssue =
        response.status === 502 ||
        /pinata rejected|invalid api credentials|pinata|credentials/i.test(baseString)

      if (looksLikePinataAuthIssue) {
        const diagnostic = await getIpfsDiagnosticHint()
        throw new Error(
          `Failed to upload to IPFS: ${baseString}` +
            (diagnostic ? ` ${diagnostic}` : ' Open GET /api/ipfs/upload for diagnostic.')
        )
      }

      throw new Error(`Failed to upload to IPFS: ${baseString}`)
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
      // Re-throw our own structured errors unchanged
      if (
        error.message.startsWith('Failed to upload to IPFS') ||
        error.message.startsWith('No IPFS hash')
      ) {
        throw error
      }
      const msg = error.message
      const isFetchFail =
        msg.includes('Failed to fetch') ||
        msg.includes('Load failed') ||
        error.name === 'TypeError' ||
        msg.includes('NetworkError') ||
        msg.includes('Network request failed')

      if (isFetchFail) {
        throw new Error(
          'Could not reach this site’s upload service (browser network error). ' +
            'This is not your wallet’s blockchain network—try Wi‑Fi, disable VPN / iCloud Private Relay / content blockers, use a smaller JPEG, or try Chrome if you’re on Safari.'
        )
      }
      if (msg.includes('Network') || msg.includes('Failed to fetch')) {
        throw new Error(
          `${msg} If the problem persists, try another browser or network; wallet chain does not affect this upload step.`
        )
      }
      throw error
    }
    throw new Error('Failed to upload to IPFS')
  }
}

/** Upload before/after photos one at a time (more reliable on mobile Safari). */
export async function uploadCleanupPhotosSequentially(
  beforePhoto: File,
  afterPhoto: File
): Promise<{ beforeHash: IPFSUploadResult; afterHash: IPFSUploadResult }> {
  let beforeHash: IPFSUploadResult
  try {
    beforeHash = await uploadToIPFS(beforePhoto, { pinataKeyvalueType: 'cleanup-before-photo' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to upload before photo: ${message}`)
  }

  let afterHash: IPFSUploadResult
  try {
    afterHash = await uploadToIPFS(afterPhoto, { pinataKeyvalueType: 'cleanup-after-photo' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to upload after photo: ${message}`)
  }

  return { beforeHash, afterHash }
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

    // Same API route as photos; server accepts application/json + .json filename
    return await uploadToIPFS(jsonFile, { pinataKeyvalueType: 'impact-report-json' })
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

  const custom = process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim()
  const gateways = [
    ...(custom ? [custom.endsWith('/') ? custom : `${custom}/`] : []),
    'https://gateway.pinata.cloud/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://w3s.link/ipfs/',
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