import { NextResponse } from 'next/server'
import type { Address } from 'viem'
import { isAddress } from 'viem'
import { base, celo } from 'viem/chains'
import {
  fetchChainMetrics,
  getImpactApiConfig,
  tokenWeiToNumber,
} from '@/lib/api/decleanup-impact-metrics'

/**
 * Public SDG / impact metrics for third parties (e.g. Carbon Copy).
 *
 * Configure mainnet contracts (recommended: server-only env on Vercel):
 * - IMPACT_STATS_CELO_SUBMISSION_CONTRACT: Submission.sol on Celo mainnet (42220)
 * - IMPACT_STATS_BASE_SUBMISSION_CONTRACT: optional Submission on Base (8453) for combined cleanup counts only
 * - IMPACT_STATS_CELO_CDCU_CONTRACT: $cDCU token on Celo (minted supply from Transfer logs)
 * - IMPACT_STATS_CELO_RPC_URL / IMPACT_STATS_BASE_RPC_URL: optional RPC overrides
 * - IMPACT_STATS_CELO_FROM_BLOCK / IMPACT_STATS_BASE_FROM_BLOCK: optional start block (decimal or 0x hex)
 *
 * Falls back to NEXT_PUBLIC_* where noted in getImpactApiConfig() for local dev only.
 */

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const

const CACHE_HEADER =
  'public, s-maxage=3600, stale-while-revalidate=86400'

function asAddress(v: string | undefined): Address | undefined {
  if (!v?.trim()) return undefined
  return isAddress(v) ? (v as Address) : undefined
}

function combineChainWarnings(r: Awaited<ReturnType<typeof fetchChainMetrics>>): string | null {
  const parts: string[] = []
  if (!r.submission.ok) parts.push(`submission: ${r.submission.error}`)
  if (!r.token.ok) parts.push(`token: ${r.token.error}`)
  return parts.length ? parts.join(' · ') : null
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS_HEADERS } })
}

export async function GET() {
  const cfg = getImpactApiConfig()

  const celoSubmission = asAddress(cfg.celoSubmission)
  const baseSubmission = asAddress(cfg.baseSubmission)
  const celoCdcu = asAddress(cfg.celoCdcu)

  const baseEnabled = Boolean(baseSubmission)

  const [celoRes, baseRes] = await Promise.all([
    fetchChainMetrics(cfg.celoRpc, celo, celoSubmission, celoCdcu, cfg.celoFromBlock),
    baseEnabled
      ? fetchChainMetrics(cfg.baseRpc, base, baseSubmission, undefined, cfg.baseFromBlock)
      : Promise.resolve({
          metrics: {
            cleanupsVerified: 0,
            participantAddresses: new Set<string>(),
            tokenMintedWei: 0n,
          },
          submission: { ok: true },
          token: { ok: true },
        }),
  ])

  const participants = new Set<string>()
  for (const a of celoRes.metrics.participantAddresses) participants.add(a)
  for (const a of baseRes.metrics.participantAddresses) participants.add(a)

  const totalCleanupsVerified =
    celoRes.metrics.cleanupsVerified + baseRes.metrics.cleanupsVerified

  const errors = {
    celo: combineChainWarnings(celoRes),
    base: baseEnabled ? combineChainWarnings(baseRes) : null,
  }

  const partial = errors.celo !== null || errors.base !== null

  const chains = baseEnabled ? (['celo', 'base'] as const) : (['celo'] as const)

  const body = {
    project: 'DeCleanup Network',
    website: 'https://decleanup.network',
    sdgs: [12, 13, 15] as const,
    chains,
    metrics: {
      total_cleanups_verified: totalCleanupsVerified,
      total_participants: participants.size,
      total_tokens_distributed: {
        cDCU: tokenWeiToNumber(celoRes.metrics.tokenMintedWei),
      },
    },
    last_updated: new Date().toISOString(),
    partial,
    errors,
  }

  return NextResponse.json(body, {
    headers: {
      ...CORS_HEADERS,
      'Cache-Control': CACHE_HEADER,
    },
  })
}
