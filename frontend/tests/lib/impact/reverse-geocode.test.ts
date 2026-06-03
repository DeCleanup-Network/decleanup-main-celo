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

  it('prefers short place and country without admin subdivisions', () => {
    expect(
      formatPlaceFromNominatimAddress({
        city: 'Ko Pha-ngan',
        county: 'Ko Pha-ngan District',
        state: 'Surat Thani',
        country: 'Thailand',
      })
    ).toBe('Ko Pha-ngan, Thailand')
  })
})
