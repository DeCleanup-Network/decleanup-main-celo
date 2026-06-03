import 'server-only'

/**
 * Reverse geocoding for public cleanup feed (OpenStreetMap Nominatim).
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const MIN_INTERVAL_MS = 1_100
const CACHE_ROUND_DECIMALS = 2

type NominatimReverseResponse = {
  address?: Record<string, string>
  display_name?: string
}

const placeCache = new Map<string, string | null>()
let lastRequestAt = 0

function cacheKey(lat: number, lng: number): string {
  const f = 10 ** CACHE_ROUND_DECIMALS
  return `${Math.round(lat * f) / f},${Math.round(lng * f) / f}`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isReverseGeocodingEnabled(): boolean {
  const raw = process.env.IMPACT_REVERSE_GEOCODING_ENABLED?.trim().toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  return true
}

function nominatimUserAgent(): string {
  return (
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    'DeCleanupRewards/1.0 (https://dapp.decleanup.net; contact: decentralizedcleanup@gmail.com)'
  )
}

/** Build a short place line like "Tokyo, Japan" from Nominatim address parts. */
export function formatPlaceFromNominatimAddress(
  address: Record<string, string> | undefined
): string | null {
  if (!address) return null

  const locality =
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.suburb

  const region = address.state || address.region || address.county
  const country = address.country

  if (locality && country) {
    if (region && locality !== region && !country.includes(locality)) {
      return `${locality}, ${region}, ${country}`
    }
    return `${locality}, ${country}`
  }
  if (region && country) return `${region}, ${country}`
  if (country) return country
  return null
}

/**
 * Resolve coordinates to a place name. Returns null on failure or when disabled.
 * Respects Nominatim 1 req/s via in-process throttle; caches by rounded coords.
 */
export async function reverseGeocodePlaceName(
  lat: number,
  lng: number
): Promise<string | null> {
  if (!isReverseGeocodingEnabled()) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null

  const key = cacheKey(lat, lng)
  if (placeCache.has(key)) return placeCache.get(key) ?? null

  const now = Date.now()
  const wait = Math.max(0, MIN_INTERVAL_MS - (now - lastRequestAt))
  if (wait > 0) await sleep(wait)
  lastRequestAt = Date.now()

  try {
    const url = new URL(NOMINATIM_REVERSE)
    url.searchParams.set('format', 'json')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('zoom', '10')
    url.searchParams.set('addressdetails', '1')

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': nominatimUserAgent(),
      },
      signal: AbortSignal.timeout(12_000),
      cache: 'no-store',
    })

    if (!response.ok) {
      placeCache.set(key, null)
      return null
    }

    const data = (await response.json()) as NominatimReverseResponse
    const place =
      formatPlaceFromNominatimAddress(data.address) ||
      shortenDisplayName(data.display_name)

    placeCache.set(key, place)
    return place
  } catch (err) {
    console.warn('[reverseGeocode]', err instanceof Error ? err.message : err)
    placeCache.set(key, null)
    return null
  }
}

function shortenDisplayName(displayName: string | undefined): string | null {
  if (!displayName?.trim()) return null
  const parts = displayName.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]}, ${parts[parts.length - 1]}`
  }
  return parts[0] ?? null
}

/** Clear in-memory cache (tests). */
export function clearReverseGeocodeCache(): void {
  placeCache.clear()
  lastRequestAt = 0
}
