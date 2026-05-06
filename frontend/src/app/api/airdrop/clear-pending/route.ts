import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { loadAirdropStore, saveAirdropStore, setAirdropPending } from '@/lib/airdrop/store'

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const recipient = (body?.recipient ?? '').trim()
    if (!isAddress(recipient)) {
      return NextResponse.json({ error: 'Invalid or missing recipient' }, { status: 400 })
    }

    const store = loadAirdropStore()
    setAirdropPending(store, recipient, 0n)
    saveAirdropStore(store)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to clear pending claim' },
      { status: 500 }
    )
  }
}
