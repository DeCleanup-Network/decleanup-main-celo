import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { isAddress, getAddress } from 'viem'
import type { Database } from '@/lib/supabase/database.types'
import type { SponsorEventDto, SponsorEventStatus } from '@/lib/sponsor/types'

export type { SponsorEventDto, SponsorEventStatus } from '@/lib/sponsor/types'

let client: ReturnType<typeof createClient<Database>> | null = null

export function isSponsorshipDbConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim()
  return Boolean(url && key)
}

function getSupabase() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase credentials for sponsorships. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

function toNum(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

export async function listSponsorEvents(): Promise<SponsorEventDto[]> {
  const sb = getSupabase()
  const { data: events, error } = await sb
    .from('events')
    .select(
      'id, name, location, organiser, event_date, funding_goal_cusd, recipient_address, verified_cleanups_count, status'
    )
    .in('status', ['active', 'upcoming'])
    .order('event_date', { ascending: true })

  if (error) throw error
  if (!events?.length) return []

  const ids = events.map((e) => e.id)
  const { data: rows, error: sumErr } = await sb
    .from('sponsorships')
    .select('event_id, amount_cusd')
    .in('event_id', ids)

  if (sumErr) throw sumErr

  const raised = new Map<string, number>()
  for (const row of rows || []) {
    const prev = raised.get(row.event_id) || 0
    raised.set(row.event_id, prev + toNum(row.amount_cusd))
  }

  return events.map((e) => ({
    id: e.id,
    name: e.name,
    location: e.location,
    organiser: e.organiser,
    eventDate: e.event_date,
    fundingGoalCusd: toNum(e.funding_goal_cusd),
    amountRaisedCusd: raised.get(e.id) || 0,
    verifiedCleanupsCount: e.verified_cleanups_count ?? 0,
    recipientAddress: e.recipient_address,
    status: e.status as SponsorEventStatus,
  }))
}

export async function getSponsorEventById(id: string): Promise<SponsorEventDto | null> {
  const sb = getSupabase()
  const { data: e, error } = await sb
    .from('events')
    .select(
      'id, name, location, organiser, event_date, funding_goal_cusd, recipient_address, verified_cleanups_count, status'
    )
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  if (!e) return null

  const { data: rows, error: sumErr } = await sb
    .from('sponsorships')
    .select('amount_cusd')
    .eq('event_id', id)

  if (sumErr) throw sumErr
  const amountRaisedCusd = (rows || []).reduce((acc, r) => acc + toNum(r.amount_cusd), 0)

  return {
    id: e.id,
    name: e.name,
    location: e.location,
    organiser: e.organiser,
    eventDate: e.event_date,
    fundingGoalCusd: toNum(e.funding_goal_cusd),
    amountRaisedCusd,
    verifiedCleanupsCount: e.verified_cleanups_count ?? 0,
    recipientAddress: e.recipient_address,
    status: e.status as SponsorEventStatus,
  }
}

export async function recordSponsorship(input: {
  eventId: string
  sponsorAddress: string
  amountCusd: number
  txHash: string
}): Promise<{ id: string }> {
  if (!isAddress(input.sponsorAddress)) {
    throw new Error('Invalid sponsor address')
  }
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash.trim())) {
    throw new Error('Invalid transaction hash')
  }
  if (!(input.amountCusd > 0) || !Number.isFinite(input.amountCusd)) {
    throw new Error('Invalid amount')
  }

  const event = await getSponsorEventById(input.eventId)
  if (!event) throw new Error('Event not found')
  if (event.status === 'ended') throw new Error('Event is not open for sponsorship')

  const sb = getSupabase()
  const { data, error } = await sb
    .from('sponsorships')
    .insert({
      event_id: input.eventId,
      sponsor_address: getAddress(input.sponsorAddress),
      amount_cusd: input.amountCusd,
      tx_hash: input.txHash.trim().toLowerCase(),
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      // Unique tx_hash — treat as success (idempotent retry)
      const { data: existing } = await sb
        .from('sponsorships')
        .select('id')
        .eq('tx_hash', input.txHash.trim().toLowerCase())
        .maybeSingle()
      if (existing?.id) return { id: existing.id }
    }
    throw error
  }

  return { id: data.id }
}
