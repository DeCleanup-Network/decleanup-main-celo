/**
 * POST /api/impact/cleanup-meta
 *
 * Store recyclables amount for a submission (not on-chain today). Server verifies
 * the submission has recyclables attached on chain before persisting.
 *
 * Body: { submissionId: string, amount: number, unit: "kg"|"g"|"lb"|"bag" }
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCleanupDetailsFresh } from '@/lib/blockchain/contracts'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import {
  formatRecyclablesDisplay,
  recyclablesUnitToKg,
} from '@/lib/impact/location-label'
import { buildCleanupSummary } from '@/lib/impact/cleanup-feed-format'
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
  amount: z.number().positive(),
  unit: z.enum(['kg', 'g', 'lb', 'bag']),
})

export async function POST(request: NextRequest) {
  if (!isCleanupFeedConfigured()) {
    return NextResponse.json({ error: 'Cleanup feed not configured' }, { status: 503 })
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const rateLimit = checkInMemoryRateLimit({
    key: `cleanup-meta:${ip}`,
    maxRequests: 30,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return parsed.response

  const { submissionId, amount, unit } = parsed.data

  try {
    const details = await getCleanupDetailsFresh(BigInt(submissionId))
    if (details.user === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }
    if (!details.hasRecyclables) {
      return NextResponse.json(
        { error: 'Submission has no recyclables on chain' },
        { status: 400 }
      )
    }

    const amountKg = recyclablesUnitToKg(amount, unit)
    const amountDisplay = formatRecyclablesDisplay(amount, unit)
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
      has_recyclables: true,
      recyclables_amount_kg: null,
      recyclables_amount_display: null,
      recyclables_photo_cid: (details.recyclablesPhotoHash || '').replace(/^ipfs:\/\//, ''),
      recyclables_receipt_cid: (details.recyclablesReceiptHash || '').replace(/^ipfs:\/\//, ''),
      before_photo_cid: (details.beforePhotoHash || '').replace(/^ipfs:\/\//, ''),
      after_photo_cid: (details.afterPhotoHash || '').replace(/^ipfs:\/\//, ''),
      impact_ipfs_cid: (details.impactFormDataHash || '').replace(/^ipfs:\/\//, ''),
      summary: '',
      synced_at: nowIso,
    }

    const updated = {
      ...base,
      has_recyclables: true,
      recyclables_amount_kg: amountKg,
      recyclables_amount_display: amountDisplay,
      synced_at: nowIso,
      summary: '',
    }
    updated.summary = buildCleanupSummary(updated)

    await upsertCleanupFeedRows([updated])

    return NextResponse.json({ ok: true, submissionId, amountKg, amountDisplay })
  } catch (e) {
    console.error('[POST /api/impact/cleanup-meta]', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save cleanup meta' },
      { status: 500 }
    )
  }
}
