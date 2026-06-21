/**
 * POST /api/impact/cleanup-media — attach optional video CID to a submission (off-chain).
 * GET  /api/impact/cleanup-media?submissionId=123 — read optional video for verifiers.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCleanupDetailsFresh } from '@/lib/blockchain/contracts'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import {
  getCleanupFeedRow,
  isCleanupFeedConfigured,
  upsertCleanupFeedRows,
} from '@/lib/supabase/cleanup-feed'
import { parseJsonBody } from '@/lib/server/api-request-guards'
import { checkInMemoryRateLimit } from '@/lib/server/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  submissionId: z.string().regex(/^\d+$/),
  optionalVideoCid: z.string().min(1).max(256),
})

function clientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function GET(request: NextRequest) {
  if (!isCleanupFeedConfigured()) {
    return NextResponse.json({ optionalVideoCid: null, configured: false })
  }

  const submissionId = request.nextUrl.searchParams.get('submissionId')?.trim()
  if (!submissionId || !/^\d+$/.test(submissionId)) {
    return NextResponse.json({ error: 'submissionId required' }, { status: 400 })
  }

  try {
    const row = await getCleanupFeedRow(REQUIRED_CHAIN_ID, submissionId)
    const cid = row?.optional_video_cid?.trim() || ''
    return NextResponse.json({
      configured: true,
      submissionId,
      optionalVideoCid: cid || null,
    })
  } catch (e) {
    console.error('[GET /api/impact/cleanup-media]', e)
    return NextResponse.json({ optionalVideoCid: null }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!isCleanupFeedConfigured()) {
    return NextResponse.json({ error: 'Cleanup feed not configured' }, { status: 503 })
  }

  const rateLimit = checkInMemoryRateLimit({
    key: `cleanup-media:${clientIp(request)}`,
    maxRequests: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return parsed.response

  const { submissionId, optionalVideoCid } = parsed.data
  const cleanCid = optionalVideoCid.replace(/^ipfs:\/\//, '').trim()

  try {
    const details = await getCleanupDetailsFresh(BigInt(submissionId))
    if (details.user === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const existing = await getCleanupFeedRow(REQUIRED_CHAIN_ID, submissionId)
    const nowIso = new Date().toISOString()

    const base = existing ?? {
      submission_id: submissionId,
      chain_id: REQUIRED_CHAIN_ID,
      submitter: details.user.toLowerCase(),
      eoa_address: null,
      submitted_at: null,
      verified_at: null,
      latitude: null,
      longitude: null,
      location_type: '',
      location_place_name: null,
      location_label: '',
      area_sqm: 0,
      weight_kg: 0,
      bags: 0,
      duration_minutes: 0,
      waste_types: [],
      contributors_count: 0,
      has_impact_report: Boolean(details.hasImpactForm),
      has_recyclables: Boolean(details.hasRecyclables),
      recyclables_amount_kg: null,
      recyclables_amount_display: null,
      recyclables_photo_cid: (details.recyclablesPhotoHash || '').replace(/^ipfs:\/\//, ''),
      recyclables_receipt_cid: (details.recyclablesReceiptHash || '').replace(/^ipfs:\/\//, ''),
      before_photo_cid: (details.beforePhotoHash || '').replace(/^ipfs:\/\//, ''),
      after_photo_cid: (details.afterPhotoHash || '').replace(/^ipfs:\/\//, ''),
      impact_ipfs_cid: (details.impactFormDataHash || '').replace(/^ipfs:\/\//, ''),
      optional_video_cid: '',
      summary: '',
      synced_at: nowIso,
    }

    await upsertCleanupFeedRows([
      {
        ...base,
        optional_video_cid: cleanCid,
        synced_at: nowIso,
      },
    ])

    return NextResponse.json({ ok: true, submissionId, optionalVideoCid: cleanCid })
  } catch (e) {
    console.error('[POST /api/impact/cleanup-media]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save cleanup media' },
      { status: 500 }
    )
  }
}
