import { NextResponse } from 'next/server'
import { requireSessionUserId } from '@/lib/auth/require-session'
import { getUserOperationReceipt } from '@/lib/smart-account/server'
import { receiptQuerySchema } from '@/lib/aa/validation'
import type { Hex } from 'viem'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireSessionUserId()
    const { searchParams } = new URL(request.url)
    const parsed = receiptQuerySchema.safeParse({ hash: searchParams.get('hash') })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid hash' }, { status: 400 })
    }

    const receipt = await getUserOperationReceipt(parsed.data.hash as Hex)
    if (!receipt) {
      return NextResponse.json({ ok: true, pending: true, receipt: null })
    }

    return NextResponse.json({ ok: true, pending: false, receipt })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Receipt lookup failed'
    if (message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[aa/receipt]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
