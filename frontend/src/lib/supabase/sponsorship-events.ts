import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { isAddress, getAddress } from 'viem'
import type { Database } from '@/lib/supabase/database.types'
import type { SponsorEventDto, SponsorEventInput, SponsorEventStatus } from '@/lib/sponsor/types'

export type { SponsorEventDto, SponsorEventStatus } from '@/lib/sponsor/types'

const EVENT_SELECT =
  'id, name, location, organiser, event_date, funding_goal_cusd, recipient_address, verified_cleanups_count, status, submitted_by, why_funding, community_size, event_frequency, impact_summary, social_links, impact_portfolio_url, reviewed_by, reviewed_at'

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

type EventRow = {
  id: string
  name: string
  location: string
  organiser: string
  event_date: string | null
  funding_goal_cusd: unknown
  recipient_address: string
  verified_cleanups_count: number | null
  status: string
  submitted_by?: string | null
  why_funding?: string | null
  community_size?: string | null
  event_frequency?: string | null
  impact_summary?: string | null
  social_links?: string | null
  impact_portfolio_url?: string | null
  reviewed_by?: string | null
  reviewed_at?: string | null
}

function mapEvent(e: EventRow, amountRaisedCusd: number): SponsorEventDto {
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
    submittedBy: e.submitted_by ?? null,
    whyFunding: e.why_funding ?? null,
    communitySize: e.community_size ?? null,
    eventFrequency: e.event_frequency ?? null,
    impactSummary: e.impact_summary ?? null,
    socialLinks: e.social_links ?? null,
    impactPortfolioUrl: e.impact_portfolio_url ?? null,
    reviewedBy: e.reviewed_by ?? null,
    reviewedAt: e.reviewed_at ?? null,
  }
}

export async function listSponsorEvents(): Promise<SponsorEventDto[]> {
  const sb = getSupabase()
  const { data: events, error } = await sb
    .from('events')
    .select(EVENT_SELECT)
    .in('status', ['active', 'upcoming'])
    .order('created_at', { ascending: false })

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

  return events.map((e) => mapEvent(e as EventRow, raised.get(e.id) || 0))
}

export async function listPendingSponsorEvents(): Promise<SponsorEventDto[]> {
  const sb = getSupabase()
  const { data: events, error } = await sb
    .from('events')
    .select(EVENT_SELECT)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (events || []).map((e) => mapEvent(e as EventRow, 0))
}

export async function getSponsorEventById(id: string): Promise<SponsorEventDto | null> {
  const sb = getSupabase()
  const { data: e, error } = await sb.from('events').select(EVENT_SELECT).eq('id', id).maybeSingle()

  if (error) throw error
  if (!e) return null

  const { data: rows, error: sumErr } = await sb
    .from('sponsorships')
    .select('amount_cusd')
    .eq('event_id', id)

  if (sumErr) throw sumErr
  const amountRaisedCusd = (rows || []).reduce((acc, r) => acc + toNum(r.amount_cusd), 0)

  return mapEvent(e as EventRow, amountRaisedCusd)
}

export async function createSponsorEvent(input: SponsorEventInput): Promise<SponsorEventDto> {
  if (!input.name.trim() || !input.location.trim() || !input.organiser.trim()) {
    throw new Error('Name, location, and organiser are required')
  }
  if (!isAddress(input.recipientAddress)) {
    throw new Error('Invalid recipient address')
  }
  if (!(input.fundingGoalCusd > 0) || !Number.isFinite(input.fundingGoalCusd)) {
    throw new Error('Funding goal must be greater than zero')
  }
  if (!input.whyFunding?.trim()) {
    throw new Error('Explain why you need funding')
  }

  let eventDateIso: string | null = null
  if (input.eventDate?.trim()) {
    const eventDate = new Date(input.eventDate)
    if (Number.isNaN(eventDate.getTime())) {
      throw new Error('Invalid event date')
    }
    eventDateIso = eventDate.toISOString()
  }

  const allowed: SponsorEventStatus[] = ['pending', 'active', 'upcoming', 'ended']
  if (!allowed.includes(input.status)) {
    throw new Error('Invalid status')
  }

  const sb = getSupabase()
  const { data, error } = await sb
    .from('events')
    .insert({
      name: input.name.trim(),
      location: input.location.trim(),
      organiser: input.organiser.trim(),
      event_date: eventDateIso,
      funding_goal_cusd: input.fundingGoalCusd,
      recipient_address: getAddress(input.recipientAddress),
      verified_cleanups_count: Math.max(0, Math.floor(input.verifiedCleanupsCount ?? 0)),
      status: input.status,
      submitted_by: input.submittedBy ? getAddress(input.submittedBy) : null,
      why_funding: input.whyFunding?.trim() || null,
      community_size: input.communitySize?.trim() || null,
      event_frequency: input.eventFrequency?.trim() || null,
      impact_summary: input.impactSummary?.trim() || null,
      social_links: input.socialLinks?.trim() || null,
      impact_portfolio_url: input.impactPortfolioUrl?.trim() || null,
    } as Database['public']['Tables']['events']['Insert'])
    .select(EVENT_SELECT)
    .single()

  if (error) throw error
  return mapEvent(data as EventRow, 0)
}

export async function updateSponsorEventStatus(
  id: string,
  status: SponsorEventStatus,
  reviewedBy?: string | null
): Promise<SponsorEventDto> {
  const allowed: SponsorEventStatus[] = ['pending', 'active', 'upcoming', 'ended']
  if (!allowed.includes(status)) throw new Error('Invalid status')

  const sb = getSupabase()
  const patch: Record<string, unknown> = { status }
  if (reviewedBy && isAddress(reviewedBy)) {
    patch.reviewed_by = getAddress(reviewedBy)
    patch.reviewed_at = new Date().toISOString()
  }

  const { data, error } = await sb
    .from('events')
    .update(patch as Database['public']['Tables']['events']['Update'])
    .eq('id', id)
    .select(EVENT_SELECT)
    .single()

  if (error) throw error
  return mapEvent(data as EventRow, 0)
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
  if (event.status === 'ended' || event.status === 'pending') {
    throw new Error('Event is not open for sponsorship')
  }

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
