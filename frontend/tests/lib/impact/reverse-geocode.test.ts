import {
  formatPlaceFromDisplayName,
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

  it('skips Thai city and uses English county (Koh Phangan)', () => {
    expect(
      formatPlaceFromNominatimAddress({
        city: 'ตำบลเกาะพะงัน',
        municipality: 'Phet Pha-ngan Subdistrict Municipality',
        county: 'Ko Pha-ngan District',
        province: 'Surat Thani Province',
        country: 'Thailand',
      })
    ).toBe('Ko Pha-ngan, Thailand')
  })
})

describe('formatPlaceFromDisplayName', () => {
  it('skips Thai segments in display_name', () => {
    expect(
      formatPlaceFromDisplayName(
        'ตำบลเกาะพะงัน, Phet Pha-ngan Subdistrict Municipality, Ko Pha-ngan District, Surat Thani Province, Thailand'
      )
    ).toBe('Ko Pha-ngan, Thailand')
  })
})
