import {
  parseCoordsFromContractRaw,
  parseCoordsFromDegrees,
} from '@/lib/impact/coords-from-contract'
import { formatLocationLabel } from '@/lib/impact/location-label'

describe('parseCoordsFromContractRaw', () => {
  it('converts Koh Phangan microdegrees to decimal degrees', () => {
    const { lat, lng } = parseCoordsFromContractRaw(9_731_900, 100_013_600)
    expect(lat).toBeCloseTo(9.7319, 4)
    expect(lng).toBeCloseTo(100.0136, 4)
  })

  it('returns null for zero coords', () => {
    expect(parseCoordsFromContractRaw(0, 0)).toEqual({ lat: null, lng: null })
  })

  it('accepts bigint values from viem reads', () => {
    const { lat, lng } = parseCoordsFromContractRaw(38_697_000n, -9_421_000n)
    expect(lat).toBeCloseTo(38.697, 3)
    expect(lng).toBeCloseTo(-9.421, 3)
  })
})

describe('parseCoordsFromDegrees', () => {
  it('does not rescale already-normalized degrees', () => {
    const { lat, lng } = parseCoordsFromDegrees(9.7319, 100.0136)
    expect(lat).toBeCloseTo(9.7319, 4)
    expect(lng).toBeCloseTo(100.0136, 4)
  })
})

describe('formatLocationLabel', () => {
  it('shows coords only when no place name', () => {
    expect(formatLocationLabel(38.7, -9.4)).toBe('38.7°, -9.4°')
  })

  it('shows place name and coords when provided', () => {
    expect(formatLocationLabel(35.68, 139.69, { placeName: 'Tokyo, Japan' })).toBe(
      'Tokyo, Japan · 35.7°, 139.7°'
    )
  })

  it('shows place name only when coords are missing', () => {
    expect(formatLocationLabel(0, 0, { placeName: 'Tokyo, Japan' })).toBe('Tokyo, Japan')
  })

  it('omits 0.0° coords from double-scaled noise', () => {
    expect(formatLocationLabel(0.00001, 0.0001)).toBe('Verified cleanup')
  })
})
