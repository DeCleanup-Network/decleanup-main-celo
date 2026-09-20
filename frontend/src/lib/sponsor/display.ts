import type { SponsorEventDto } from '@/lib/sponsor/types'

export function formatCusd(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function shortAddr(a: string): string {
  if (!a || a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

export function progressPct(raised: number, goal: number): number {
  if (!(goal > 0)) return 0
  return Math.min(100, Math.round((raised / goal) * 100))
}

export function sponsorEventPath(eventId: string): string {
  return `/sponsor/e/${eventId}`
}

export function formatEventDate(eventDate: string | null): string {
  if (!eventDate) return 'Ongoing'
  const d = new Date(eventDate)
  if (Number.isNaN(d.getTime())) return 'Ongoing'
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function parseSocialLinks(raw?: string | null): string[] {
  if (!raw) return []
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s))
}

export function eventShareAbsoluteUrl(eventId: string, origin?: string): string {
  const base = (origin || '').replace(/\/$/, '')
  const path = sponsorEventPath(eventId)
  return base ? `${base}${path}` : path
}

export function isOpenForDonations(event: Pick<SponsorEventDto, 'status'>): boolean {
  return event.status === 'active' || event.status === 'upcoming'
}

export function verifiedCleanupLabel(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  return n === 1 ? '1 verified cleanup' : `${n} verified cleanups`
}

/** Type roles on a campaign page so headings, body, notes, and forms stay distinct. */
export const campaignText = {
  title: 'font-heading text-2xl tracking-wider text-white',
  section: 'font-heading text-sm tracking-wider text-white',
  label: 'font-heading text-xs tracking-wider text-zinc-400',
  body: 'text-sm leading-relaxed text-zinc-100',
  note: 'text-sm leading-relaxed text-zinc-400',
  noteBox:
    'rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm leading-relaxed text-zinc-400',
  cardTitle: 'text-sm font-medium text-white',
  cardHint: 'mt-1 block text-xs leading-relaxed text-zinc-400',
  meta: 'text-xs text-zinc-500',
  formLabel: 'text-xs text-zinc-400',
  formValue: 'text-sm text-zinc-100',
} as const
