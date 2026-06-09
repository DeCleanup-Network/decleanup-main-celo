import { NextResponse } from 'next/server'
import { resolveEnsTextRecords } from '@/lib/server/ens'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name')?.trim()
  if (!name || !name.includes('.')) {
    return NextResponse.json({ error: 'Invalid ENS name' }, { status: 400 })
  }

  const records = await resolveEnsTextRecords(name)
  return NextResponse.json({ name, records })
}
