/**
 * ML Verification API Endpoint (VPS Backend)
 * Orchestrates photo storage, GPU inference, and verification scoring
 *
 * POST /api/ml-verification/verify
 */

import { NextRequest, NextResponse } from 'next/server'
import { runFullVerification } from '@/lib/dmrv/gpu-verification'
import { checkInMemoryRateLimit, getRateLimitKey, tooManyRequestsResponse } from '@/lib/server/rate-limit'
import { mlVerifyBodySchema, parseJsonBody } from '@/lib/server/api-request-guards'
import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'
import { getMlBackendProxyConfig, forwardMlVerifyPost } from '@/lib/server/ml-backend-proxy'
import { rejectUnauthorizedMlIngress } from '@/lib/server/ml-ingress'
import { isMlVerificationEnabled } from '@/lib/server/ml-verification-enabled'
import {
  downloadAndStoreBothFromIpfs,
  writeMlVerificationResult,
} from '@/lib/server/ml-verification-photos'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = resolveUploadDir()
const GPU_SERVICE_URL = process.env.GPU_INFERENCE_SERVICE_URL || 'http://localhost:8000'
const GPU_SHARED_SECRET = process.env.GPU_SHARED_SECRET || ''

if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
  console.log('[ML Verification] Configuration:', {
    gpuServiceUrl: GPU_SERVICE_URL,
    hasSharedSecret: !!GPU_SHARED_SECRET,
    uploadDir: UPLOAD_DIR,
    publicUrlBase: process.env.PUBLIC_URL_BASE || 'http://localhost:3000',
  })
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
          'Automated photo verification is turned off. Your submission is onchain; human verifiers will still review your photos.',
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

    console.log(`[ML Verification] Downloading and storing photos...`)
    const { before: beforeImageUrl, after: afterImageUrl } = await downloadAndStoreBothFromIpfs(
      submissionId,
      beforeImageCid,
      afterImageCid,
      UPLOAD_DIR
    )

    console.log(`[ML Verification] Photos stored: before=${beforeImageUrl}, after=${afterImageUrl}`)

    if (beforeImageCid === afterImageCid) {
      console.warn(`[ML Verification] ⚠️ WARNING: Before and after images have the same IPFS CID: ${beforeImageCid}`)
    }

    const verificationResult = await runFullVerification(
      submissionId,
      beforeImageUrl,
      afterImageUrl
    )

    console.log(`[ML Verification] Detailed results:`, {
      beforeCount: verificationResult.beforeInference.objectCount,
      afterCount: verificationResult.afterInference.objectCount,
      delta: verificationResult.score.delta,
      score: verificationResult.score.score,
      verdict: verificationResult.score.verdict,
    })

    try {
      await writeMlVerificationResult(
        submissionId,
        verificationResult,
        { before: beforeImageUrl, after: afterImageUrl },
        UPLOAD_DIR
      )
    } catch (storeError) {
      console.warn('[ML Verification] Failed to store result file:', storeError)
    }

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
          error: process.env.NODE_ENV === 'development' && e instanceof Error ? e.message : 'Upstream unreachable',
          timestamp: Date.now(),
        },
        { status: 502 }
      )
    }
  }

  return NextResponse.json({
    service: 'ML Verification API',
    mlVerificationEnabled: true,
    ...(process.env.NODE_ENV === 'development'
      ? { gpuServiceUrl: GPU_SERVICE_URL, uploadDir: UPLOAD_DIR }
      : {}),
    timestamp: Date.now(),
  })
}
