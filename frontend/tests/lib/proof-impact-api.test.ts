import { parseContributorIdentities } from '@/lib/proof/contributors'
import {
  explorerTxUrl,
  formatProofDateTime,
  organizerDonateHref,
  proofImpactStats,
  splitSummaryFacts,
  unixSecondsToIso,
} from '@/lib/proof/display'
import {
  absoluteMediaUrl,
  cidFromMediaUrl,
  exactApiValue,
  isUsableProofCleanup,
  proofAiReviewFromPayload,
  proofPublicPhotos,
  transactionHashFromItem,
  wasteTypesFromApi,
  type ProofCleanupItem,
} from '@/lib/proof/impact-api'

function item(over: Partial<ProofCleanupItem> = {}): ProofCleanupItem {
  return {
    submissionId: '10',
    chainId: 42220,
    verifiedAt: '2026-07-06T20:57:43+00:00',
    location: {
      placeName: 'Enugu, Nigeria',
      latitude: 6.44,
      longitude: 7.4922,
    },
    impact: { weightKg: 33.73, areaSqm: 3346.8, bags: 14, wasteTypes: ['Plastic'] },
    ...over,
  }
}

describe('proof cleanup usability', () => {
  it('keeps a Celo cleanup with place and verified time', () => {
    expect(isUsableProofCleanup(item())).toBe(true)
  })

  it('skips missing place, missing verified time, and 90/180 coordinates', () => {
    expect(
      isUsableProofCleanup(item({ location: { placeName: null, latitude: 6, longitude: 7 } }))
    ).toBe(false)
    expect(isUsableProofCleanup(item({ verifiedAt: null }))).toBe(false)
    expect(
      isUsableProofCleanup(
        item({
          location: { placeName: 'Somewhere', latitude: 90, longitude: 180 },
        })
      )
    ).toBe(false)
  })

  it('prints API numbers without rounding', () => {
    expect(exactApiValue(33.73)).toBe('33.73')
    expect(exactApiValue(1)).toBe('1')
    expect(exactApiValue(0)).toBe('0')
  })

  it('does not invent a transaction hash or waste types', () => {
    expect(transactionHashFromItem(item())).toBe(null)
    expect(wasteTypesFromApi([])).toEqual([])
    expect(
      transactionHashFromItem(
        item({ txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })
      )
    ).toMatch(/^0x[a-f]+$/)
  })
})

describe('proof display', () => {
  it('formats verified time in a human UTC date', () => {
    expect(formatProofDateTime('2026-09-12T04:42:01+00:00')).toBe(
      '12 September 2026, 4:42 AM UTC'
    )
    expect(unixSecondsToIso(1600000000)).toBe('2020-09-13T12:26:40.000Z')
    expect(unixSecondsToIso(0)).toBe(null)
  })

  it('splits the API summary into readable facts', () => {
    expect(
      splitSummaryFacts(
        'Removed 1 kg of waste · ≈ 3.6 kg CO2e estimated equivalent · at Ko Pha-ngan, Thailand · 9.7°, 100.0° · recycled 1 kg · 1 m² cleared · 1 bag collected'
      )
    ).toEqual([
      'Removed 1 kg of waste',
      '≈ 3.6 kg CO2e estimated equivalent',
      'At Ko Pha-ngan, Thailand',
      '9.7°, 100.0°',
      'Recycled 1 kg',
      '1 m² cleared',
      '1 bag collected',
    ])
  })

  it('labels impact fields for people and keeps exact numbers', () => {
    const stats = proofImpactStats(
      item({
        impact: {
          weightKg: 33.73,
          areaSqm: 3346.8,
          bags: 14,
          durationMinutes: 60,
          co2eEstimateKg: 3.6,
          wasteTypes: ['Plastic'],
        },
        recyclables: { hasRecyclables: true, amountKg: 1, amountDisplay: '1 kg' },
      })
    )
    expect(stats).toEqual(
      expect.arrayContaining([
        { label: 'Weight', value: '33.73 kg' },
        { label: 'Area', value: '3346.8 m²' },
        { label: 'Bags', value: '14' },
        { label: 'Duration', value: '60 minutes' },
        { label: 'Estimated CO₂e', value: '≈ 3.6 kg' },
        { label: 'Recycled', value: '1 kg' },
      ])
    )
  })
})

describe('proof photos and AI review', () => {
  it('keeps public before/after and recyclables photo URLs', () => {
    const photos = proofPublicPhotos(
      item({
        media: {
          beforePhotoUrl: '/api/ipfs/fetch?cid=beforecid',
          afterPhotoUrl: '/api/ipfs/fetch?cid=aftercid',
          hasPublicPhotos: true,
        },
        recyclables: {
          hasRecyclables: true,
          photoUrl:
            '/api/ipfs/fetch?url=https%3A%2F%2Fgateway.pinata.cloud%2Fipfs%2Fbafkreicwzizt72g5dmyz57xoxkyaiyd7kpnxzyls3rl2gtwqdhxxgz5vwa',
        },
      })
    )
    expect(photos.map((p) => p.label)).toEqual(['Before', 'After', 'Recyclables'])
    expect(photos.every((p) => p.src.startsWith('/api/ipfs/fetch'))).toBe(true)
  })

  it('does not invent a photo when the API has none', () => {
    expect(
      proofPublicPhotos(
        item({
          media: { beforePhotoUrl: null, afterPhotoUrl: null, hasPublicPhotos: false },
        })
      )
    ).toEqual([])
  })

  it('rewrites production ipfs proxy URLs to same-origin fetch', () => {
    expect(
      absoluteMediaUrl(
        'https://dapp.decleanup.net/api/ipfs/fetch?url=https://gateway.pinata.cloud/ipfs/bafy123'
      )
    ).toBe('/api/ipfs/fetch?url=https://gateway.pinata.cloud/ipfs/bafy123')
    expect(
      cidFromMediaUrl(
        '/api/ipfs/fetch?url=https%3A%2F%2Fgateway.pinata.cloud%2Fipfs%2Fbafybeigvpq2d342ekte65jjsmou2zw6eddbsofgmsoizen3i6ux7j4keoi'
      )
    ).toBe('bafybeigvpq2d342ekte65jjsmou2zw6eddbsofgmsoizen3i6ux7j4keoi')
  })

  it('links a transaction hash on Celoscan', () => {
    expect(
      explorerTxUrl('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    ).toBe(
      'https://celoscan.io/tx/0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )
  })

  it('keeps contributor emails and wallets and skips empty names', () => {
    expect(
      parseContributorIdentities([
        '  alice@decleanup.net ',
        '0x90ded2b61f1f23db8c953a494d2916d9b5ad1c00',
        'Alice volunteer',
        'bob.eth',
        'alice@decleanup.net',
      ])
    ).toEqual([
      'alice@decleanup.net',
      '0x90ded2b61f1f23db8c953a494d2916d9b5ad1c00',
      'bob.eth',
    ])
    expect(parseContributorIdentities(undefined)).toEqual([])
  })

  it('builds a donate link with the organizer wallet filled on /sponsor', () => {
    expect(
      organizerDonateHref({
        address: '0x90ded2b61f1f23db8c953a494d2916d9b5ad1c00',
        cleanupId: '15',
        place: 'Ko Pha-ngan, Thailand',
      })
    ).toBe(
      '/sponsor?to=0x90ded2b61f1f23db8c953a494d2916d9b5ad1c00&cleanup=15&place=Ko+Pha-ngan%2C+Thailand'
    )
    expect(organizerDonateHref({ address: 'not-a-wallet', cleanupId: '15' })).toBe(null)
  })

  it('builds an AI review summary only when a score exists', () => {
    expect(proofAiReviewFromPayload({ hasResult: false })).toBe(null)
    expect(
      proofAiReviewFromPayload({
        score: { verdict: 'approved', score: 0.82, delta: 12 },
        beforeInference: { objectCount: 20 },
        afterInference: { objectCount: 8 },
      })?.summary
    ).toContain('Score 0.82')
  })
})
