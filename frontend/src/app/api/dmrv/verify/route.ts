/**
 * DMRV Verification API Endpoint
 * POST /api/dmrv/verify
 * 
 * Input:
 * {
 *   submissionId: string
 *   beforeImageCid: string
 *   afterImageCid: string
 *   gps: { latitude: number, longitude: number }
 *   timestamp: number
 * }
 * 
 * Output:
 * {
 *   decision: "AUTO_APPROVED" | "MANUAL_REVIEW"
 *   confidence: number (0-1)
 *   modelHash: string
 *   resultHash: string
 *   analysis: { before, after, reasoning }
 *   timestamp: number
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyCleanup } from '@/lib/dmrv/verification'
import { VerificationRequest } from '@/lib/dmrv/types'
import { getDMRVConfig } from '@/lib/dmrv/config'
import { checkInMemoryRateLimit, getRateLimitKey, tooManyRequestsResponse } from '@/lib/server/rate-limit'
import { dmrvVerifyBodySchema, parseJsonBody } from '@/lib/server/api-request-guards'

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseJsonBody(request, dmrvVerifyBodySchema)
    if (!parsed.ok) return parsed.response

    const body = parsed.data
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

    // Check if DMRV is enabled
    const config = getDMRVConfig()
    if (!config.enabled) {
      return NextResponse.json(
        { error: 'DMRV service is disabled' },
        { status: 503 }
      )
    }

    // Build verification request
    const verificationRequest: VerificationRequest = {
      submissionId: body.submissionId,
      beforeImageCid: body.beforeImageCid,
      afterImageCid: body.afterImageCid,
      gps: {
        latitude: body.gps.latitude,
        longitude: body.gps.longitude,
      },
      timestamp: body.timestamp,
    }
    
    // Run verification
    const result = await verifyCleanup(verificationRequest)
    
    // Return result
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[DMRV API] Error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        error: 'Verification failed',
        message: errorMessage,
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET() {
  const config = getDMRVConfig()
  
  return NextResponse.json({
    service: 'DMRV',
    enabled: config.enabled,
    modelProvider: config.modelProvider,
    autoApproveThreshold: config.autoApproveThreshold,
    allowAutoApprove: config.allowAutoApprove,
    timestamp: Date.now(),
  })
}
