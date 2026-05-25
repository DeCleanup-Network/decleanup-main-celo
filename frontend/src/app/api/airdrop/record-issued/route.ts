import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { markAirdropClaimed } from '@/lib/airdrop/store'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = (body?.recipient ?? '').trim()
    if (!isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }

    await markAirdropClaimed(recipient)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to record issued claim' },
      { status: 500 }
    )
  }
}
