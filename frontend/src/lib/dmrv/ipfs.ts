/**
 * IPFS Image Fetching for DMRV
 * Fetches images from IPFS using configured gateway
 */

import { getDMRVConfig } from './config'

/**
 * Fetch image from IPFS as Buffer
 * @param cid IPFS CID (Content Identifier)
 * @returns Image buffer
 */
export async function fetchImageFromIPFS(cid: string): Promise<Buffer> {
  const config = getDMRVConfig()
  
  // Clean CID (remove ipfs:// prefix if present)
  const cleanCid = cid.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0]
  
  if (!cleanCid) {
    throw new Error(`Invalid IPFS CID: ${cid}`)
  }
  
  // Try primary gateway first
  const primaryUrl = `${config.ipfsGateway}${cleanCid}`
  
  try {
    const response = await fetch(primaryUrl, {
      // Use no-cache to ensure fresh fetch
      cache: 'no-store',
    })
    
    if (!response.ok) {
      throw new Error(`IPFS fetch failed: ${response.status} ${response.statusText}`)
    }
    
    // Convert to buffer
    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  } catch (error) {
    // Try fallback gateways
    const fallbackGateways = [
      'https://ipfs.io/ipfs/',
      'https://dweb.link/ipfs/',
      'https://cloudflare-ipfs.com/ipfs/',
    ]
    
    for (const gateway of fallbackGateways) {
      try {
        const fallbackUrl = `${gateway}${cleanCid}`
        const response = await fetch(fallbackUrl, { cache: 'no-store' })
        
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          return Buffer.from(arrayBuffer)
        }
      } catch (fallbackError) {
        // Continue to next fallback
        continue
      }
    }
    
    // All gateways failed
    throw new Error(
      `Failed to fetch image from IPFS (CID: ${cleanCid}): ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Validate image format and size
 * @param buffer Image buffer
 * @returns true if valid
 */
export function validateImage(buffer: Buffer): boolean {
  // Check minimum size (at least 1KB)
  if (buffer.length < 1024) {
    return false
  }
  
  // Check maximum size (10MB)
  if (buffer.length > 10 * 1024 * 1024) {
    return false
  }
  
  // Check for common image magic bytes
  const magicBytes = buffer.slice(0, 4)
  const isJPEG = magicBytes[0] === 0xff && magicBytes[1] === 0xd8
  const isPNG = magicBytes[0] === 0x89 && magicBytes[1] === 0x50 && magicBytes[2] === 0x4e && magicBytes[3] === 0x47
  const isGIF = magicBytes[0] === 0x47 && magicBytes[1] === 0x49 && magicBytes[2] === 0x46
  const isWEBP = buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP'
  
  return isJPEG || isPNG || isGIF || isWEBP
}
