/**
 * On-chain Submission stores latitude/longitude as int256 microdegrees (degrees × 1_000_000).
 * @see submitCleanup in lib/blockchain/contracts.ts
 */

export type ParsedCoords = { lat: number | null; lng: number | null }

function toFiniteNumber(value: bigint | number | string | null | undefined): number | null {
  if (value == null) return null
  const n = typeof value === 'bigint' ? Number(value) : Number(value)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse raw on-chain microdegree values to decimal degrees for maps and labels.
 */
export function parseCoordsFromContractRaw(
  rawLat: bigint | number | string | null | undefined,
  rawLng: bigint | number | string | null | undefined
): ParsedCoords {
  const latRaw = toFiniteNumber(rawLat)
  const lngRaw = toFiniteNumber(rawLng)
  if (latRaw == null || lngRaw == null) return { lat: null, lng: null }
  if (latRaw === 0 && lngRaw === 0) return { lat: null, lng: null }

  const lat = latRaw / 1_000_000
  const lng = lngRaw / 1_000_000
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { lat: null, lng: null }
  return { lat, lng }
}

/**
 * Coords already normalized to degrees (e.g. ImpactEntry from indexer). Do not scale again.
 */
export function parseCoordsFromDegrees(
  latDeg: number | null | undefined,
  lngDeg: number | null | undefined
): ParsedCoords {
  const lat = latDeg != null && Number.isFinite(latDeg) ? latDeg : null
  const lng = lngDeg != null && Number.isFinite(lngDeg) ? lngDeg : null
  if (lat == null || lng == null) return { lat: null, lng: null }
  if (lat === 0 && lng === 0) return { lat: null, lng: null }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { lat: null, lng: null }
  return { lat, lng }
}
