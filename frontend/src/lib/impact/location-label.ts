const LOCATION_TYPE_LABELS: Record<string, string> = {
  beach: 'Beach',
  park: 'Park',
  waterway: 'Waterway',
  river: 'River',
  lake: 'Lake',
  forest: 'Forest',
  urban: 'Urban area',
  street: 'Street',
  other: 'Outdoor site',
}

function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function hasMeaningfulCoords(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return false
  // Ignore sub-0.05° noise (e.g. feed double-scaled microdegrees stored as degrees).
  if (Math.abs(lat) < 0.05 && Math.abs(lng) < 0.05) return false
  return true
}

/** Approximate coords for public display (~11 km precision at 1 decimal). */
export function formatApproxCoords(lat: number, lng: number): string {
  return `${lat.toFixed(1)}°, ${lng.toFixed(1)}°`
}

export function formatLocationLabel(
  locationType: string,
  lat: number,
  lng: number
): string {
  const key = locationType.trim().toLowerCase()
  const named =
    LOCATION_TYPE_LABELS[key] || (key ? titleCase(key) : '')

  if (named && hasMeaningfulCoords(lat, lng)) {
    return `${named} · ${formatApproxCoords(lat, lng)}`
  }
  if (named) return named
  if (hasMeaningfulCoords(lat, lng)) {
    return formatApproxCoords(lat, lng)
  }
  return 'Verified cleanup'
}

export function recyclablesUnitToKg(
  amount: number,
  unit: string
): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const u = unit.trim().toLowerCase()
  if (u === 'kg') return amount
  if (u === 'g') return amount / 1000
  if (u === 'lb' || u === 'lbs') return amount / 2.20462
  return null
}

export function formatRecyclablesDisplay(amount: number, unit: string): string {
  const u = unit.trim().toLowerCase()
  const formatted = Number.isInteger(amount) ? String(amount) : amount.toFixed(1)
  if (u === 'bag') return `${formatted} bag${amount === 1 ? '' : 's'}`
  return `${formatted} ${u}`
}
