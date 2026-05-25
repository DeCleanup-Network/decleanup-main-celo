import { NextResponse } from 'next/server'
import { resolveEnsToAddress } from '@/lib/server/ens'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const raw = searchParams.get('name')?.trim()
  if (!raw) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  }

  const address = await resolveEnsToAddress(raw)
  return NextResponse.json({ address })
}
