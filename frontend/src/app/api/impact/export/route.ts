import { NextRequest, NextResponse } from 'next/server'
import { isAddress, type Address } from 'viem'
import { fetchPublicPortfolioData } from '@/lib/impact/public-portfolio-data'
import { getImpactPortfolioProfile } from '@/lib/supabase/impact-portfolios'
import { buildPortfolioDisclosureExport } from '@/lib/impact/portfolio-export'
import { resolveAddressToEnsName, resolveEnsTextRecords } from '@/lib/server/ens'
import { listPortfolioEndorsements } from '@/lib/supabase/impact-portfolio-endorsements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('address')?.trim()
    if (!raw || !isAddress(raw)) {
      return NextResponse.json({ error: 'Invalid or missing address' }, { status: 400 })
    }

    const address = raw as Address
    const sa = request.nextUrl.searchParams.get('sa')?.trim()
    const submissionOwner =
      sa && isAddress(sa) ? (sa as Address) : undefined

    const [data, profile, ensName, endorsements] = await Promise.all([
      fetchPublicPortfolioData(address, { submissionOwner }),
      getImpactPortfolioProfile(address).catch(() => null),
      resolveAddressToEnsName(address).catch(() => null),
      listPortfolioEndorsements(address).catch(() => []),
    ])

    const ensTextRecords = ensName ? await resolveEnsTextRecords(ensName).catch(() => ({})) : {}
    const origin = request.nextUrl.origin
    const portfolioUrl = `${origin}/impact/${address}`

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
      const filename = `decleanup-impact-portfolio-${address.slice(2, 8)}.json`
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
