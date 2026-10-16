import { exactApiValue, type ProofCleanupItem } from '@/lib/proof/impact-api'

export type ProofStat = { label: string; value: string }

export function formatProofDateTime(value: unknown): string {
  if (typeof value !== 'string') return ''
  const raw = value.trim()
  if (!raw) return ''
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return raw
  const day = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).format(date)
  const timeWithUtc = time.replace(/\s*(am|pm)\b/i, (match) => ` ${match.toUpperCase()}`).replace(/\s+/g, ' ').trim()
  return `${day}, ${timeWithUtc} UTC`
}

export function unixSecondsToIso(value: unknown): string | null {
  let n: number
  if (typeof value === 'bigint') n = Number(value)
  else if (typeof value === 'number') n = value
  else if (typeof value === 'string' && value.trim()) n = Number(value)
  else return null
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n > 1e12 ? n : n * 1000
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

export function explorerAddressUrl(address: string): string {
  return `https://celoscan.io/address/${address}`
}

export function explorerTxUrl(hash: string): string {
  return `https://celoscan.io/tx/${hash}`
}

export function organizerDonateHref(opts: {
  address: string
  cleanupId: string
  place?: string | null
}): string | null {
  if (!/^0x[a-fA-F0-9]{40}$/.test(opts.address)) return null
  const params = new URLSearchParams()
  params.set('to', opts.address)
  params.set('cleanup', opts.cleanupId)
  const place = opts.place?.trim()
  if (place) params.set('place', place)
  return `/sponsor?${params.toString()}`
}

function sentenceCaseFact(fact: string): string {
  const first = fact.charAt(0)
  if (!first || first.toLowerCase() === first.toUpperCase()) return fact
  return `${first.toUpperCase()}${fact.slice(1)}`
}

export function splitSummaryFacts(summary: unknown): string[] {
  if (typeof summary !== 'string') return []
  return summary
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map(sentenceCaseFact)
}

function withExactUnit(value: unknown, unit: string): string {
  const text = exactApiValue(value)
  if (text === '') return ''
  return `${text} ${unit}`
}

function isZeroish(value: unknown): boolean {
  return value === 0 || value === '0'
}

function recycledDisplay(item: ProofCleanupItem): string | null {
  const rec = item.recyclables
  if (!rec?.hasRecyclables) return null
  const display = typeof rec.amountDisplay === 'string' ? rec.amountDisplay.trim() : ''
  if (display) return display
  const kg = exactApiValue(rec.amountKg)
  if (kg !== '' && kg !== '0') return `${kg} kg`
  return 'Included'
}

/** Human-labelled impact figures. Numbers stay exactly as the API returned them. */
export function proofImpactStats(
  item: ProofCleanupItem,
  options?: { includeZeros?: boolean }
): ProofStat[] {
  const includeZeros = options?.includeZeros === true
  const stats: ProofStat[] = []

  const weight = withExactUnit(item.impact?.weightKg, 'kg')
  if (weight && (includeZeros || !isZeroish(item.impact?.weightKg))) {
    stats.push({ label: 'Weight', value: weight })
  }

  const area = withExactUnit(item.impact?.areaSqm, 'm²')
  if (area && (includeZeros || !isZeroish(item.impact?.areaSqm))) {
    stats.push({ label: 'Area', value: area })
  }

  const bags = exactApiValue(item.impact?.bags)
  if (bags !== '' && (includeZeros || !isZeroish(item.impact?.bags))) {
    stats.push({ label: 'Bags', value: bags })
  }

  const duration = withExactUnit(item.impact?.durationMinutes, 'minutes')
  if (duration && !isZeroish(item.impact?.durationMinutes)) {
    stats.push({ label: 'Duration', value: duration })
  }

  const co2e = withExactUnit(item.impact?.co2eEstimateKg, 'kg')
  if (co2e && !isZeroish(item.impact?.co2eEstimateKg)) {
    stats.push({ label: 'Estimated CO₂e', value: `≈ ${co2e}` })
  }

  const recycled = recycledDisplay(item)
  if (recycled) {
    stats.push({ label: 'Recycled', value: recycled })
  }

  const contributors = exactApiValue(item.impact?.contributorsCount)
  if (contributors !== '' && !isZeroish(item.impact?.contributorsCount)) {
    stats.push({ label: 'Contributors', value: contributors })
  }

  return stats
}

const GLOBAL_METRIC_LABELS: Record<string, string> = {
  total_cleanups_verified: 'Cleanups verified',
  total_weight_kg: 'Weight',
  total_area_sqm: 'Area',
  total_bags: 'Bags',
  total_volunteer_time: 'Volunteer time',
  total_duration_minutes: 'Duration',
  cleanups_with_recyclables: 'With recyclables',
  total_recyclables_kg: 'Recycled',
}

const GLOBAL_METRIC_UNITS: Record<string, string> = {
  total_weight_kg: 'kg',
  total_area_sqm: 'm²',
  total_duration_minutes: 'minutes',
  total_recyclables_kg: 'kg',
}

export function proofGlobalStats(metrics: Record<string, unknown> | undefined): ProofStat[] {
  if (!metrics) return []
  const keys = [
    'total_cleanups_verified',
    'total_weight_kg',
    'total_area_sqm',
    'total_bags',
    'total_volunteer_time',
    'total_duration_minutes',
    'cleanups_with_recyclables',
    'total_recyclables_kg',
  ]
  const stats: ProofStat[] = []
  for (const key of keys) {
    const raw = metrics[key]
    if (raw === null || raw === undefined) continue
    if (Array.isArray(raw) || (typeof raw === 'object' && raw !== null)) continue
    const text = exactApiValue(raw)
    if (text === '') continue
    const unit = GLOBAL_METRIC_UNITS[key]
    stats.push({
      label: GLOBAL_METRIC_LABELS[key] ?? key.replace(/_/g, ' '),
      value: unit ? `${text} ${unit}` : text,
    })
  }
  return stats
}
