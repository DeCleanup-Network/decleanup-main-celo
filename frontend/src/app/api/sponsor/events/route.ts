import { NextResponse } from 'next/server'
import {
  isSponsorshipDbConfigured,
  listSponsorEvents,
} from '@/lib/supabase/sponsorship-events'
import { apiErrorMessage, logApiError } from '@/lib/server/api-error'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    if (!isSponsorshipDbConfigured()) {
      return NextResponse.json(
        {
          error:
            'Sponsorship database not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
          events: [],
        },
        { status: 503 }
      )
    }
    const events = await listSponsorEvents()
    return NextResponse.json({ events })
  } catch (e) {
    logApiError('sponsor/events GET', e)
    const msg = apiErrorMessage(e, 'Failed to load events')
    const missingTable =
      typeof msg === 'string' &&
      (/relation .*events.* does not exist/i.test(msg) || /Could not find the table/i.test(msg))
    return NextResponse.json(
      {
        error: missingTable
          ? 'Events table missing. Run supabase migration 20260918_create_events_sponsorships.sql'
          : msg,
        events: [],
      },
      { status: missingTable ? 503 : 500 }
    )
  }
}
