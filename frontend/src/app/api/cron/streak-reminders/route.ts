import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createNotification } from '@/lib/server/notifications/service'
import { resolveUserIdByWallet } from '@/lib/server/notifications/resolve-user'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function assertCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return process.env.NODE_ENV !== 'production'
  const auth = request.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

/**
 * Streak ending ~6h: users whose last verified cleanup was 6.5–7 days ago
 * (weekly streak about to break). Requires cleanup_feed + push/inbox users.
 */
export async function GET(request: NextRequest) {
  try {
    if (!assertCronAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ ok: true, skipped: 'supabase not configured', reminded: 0 })
    }

    const supabase = createClient(url, key)
    const now = Date.now()
    const windowStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const windowEnd = new Date(now - (7 * 24 - 6) * 60 * 60 * 1000).toISOString()
    // Last cleanup between ~6.5d and 7d ago → streak ends within ~6h if weekly

    const { data: rows, error } = await supabase
      .from('cleanup_feed')
      .select('submitter, verified_at')
      .gte('verified_at', windowStart)
      .lte('verified_at', windowEnd)
      .limit(200)

    if (error) {
      console.warn('[cron/streak-reminders]', error.message)
      return NextResponse.json({ ok: true, reminded: 0, warning: error.message })
    }

    const bySubmitter = new Map<string, string>()
    for (const row of rows || []) {
      const s = String(row.submitter || '').toLowerCase()
      const v = row.verified_at as string
      if (!s || !v) continue
      const prev = bySubmitter.get(s)
      if (!prev || v > prev) bySubmitter.set(s, v)
    }

    let reminded = 0
    for (const [wallet] of bySubmitter) {
      const userId = await resolveUserIdByWallet(wallet)
      if (!userId) continue

      const recent = await prisma.userNotification.findFirst({
        where: {
          userId,
          type: 'streak_ending',
          createdAt: { gte: new Date(now - 20 * 60 * 60 * 1000) },
        },
      })
      if (recent) continue

      await createNotification({
        userId,
        type: 'streak_ending',
        title: 'Streak ending soon',
        body: 'Your cleanup streak may break within about 6 hours. Submit a cleanup to keep it going.',
        href: '/cleanup',
      })
      reminded += 1
    }

    return NextResponse.json({ ok: true, reminded, candidates: bySubmitter.size })
  } catch (e) {
    logApiError('cron/streak-reminders', e)
    return NextResponse.json({ error: apiErrorMessage(e, 'Cron failed') }, { status: 500 })
  }
}
