import { NextResponse } from 'next/server'
import { getAddress, isAddress, isHash } from 'viem'
import { markAirdropClaimed } from '@/lib/airdrop/store'
import { hasAirdropClaimInTx } from '@/lib/airdrop/onchain-claimed'

/** Body: { recipient, txHash } — txHash must contain the recipient's airdrop claim. */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = (body?.recipient ?? '').trim()
    const txHash = typeof body?.txHash === 'string' ? body.txHash.trim() : ''
    if (!isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }
    if (!isHash(txHash)) {
      return NextResponse.json({ error: 'Invalid or missing txHash' }, { status: 400 })
    }
    if (!(await hasAirdropClaimInTx(getAddress(recipient), txHash as `0x${string}`))) {
      return NextResponse.json(
        { error: 'Transaction does not contain an airdrop claim for this recipient' },
        { status: 400 }
      )
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
