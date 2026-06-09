/** IPCC AR6 displacement factor for plastic waste (kg CO₂e per kg plastic). */
export const PLASTIC_CO2E_FACTOR_KG = 1.78

export function estimatePlasticCo2eKg(weightKg: number): number {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return 0
  return weightKg * PLASTIC_CO2E_FACTOR_KG
}

/** OpenStreetMap static map tile (no API key). */
export function buildOsmStaticMapUrl(lat: number, lng: number, size = '400x160'): string {
  const zoom = 11
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${size}&markers=${lat},${lng},lightgreen1`
}

export function parseLatLng(coords: string): { lat: number; lng: number } | null {
  const t = coords.trim()
  if (!t) return null
  const parts = t.split(/[,\s]+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length < 2) return null
  const lat = Number.parseFloat(parts[0])
  const lng = Number.parseFloat(parts[1])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S'
  const lngDir = lng >= 0 ? 'E' : 'W'
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`
}

export function osmMapLink(lat: number, lng: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=11/${lat}/${lng}`
}
