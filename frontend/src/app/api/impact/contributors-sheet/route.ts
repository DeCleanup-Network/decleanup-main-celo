/**
 * POST /api/impact/contributors-sheet
 *
 * After a cleanup with impact-report contributor emails, append rows to the
 * ops Google Sheet (Apps Script webhook). Non-fatal for the submitter if unset/fails.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody } from '@/lib/server/api-request-guards'
import { checkInMemoryRateLimit } from '@/lib/server/rate-limit'
import {
  appendContributorSheetRows,
  buildContributorSheetRows,
  isContributorSheetConfigured,
} from '@/lib/server/contributor-sheet'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  submissionId: z.string().regex(/^\d+$/),
  txHash: z.string().max(128).optional(),
  submitterWallet: z.string().max(128).optional(),
  impactIpfsCid: z.string().max(256).optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  impact: z.object({
    cleanupDate: z.string().max(64).optional(),
    campaignName: z.string().max(200).optional(),
    locationType: z.string().max(64).optional(),
    area: z.string().max(64).optional(),
    areaUnit: z.string().max(16).optional(),
    weight: z.string().max(64).optional(),
    weightUnit: z.string().max(16).optional(),
    bags: z.string().max(64).optional(),
    hours: z.string().max(16).optional(),
    minutes: z.string().max(16).optional(),
    wasteTypes: z.array(z.string().max(64)).max(32).optional(),
    contributors: z.array(z.string().email().max(254)).max(50),
    scopeOfWork: z.string().max(4000).optional(),
    environmentalChallenges: z.string().max(4000).optional(),
    preventionIdeas: z.string().max(4000).optional(),
    additionalNotes: z.string().max(4000).optional(),
    rightsAssignment: z.string().max(128).optional(),
  }),
})

export async function GET() {
  return NextResponse.json({
    configured: isContributorSheetConfigured(),
  })
}

export async function POST(request: NextRequest) {
  if (!isContributorSheetConfigured()) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: 'not_configured' },
      { status: 200 }
    )
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'

  const rateLimit = checkInMemoryRateLimit({
    key: `contributors-sheet:${ip}`,
    maxRequests: 20,
    windowMs: 60_000,
  })
  if (!rateLimit.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const parsed = await parseJsonBody(request, BodySchema)
  if (!parsed.ok) return parsed.response

  const rows = buildContributorSheetRows(parsed.data)
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, skipped: true, reason: 'no_rows' })
  }

  const result = await appendContributorSheetRows(rows)
  if (!result.ok) {
    console.warn('[contributors-sheet] append failed:', result.reason, result.detail ?? '')
    return NextResponse.json(
      { ok: false, reason: result.reason, detail: result.detail },
      { status: result.reason === 'webhook_error' ? 502 : 200 }
    )
  }

  return NextResponse.json({ ok: true, rows: result.rows })
}
