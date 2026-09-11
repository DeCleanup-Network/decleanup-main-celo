import { NextResponse } from 'next/server'
import { getVapidPublicKey } from '@/lib/server/notifications/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const key = getVapidPublicKey()
  if (!key) {
    return NextResponse.json({ error: 'Web Push not configured', publicKey: null }, { status: 503 })
  }
  return NextResponse.json({ publicKey: key })
}
