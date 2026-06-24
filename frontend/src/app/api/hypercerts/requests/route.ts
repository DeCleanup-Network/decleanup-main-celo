import { NextRequest, NextResponse } from 'next/server'
import { isAddress, keccak256, stringToBytes, verifyMessage, type Address } from 'viem'
import type { HypercertMetadata } from '@/lib/blockchain/hypercerts/types'
import {
  assertFreshTimestamp,
  buildCreateRequestMessageCompact,
} from '@/lib/blockchain/hypercerts/request-signing'
import {
  hasOpenHypercertWorkflowForUser,
  countPublishedHypercertsForUser,
  insertHypercertRequest,
  listHypercertRequests,
  listHypercertRequestsForPortfolio,
} from '@/lib/supabase/hypercert-requests-db'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { extractImpactSummaryFromMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isMissingTableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.includes("Could not find the table") && msg.includes('hypercert_requests')
}

function isRlsError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.toLowerCase().includes('row-level security')
}

function isMissingSupabaseServerCreds(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return (
    msg.includes('Missing Supabase server credentials') ||
    msg.includes('SUPABASE_SERVICE_ROLE_KEY')
  )
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const requester = searchParams.get('requester')?.trim()
    const legacyRequester = searchParams.get('legacyRequester')?.trim()
    const status = searchParams.get('status')?.trim() as
      | 'PENDING'
      | 'APPROVED'
      | 'REJECTED'
      | 'MINTED'
      | undefined

    if (requester && !isAddress(requester)) {
      return NextResponse.json({ error: 'Invalid requester address' }, { status: 400 })
    }
    if (legacyRequester && !isAddress(legacyRequester)) {
      return NextResponse.json({ error: 'Invalid legacy requester address' }, { status: 400 })
    }

    const requests =
      requester && legacyRequester
        ? await listHypercertRequestsForPortfolio(requester, legacyRequester, {
            status: status || undefined,
          })
        : await listHypercertRequests({
            requester: requester || undefined,
            status: status || undefined,
          })

    return NextResponse.json({ success: true, requests })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json({
        success: true,
        requests: [],
        warning: 'hypercert_requests table not migrated yet',
      })
    }
    if (isRlsError(e) || isMissingSupabaseServerCreds(e)) {
      return NextResponse.json({
        success: true,
        requests: [],
        warning:
          'Hypercert requests DB unavailable (missing SUPABASE_SERVICE_ROLE_KEY or RLS). List is empty until server env is fixed.',
      })
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to list requests' },
      { status: 500 }
    )
  }
}

type CreateBody = {
  metadataRaw: string
  metadataCommitment: `0x${string}`
  requester: string
  timestamp: number
  signature: `0x${string}`
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBody
    const requester = body.requester?.trim()

    if (!requester || !isAddress(requester)) {
      return NextResponse.json({ error: 'Invalid requester' }, { status: 400 })
    }
    if (!body.metadataRaw || !body.metadataCommitment || !body.signature) {
      return NextResponse.json({ error: 'Missing metadata or signature' }, { status: 400 })
    }
    if (!body.timestamp) {
      return NextResponse.json({ error: 'Missing timestamp' }, { status: 400 })
    }

    assertFreshTimestamp(body.timestamp)

    const digest = keccak256(stringToBytes(body.metadataRaw))
    if (digest.toLowerCase() !== body.metadataCommitment.toLowerCase()) {
      return NextResponse.json({ error: 'Metadata commitment mismatch' }, { status: 400 })
    }

    let metadata: HypercertMetadata
    try {
      metadata = JSON.parse(body.metadataRaw) as HypercertMetadata
    } catch {
      return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 })
    }
    if (!metadata?.name || !metadata?.hypercert) {
      return NextResponse.json({ error: 'Invalid hypercert metadata shape' }, { status: 400 })
    }

    const message = buildCreateRequestMessageCompact({
      requester: requester as Address,
      metadataCommitment: body.metadataCommitment,
      timestamp: body.timestamp,
    })

    const valid = await verifyMessage({
      address: requester as Address,
      message,
      signature: body.signature,
    })
    if (!valid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 })
    }

    if (await hasOpenHypercertWorkflowForUser(requester)) {
      return NextResponse.json(
        {
          error:
            'You already have an open Hypercert request (pending review or awaiting AT publication).',
        },
        { status: 409 }
      )
    }

    const publishedCount = await countPublishedHypercertsForUser(requester)
    const summary = extractImpactSummaryFromMetadata(metadata)
    const eligibility = checkHypercertEligibility({
      cleanupsCount: Number(summary.totalCleanups) || 0,
      reportsCount: Number(summary.totalReports) || 0,
      publishedCount,
      chainId: REQUIRED_CHAIN_ID,
    })
    if (!eligibility.eligible) {
      return NextResponse.json(
        { error: eligibility.reason ?? 'Not eligible for another Hypercert yet.' },
        { status: 409 }
      )
    }

    const id = crypto.randomUUID()
    const submittedAt = Date.now()

    const created = await insertHypercertRequest({
      id,
      requester,
      metadata,
      submittedAt,
    })

    return NextResponse.json({ success: true, request: created })
  } catch (e) {
    if (isMissingTableError(e)) {
      return NextResponse.json(
        { error: 'Database not ready: run hypercert_requests migration in Supabase.' },
        { status: 503 }
      )
    }
    if (isRlsError(e)) {
      return NextResponse.json(
        {
          error:
            'Hypercert requests DB is blocked by RLS for this server key. Use SUPABASE_SERVICE_ROLE_KEY on the server for /api/hypercerts/requests.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create request' },
      { status: 500 }
    )
  }
}
