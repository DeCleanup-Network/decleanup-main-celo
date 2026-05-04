/**
 * ML Verification API Endpoint (VPS Backend)
 * Orchestrates photo storage, GPU inference, and verification scoring
 * 
 * POST /api/ml-verification/verify
 */

import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { runFullVerification } from '@/lib/dmrv/gpu-verification'
import { checkInMemoryRateLimit, getRateLimitKey, tooManyRequestsResponse } from '@/lib/server/rate-limit'
import { mlVerifyBodySchema, parseJsonBody } from '@/lib/server/api-request-guards'
import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'
import { getMlBackendProxyConfig, forwardMlVerifyPost } from '@/lib/server/ml-backend-proxy'
import { rejectUnauthorizedMlIngress } from '@/lib/server/ml-ingress'
import { isMlVerificationEnabled } from '@/lib/server/ml-verification-enabled'

export const dynamic = 'force-dynamic'

/** IPFS gateway fetch when pulling CIDs for ML pipeline */
const IPFS_GATEWAY_FETCH_TIMEOUT_MS = 90_000

// Configuration
const UPLOAD_DIR = resolveUploadDir()
const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || 'http://localhost:3000'
const GPU_SERVICE_URL = process.env.GPU_INFERENCE_SERVICE_URL || 'http://localhost:8000'
const GPU_SHARED_SECRET = process.env.GPU_SHARED_SECRET || ''

// Log configuration on startup (for debugging)
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
  console.log('[ML Verification] Configuration:', {
    gpuServiceUrl: GPU_SERVICE_URL,
    hasSharedSecret: !!GPU_SHARED_SECRET,
    uploadDir: UPLOAD_DIR,
    publicUrlBase: PUBLIC_URL_BASE,
  })
}

/**
 * Store photo on VPS filesystem
 */
async function storePhoto(
  submissionId: string,
  phase: 'before' | 'after',
  imageBuffer: Buffer
): Promise<string> {
  // Create submission directory
  const submissionDir = join(UPLOAD_DIR, submissionId)
  if (!existsSync(submissionDir)) {
    await mkdir(submissionDir, { recursive: true })
  }
  
  // Save photo
  const filename = `${phase}.jpg`
  const filepath = join(submissionDir, filename)
  await writeFile(filepath, imageBuffer)
  
  // Return public URL (use API route to serve images)
  const publicUrl = `${PUBLIC_URL_BASE}/api/uploads/${submissionId}/${filename}`
  return publicUrl
}

/**
 * Download image from IPFS and store on VPS
 */
async function downloadAndStore(
  submissionId: string,
  phase: 'before' | 'after',
  ipfsCid: string
): Promise<string> {
  // Fetch from IPFS
  const ipfsGateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
  // Clean CID: remove ipfs:// prefix, query params, and fragment identifiers
  // Consistent with frontend/src/lib/dmrv/ipfs.ts
  const cleanCid = ipfsCid.replace(/^ipfs:\/\//, '').split('?')[0].split('#')[0]
  const ipfsUrl = `${ipfsGateway}${cleanCid}`

  const response = await fetch(ipfsUrl, {
    signal: AbortSignal.timeout(IPFS_GATEWAY_FETCH_TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch image from IPFS: ${response.status}`)
  }
  
  const imageBuffer = Buffer.from(await response.arrayBuffer())
  
  // Store on VPS
  const publicUrl = await storePhoto(submissionId, phase, imageBuffer)
  return publicUrl
}

export async function POST(request: NextRequest) {
  try {
    const ingress = rejectUnauthorizedMlIngress(request)
    if (ingress) return ingress

    const parsed = await parseJsonBody(request, mlVerifyBodySchema)
    if (!parsed.ok) return parsed.response

    const body = parsed.data

    if (!isMlVerificationEnabled()) {
      return NextResponse.json({
        mlVerificationDisabled: true,
        submissionId: body.submissionId,
        message:
          'Automated photo verification is turned off. Your submission is on-chain; human verifiers will still review your photos.',
      })
    }
    const walletAddress =
      body.walletAddress ||
      body.wallet ||
      body.address ||
      request.headers.get('x-wallet-address') ||
      request.headers.get('x-address') ||
      null
    const rateLimit = checkInMemoryRateLimit({
      key: getRateLimitKey(request, walletAddress),
      maxRequests: 8,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return tooManyRequestsResponse(rateLimit.resetAt)
    }

    const proxy = getMlBackendProxyConfig()
    if (proxy.enabled) {
      const upstream = await forwardMlVerifyPost(JSON.stringify(body))
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
        },
      })
    }

    const { submissionId, beforeImageCid, afterImageCid } = body
    
    console.log(`[ML Verification] Processing submission ${submissionId}...`)
    
    // Download and store photos on VPS
    console.log(`[ML Verification] Downloading and storing photos...`)
    const [beforeImageUrl, afterImageUrl] = await Promise.all([
      downloadAndStore(submissionId, 'before', beforeImageCid),
      downloadAndStore(submissionId, 'after', afterImageCid),
    ])
    
    console.log(`[ML Verification] Photos stored: before=${beforeImageUrl}, after=${afterImageUrl}`)
    
    // Validate that images are different
    if (beforeImageCid === afterImageCid) {
      console.warn(`[ML Verification] ⚠️ WARNING: Before and after images have the same IPFS CID: ${beforeImageCid}`)
      console.warn(`[ML Verification] This means the same image was uploaded twice. AI verification will likely reject this.`)
    }
    
    // Run full verification (calls GPU service)
    const verificationResult = await runFullVerification(
      submissionId,
      beforeImageUrl,
      afterImageUrl
    )
    
    // Log detailed results for debugging
    console.log(`[ML Verification] Detailed results:`, {
      beforeCount: verificationResult.beforeInference.objectCount,
      afterCount: verificationResult.afterInference.objectCount,
      delta: verificationResult.score.delta,
      score: verificationResult.score.score,
      verdict: verificationResult.score.verdict,
      beforeConfidence: verificationResult.beforeInference.meanConfidence,
      afterConfidence: verificationResult.afterInference.meanConfidence,
    })
    
    // Store result for verifier dashboard access
    try {
      const resultFile = join(UPLOAD_DIR, submissionId, 'ml_result.json')
      const resultDir = join(UPLOAD_DIR, submissionId)
      if (!existsSync(resultDir)) {
        await mkdir(resultDir, { recursive: true })
      }
      await writeFile(resultFile, JSON.stringify({
        submissionId,
        score: verificationResult.score,
        hash: verificationResult.hash,
        beforeInference: verificationResult.beforeInference,
        afterInference: verificationResult.afterInference,
        imageUrls: {
          before: beforeImageUrl,
          after: afterImageUrl,
        },
        timestamp: Date.now(),
      }, null, 2))
    } catch (storeError) {
      console.warn('[ML Verification] Failed to store result file:', storeError)
      // Don't fail the request if storage fails
    }
    
    // Return result with hash for onchain storage
    return NextResponse.json({
      submissionId,
      score: verificationResult.score,
      hash: verificationResult.hash,
      beforeInference: verificationResult.beforeInference,
      afterInference: verificationResult.afterInference,
      imageUrls: {
        before: beforeImageUrl,
        after: afterImageUrl,
      },
    })
    
  } catch (error) {
    console.error('[ML Verification] Error:', error)
    
    return NextResponse.json(
      {
        error: 'Verification failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Health check
export async function GET(request: NextRequest) {
  const ingress = rejectUnauthorizedMlIngress(request)
  if (ingress) return ingress

  if (!isMlVerificationEnabled()) {
    return NextResponse.json({
      service: 'ML Verification API',
      mlVerificationEnabled: false,
      message: 'Automated verification is disabled on this deployment.',
      timestamp: Date.now(),
    })
  }

  const proxy = getMlBackendProxyConfig()
  if (proxy.enabled) {
    try {
      const upstream = await fetch(`${proxy.origin}/api/ml-verification/verify`, {
        method: 'GET',
        headers: { 'x-ml-proxy-secret': proxy.secret },
        signal: AbortSignal.timeout(15_000),
      })
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
        },
      })
    } catch (e) {
      return NextResponse.json(
        {
          service: 'ML Verification (Vercel proxy)',
          error: e instanceof Error ? e.message : 'Upstream unreachable',
          backend: proxy.origin,
          timestamp: Date.now(),
        },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({
    service: 'ML Verification API',
    mlVerificationEnabled: true,
    gpuServiceUrl: GPU_SERVICE_URL,
    uploadDir: UPLOAD_DIR,
    timestamp: Date.now(),
  })
}
