import {
  formatPlaceFromNominatimAddress,
  clearReverseGeocodeCache,
} from '@/lib/impact/reverse-geocode'

describe('formatPlaceFromNominatimAddress', () => {
  beforeEach(() => clearReverseGeocodeCache())

  it('formats city and country', () => {
    expect(
      formatPlaceFromNominatimAddress({ city: 'Tokyo', country: 'Japan' })
    ).toBe('Tokyo, Japan')
  })

  it('uses town when city is missing', () => {
    expect(
      formatPlaceFromNominatimAddress({ town: 'Koh Phangan', country: 'Thailand' })
    ).toBe('Koh Phangan, Thailand')
  })
})
