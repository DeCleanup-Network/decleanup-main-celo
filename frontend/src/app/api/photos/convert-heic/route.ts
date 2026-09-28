import { NextRequest, NextResponse } from 'next/server'
import { convertHeicToJpegIfNeeded } from '@/lib/server/convert-heic-for-pinata'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import {
  MAX_MULTIPART_BODY_BYTES,
  isAllowedCleanupImageMime,
  rejectIfContentLengthExceeds,
  toUploadedFile,
} from '@/lib/server/api-request-guards'
import { checkInMemoryRateLimit, getRateLimitKey, tooManyRequestsResponse } from '@/lib/server/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

function safeJpegName(name: string): string {
  const stem = name.replace(/\.(heic|heif|jpe?g|png|webp)$/i, '').replace(/[^\w.-]+/g, '_') || 'photo'
  return `${stem.slice(0, 80)}.jpg`
}

export async function POST(request: NextRequest) {
  const rateLimit = checkInMemoryRateLimit({
    key: `${getRateLimitKey(request)}:convert-heic`,
    maxRequests: 20,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return tooManyRequestsResponse(rateLimit.resetAt)
  }

  const tooLarge = rejectIfContentLengthExceeds(request, MAX_MULTIPART_BODY_BYTES)
  if (tooLarge) return tooLarge

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = toUploadedFile(formData.get('file'))
  if (!file) {
    return NextResponse.json({ error: 'No photo provided' }, { status: 400 })
  }
  if (file.size > MAX_MULTIPART_BODY_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 })
  }
  if (!isAllowedCleanupImageMime(file)) {
    return NextResponse.json({ error: 'Unsupported photo type' }, { status: 415 })
  }

  try {
    const jpeg = await convertHeicToJpegIfNeeded(file)
    const bytes = new Uint8Array(await jpeg.arrayBuffer())
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'Content-Disposition': `inline; filename="${safeJpegName(jpeg.name || file.name)}"`,
      },
    })
  } catch (error) {
    logApiError('POST /api/photos/convert-heic', error)
    return NextResponse.json(
      {
        error: apiErrorMessage(
          error,
          'Could not convert this iPhone photo. Pick it again, or try a JPEG from Photos.'
        ),
      },
      { status: 422 }
    )
  }
}
