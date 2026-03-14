/**
 * POST /api/cdcu/unlock
 *
 * Resets issued + pending for an address so they can claim again.
 * Use when the claim tx failed or tokens never arrived but the backend had already recorded it.
 *
 * Body: { recipient: string, secret: string }
 * Requires CLAIM_VAULT_UNLOCK_SECRET in env to match body.secret (or set secret in .env and pass it here).
 */

import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { resetIssuedAndPending } from '@/lib/cdcu/claim-signing'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = body?.recipient?.trim()
    const secret = body?.secret?.trim()
    if (!recipient || !isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }
    const expected = process.env.CLAIM_VAULT_UNLOCK_SECRET?.trim()
    if (!expected) {
      return NextResponse.json(
        { error: 'Unlock not configured: set CLAIM_VAULT_UNLOCK_SECRET in .env' },
        { status: 503 }
      )
    }
    if (secret !== expected) {
      return NextResponse.json({ error: 'Invalid secret' }, { status: 401 })
    }
    resetIssuedAndPending(recipient)
    return NextResponse.json({ ok: true, message: 'Unlocked; you can claim again.' })
  } catch (e) {
    console.error('unlock error:', e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unlock failed' },
      { status: 500 }
    )
  }
}
