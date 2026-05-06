/**
 * Get ML Verification Result for a cleanup
 * GET /api/ml-verification/result?cleanupId=9
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

import { resolveUploadDir } from '@/lib/server/resolve-upload-dir'
import { getMlBackendProxyConfig, forwardMlResultGet } from '@/lib/server/ml-backend-proxy'
import { rejectUnauthorizedMlIngress } from '@/lib/server/ml-ingress'
import { isMlVerificationEnabled } from '@/lib/server/ml-verification-enabled'

const UPLOAD_DIR = resolveUploadDir()

// Mark as dynamic route (uses searchParams)
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const ingress = rejectUnauthorizedMlIngress(request)
    if (ingress) return ingress

    const searchParams = request.nextUrl.searchParams
    const cleanupId = searchParams.get('cleanupId')
    
    if (!cleanupId) {
      return NextResponse.json(
        { error: 'Missing cleanupId parameter' },
        { status: 400 }
      )
    }

    if (!isMlVerificationEnabled()) {
      return NextResponse.json({
        cleanupId,
        hasResult: false,
        mlVerificationDisabled: true,
        message: 'Automated verification is not active; there is no stored AI result for this submission.',
      })
    }

    const proxy = getMlBackendProxyConfig()
    if (proxy.enabled) {
      const upstream = await forwardMlResultGet(cleanupId)
      const text = await upstream.text()
      return new NextResponse(text, {
        status: upstream.status,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'application/json',
        },
      })
    }
    
    // Written by POST /api/ml-verification/verify → uploads/<cleanupId>/ml_result.json (see UPLOAD_DIR).

    // Check if we have stored results file
    const resultFile = join(UPLOAD_DIR, cleanupId, 'ml_result.json')
    
    if (existsSync(resultFile)) {
      const resultData = await readFile(resultFile, 'utf-8')
      const result = JSON.parse(resultData)
      return NextResponse.json(result)
    }
    
    // Return empty result if not found
    return NextResponse.json({
      cleanupId,
      hasResult: false,
      message: 'ML verification result not found. It may still be processing or was not performed.',
    })
    
  } catch (error) {
    console.error('[ML Result API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ML result' },
      { status: 500 }
    )
  }
}
