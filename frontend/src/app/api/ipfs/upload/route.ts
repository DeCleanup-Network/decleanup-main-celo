import { NextRequest, NextResponse } from 'next/server'

/**
 * API Route to proxy IPFS uploads to Pinata
 * This avoids CORS issues and keeps API keys server-side
 */
export async function POST(request: NextRequest) {
  try {
    // Get API keys from server-side environment variables (not NEXT_PUBLIC_*)
    // Support multiple naming conventions for backwards compatibility
    const pinataApiKey = 
      process.env.PINATA_API_KEY || 
      process.env.NEXT_PUBLIC_PINATA_API_KEY
    const pinataSecretKey = 
      process.env.PINATA_SECRET_KEY || 
      process.env.PINATA_SECRET_API_KEY ||
      process.env.NEXT_PUBLIC_PINATA_SECRET_KEY ||
      process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY

    if (!pinataApiKey || !pinataSecretKey) {
      return NextResponse.json(
        { error: 'Pinata API keys not configured on server' },
        { status: 500 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()
    const file = formData.get('file') as File
    const metadataStr = formData.get('metadata') as string | null
    const optionsStr = formData.get('options') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Create new FormData for Pinata
    const pinataFormData = new FormData()
    pinataFormData.append('file', file)

    // Parse and add metadata if provided
    if (metadataStr) {
      try {
        const metadata = JSON.parse(metadataStr)
        pinataFormData.append('pinataMetadata', JSON.stringify(metadata))
      } catch (e) {
        // If metadata is invalid JSON, create default metadata
        const defaultMetadata = {
          name: file.name,
          keyvalues: {
            type: 'cleanup-photo',
            timestamp: new Date().toISOString(),
          },
        }
        pinataFormData.append('pinataMetadata', JSON.stringify(defaultMetadata))
      }
    } else {
      // Default metadata if not provided
      const defaultMetadata = {
        name: file.name,
        keyvalues: {
          type: 'cleanup-photo',
          timestamp: new Date().toISOString(),
        },
      }
      pinataFormData.append('pinataMetadata', JSON.stringify(defaultMetadata))
    }

    // Parse and add options if provided
    if (optionsStr) {
      try {
        const options = JSON.parse(optionsStr)
        pinataFormData.append('pinataOptions', JSON.stringify(options))
      } catch (e) {
        // Default options if invalid
        const defaultOptions = {
          cidVersion: 1,
          wrapWithDirectory: false,
        }
        pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
      }
    } else {
      // Default options
      const defaultOptions = {
        cidVersion: 1,
        wrapWithDirectory: false,
      }
      pinataFormData.append('pinataOptions', JSON.stringify(defaultOptions))
    }

    // Upload to Pinata via server (no CORS issues)
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
      body: pinataFormData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Pinata upload error:', errorData)
      return NextResponse.json(
        { error: errorData.error?.reason || response.statusText || 'Failed to upload to IPFS' },
        { status: response.status || 500 }
      )
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash || data.hash || data.cid

    if (!ipfsHash) {
      return NextResponse.json(
        { error: 'No IPFS hash returned from Pinata' },
        { status: 500 }
      )
    }

    // Construct IPFS URL
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/'
    const ipfsUrl = `${gateway}${ipfsHash}`

    return NextResponse.json({
      hash: ipfsHash,
      url: ipfsUrl,
    })
  } catch (error: any) {
    console.error('IPFS upload API error:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to upload to IPFS' },
      { status: 500 }
    )
  }
}

