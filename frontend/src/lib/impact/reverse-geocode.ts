import 'server-only'

/**
 * Reverse geocoding for public cleanup feed (OpenStreetMap Nominatim).
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const MIN_INTERVAL_MS = 1_100
const CACHE_ROUND_DECIMALS = 2
const CACHE_VERSION = 'latin-v1'

/** Scripts we skip when building English-facing labels (Thai, CJK, Arabic, etc.). */
const NON_LATIN_SCRIPT =
  /[\u0E00-\u0E7F\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/

const ADDRESS_LOCALITY_KEYS = [
  'island',
  'city',
  'town',
  'village',
  'hamlet',
  'suburb',
  'county',
  'state',
  'province',
  'municipality',
  'region',
] as const

type NominatimReverseResponse = {
  address?: Record<string, string>
  display_name?: string
}

const placeCache = new Map<string, string | null>()
let lastRequestAt = 0

function nominatimLanguage(): string {
  return process.env.NOMINATIM_ACCEPT_LANGUAGE?.trim() || 'en'
}

function cacheKey(lat: number, lng: number): string {
  const f = 10 ** CACHE_ROUND_DECIMALS
  return `${CACHE_VERSION}:${nominatimLanguage()}:${Math.round(lat * f) / f},${Math.round(lng * f) / f}`
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

/** True when the string is safe to show on an English landing page. */
export function usesLatinScript(text: string): boolean {
  const t = text.trim()
  if (!t) return false
  return !NON_LATIN_SCRIPT.test(t)
}

export function normalizePlaceSegment(segment: string): string {
  return segment
    .replace(/\s+Subdistrict\s+Municipality$/i, '')
    .replace(/\s+District$/i, '')
    .replace(/\s+Province$/i, '')
    .replace(/\s+Municipality$/i, '')
    .replace(/\s+County$/i, '')
    .trim()
}

/** First Latin-script locality field (OSM often keeps `city` in Thai but `county` in English). */
export function pickLatinLocality(address: Record<string, string>): string | null {
  for (const key of ADDRESS_LOCALITY_KEYS) {
    const raw = address[key]
    if (!raw || !usesLatinScript(raw)) continue
    const normalized = normalizePlaceSegment(raw)
    if (normalized.length > 0) return normalized
  }
  return null
}

/** Build a short place line like "Ko Pha-ngan, Thailand" from Nominatim address parts. */
export function formatPlaceFromNominatimAddress(
  address: Record<string, string> | undefined
): string | null {
  if (!address) return null

  const countryRaw = address.country?.trim()
  const country =
    countryRaw && usesLatinScript(countryRaw) ? normalizePlaceSegment(countryRaw) : null

  const locality = pickLatinLocality(address)
  if (locality && country) return `${locality}, ${country}`
  if (country) return country
  return null
}

/** Parse comma-separated display_name, skipping non-Latin segments (e.g. Thai subdistrict names). */
export function formatPlaceFromDisplayName(displayName: string | undefined): string | null {
  if (!displayName?.trim()) return null

  const parts = displayName
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
  const latin = parts.filter(usesLatinScript)
  if (latin.length === 0) return null

  const country = normalizePlaceSegment(latin[latin.length - 1])
  const localityCandidates = latin.slice(0, -1)
  if (localityCandidates.length === 0) return country

  const best =
    localityCandidates.find((p) => /\bdistrict\b/i.test(p)) ||
    localityCandidates.find((p) => p.length <= 48 && !/municipality/i.test(p)) ||
    localityCandidates[localityCandidates.length - 1]

  const place = normalizePlaceSegment(best)
  if (!place || place === country) return country
  return `${place}, ${country}`
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
    const lang = nominatimLanguage()
    url.searchParams.set('accept-language', lang)

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Language': lang,
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
      formatPlaceFromDisplayName(data.display_name)

    placeCache.set(key, place)
    return place
  } catch (err) {
    console.warn('[reverseGeocode]', err instanceof Error ? err.message : err)
    placeCache.set(key, null)
    return null
  }
}

/** Clear in-memory cache (tests). */
export function clearReverseGeocodeCache(): void {
  placeCache.clear()
  lastRequestAt = 0
}
