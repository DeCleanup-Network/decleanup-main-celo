import 'server-only'

import type { Address } from 'viem'
import type { PortfolioHypercertRecord } from '@/lib/impact/public-portfolio-shared'
import { listHypercertRequestsForPortfolio } from '@/lib/supabase/hypercert-requests-db'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'

function requestToPortfolioRecord(
  req: Awaited<ReturnType<typeof listHypercertRequestsForPortfolio>>[number],
  contributorAddress: Address
): PortfolioHypercertRecord | null {
  if (!req.atUri) return null
  const timeframe = req.metadata?.hypercert?.work_timeframe?.value
  return {
    requestId: req.id,
    atUri: req.atUri,
    title: req.metadata?.name,
    status: req.status,
    workTimeframeStart: timeframe?.[0],
    workTimeframeEnd: timeframe?.[1],
    publishedAt: req.atPublishedAt ?? req.reviewedAt ?? req.submittedAt,
    contributorAddress,
  }
}

/** Load published hypercerts by EOA with legacy Safe requester fallback. */
export async function fetchPortfolioHypercerts(
  eoaAddress: Address,
  legacySmartAccount?: Address | null
): Promise<PortfolioHypercertRecord[]> {
  const requests = await listHypercertRequestsForPortfolio(
    eoaAddress,
    legacySmartAccount ?? undefined
  )
  if (requests.length === 0) return []

  const contributorCache = new Map<string, Address>()
  const resolveContributor = async (requester: string): Promise<Address> => {
    const key = requester.toLowerCase()
    const cached = contributorCache.get(key)
    if (cached) return cached
    const identity = await resolveWalletIdentity(requester).catch(() => null)
    const contributor = (identity?.publicAddress ?? requester) as Address
    contributorCache.set(key, contributor)
    return contributor
  }

  const out: PortfolioHypercertRecord[] = []
  for (const req of requests) {
    const contributor = await resolveContributor(req.requester)
    const record = requestToPortfolioRecord(req, contributor)
    if (record) out.push(record)
  }
  return out
}
