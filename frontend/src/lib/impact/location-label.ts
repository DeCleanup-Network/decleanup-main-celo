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

export type LocationLabelOptions = {
  /** Reverse-geocoded place, e.g. "Tokyo, Japan". */
  placeName?: string | null
}

/** Public feed / landing label: place name + coordinates only (no beach/park category). */
export function formatLocationLabel(
  lat: number,
  lng: number,
  options?: LocationLabelOptions
): string {
  const placeName = options?.placeName?.trim() || ''
  const coordsSuffix = hasMeaningfulCoords(lat, lng) ? formatApproxCoords(lat, lng) : ''

  const segments: string[] = []
  if (placeName) segments.push(placeName)
  if (coordsSuffix) segments.push(coordsSuffix)

  if (segments.length > 0) return segments.join(' · ')
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
