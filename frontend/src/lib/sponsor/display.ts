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
