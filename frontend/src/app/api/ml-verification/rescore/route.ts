/**
 * Re-run GPU scoring on photos already stored under UPLOAD_DIR (no IPFS re-download).
 *
 * POST /api/ml-verification/rescore
 * Body: { submissionId, normalizePhotos?: true }
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { existsSync } from 'fs'
import { runFullVerification } from '@/lib/dmrv/gpu-verification'
import { checkInMemoryRateLimit, getRateLimitKey, tooManyRequestsResponse } from '@/lib/server/rate-limit'
import { mlRescoreBodySchema, parseJsonBody } from '@/lib/server/api-request-guards'
import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'
import { getMlBackendProxyConfig, forwardMlRescorePost } from '@/lib/server/ml-backend-proxy'
import { rejectUnauthorizedMlIngress } from '@/lib/server/ml-ingress'
import { isMlVerificationEnabled } from '@/lib/server/ml-verification-enabled'
import {
  normalizeExistingSubmissionPhotos,
  submissionImageUrls,
  writeMlVerificationResult,
} from '@/lib/server/ml-verification-photos'

export const dynamic = 'force-dynamic'

const UPLOAD_DIR = resolveUploadDir()

export async function POST(request: NextRequest) {
  try {
    const ingress = rejectUnauthorizedMlIngress(request)
    if (ingress) return ingress

    const parsed = await parseJsonBody(request, mlRescoreBodySchema)
    if (!parsed.ok) return parsed.response

    const body = parsed.data

    if (!isMlVerificationEnabled()) {
      return NextResponse.json({
        mlVerificationDisabled: true,
        submissionId: body.submissionId,
        message: 'Automated photo verification is turned off on this deployment.',
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
      maxRequests: 12,
      windowMs: 60_000,
    })
    if (!rateLimit.ok) {
      return tooManyRequestsResponse(rateLimit.resetAt)
    }

    const proxy = getMlBackendProxyConfig()
    if (proxy.enabled) {
      const upstream = await forwardMlRescorePost(JSON.stringify(body))
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
        },
      })
    }

    const { submissionId } = body
    const submissionDir = join(UPLOAD_DIR, submissionId)
    if (!existsSync(submissionDir)) {
      return NextResponse.json(
        { error: 'Submission not found', message: `No upload folder for ${submissionId}` },
        { status: 404 }
      )
    }

    const normalizePhotos = body.normalizePhotos !== false
    if (normalizePhotos) {
      console.log(`[ML Rescore] Normalizing on-disk photos for ${submissionId}...`)
      await normalizeExistingSubmissionPhotos(submissionId, UPLOAD_DIR)
    }

    const imageUrls = submissionImageUrls(submissionId)
    console.log(`[ML Rescore] Running GPU inference for ${submissionId}...`)

    const verificationResult = await runFullVerification(
      submissionId,
      imageUrls.before,
      imageUrls.after
    )

    await writeMlVerificationResult(submissionId, verificationResult, imageUrls, UPLOAD_DIR)

    return NextResponse.json({
      submissionId,
      score: verificationResult.score,
      hash: verificationResult.hash,
      beforeInference: verificationResult.beforeInference,
      afterInference: verificationResult.afterInference,
      imageUrls,
      rescored: true,
    })
  } catch (error) {
    console.error('[ML Rescore] Error:', error)
    return NextResponse.json(
      {
        error: 'Rescore failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const ingress = rejectUnauthorizedMlIngress(request)
  if (ingress) return ingress

  return NextResponse.json({
    service: 'ML Verification Rescore API',
    mlVerificationEnabled: isMlVerificationEnabled(),
    description: 'POST with { submissionId } to re-run GPU scoring on stored photos without IPFS re-download.',
    timestamp: Date.now(),
  })
}
