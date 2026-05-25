import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { resolveAddressToEnsName } from '@/lib/server/ens'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('address')?.trim()
  if (!raw || !isAddress(raw)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  const name = await resolveAddressToEnsName(raw)
  return NextResponse.json({ name })
}
