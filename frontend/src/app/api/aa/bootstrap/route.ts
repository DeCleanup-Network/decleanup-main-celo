import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Deprecated: wallets are created client-side. Use POST /api/aa/wallet to sync encrypted blob. */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Server wallet bootstrap is disabled. Wallets are created in your browser.',
      code: 'CUSTODIAL_BOOTSTRAP_DISABLED',
    },
    { status: 410 }
  )
}
