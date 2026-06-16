import { NextRequest, NextResponse } from 'next/server'
import { isAddress, type Address } from 'viem'
import { fetchPublicPortfolioData } from '@/lib/impact/public-portfolio-data'
import { getImpactPortfolioProfileResolved } from '@/lib/supabase/impact-portfolios'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'
import { buildPortfolioDisclosureExport } from '@/lib/impact/portfolio-export'
import { resolveAddressToEnsName, resolveEnsTextRecords } from '@/lib/server/ens'
import { listPortfolioEndorsementsResolved } from '@/lib/supabase/impact-portfolio-endorsements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('address')?.trim()
    if (!raw || !isAddress(raw)) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }

    const identity = await resolveWalletIdentity(raw)
    const eoaAddress = (identity?.eoaAddress ?? raw) as Address
    const sa = request.nextUrl.searchParams.get('sa')?.trim()
    const submissionOwner =
      sa && isAddress(sa)
        ? (sa as Address)
        : identity?.smartAccountAddress &&
            identity.smartAccountAddress.toLowerCase() !== eoaAddress.toLowerCase()
          ? identity.smartAccountAddress
          : undefined

    const [data, profile, ensName, endorsements] = await Promise.all([
      fetchPublicPortfolioData(eoaAddress, { submissionOwner }),
      getImpactPortfolioProfileResolved(eoaAddress, identity?.smartAccountAddress).catch(() => null),
      resolveAddressToEnsName(eoaAddress).catch(() => null),
      listPortfolioEndorsementsResolved(eoaAddress, identity?.smartAccountAddress).catch(() => []),
    ])

    const ensTextRecords = ensName ? await resolveEnsTextRecords(ensName).catch(() => ({})) : {}
    const origin = request.nextUrl.origin
    const portfolioUrl = `${origin}/impact/${eoaAddress}`

    const payload = {
      ...buildPortfolioDisclosureExport({
        data,
        profile,
        ensName,
        portfolioUrl,
        ensTextRecords,
      }),
      endorsements,
    }

    const download = request.nextUrl.searchParams.get('download') === '1'
    if (download) {
      const filename = `decleanup-impact-portfolio-${eoaAddress.slice(2, 8)}.json`
      return new NextResponse(JSON.stringify(payload, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      })
    }

    return NextResponse.json({ success: true, export: payload })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Export failed' },
      { status: 500 }
    )
  }
}
