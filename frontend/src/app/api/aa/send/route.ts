import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/** Deprecated: UserOperations are signed in the browser. */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Server-side signing is disabled. Unlock your wallet and sign locally.',
      code: 'SERVER_SIGNING_DISABLED',
    },
    { status: 410 }
  )
}
