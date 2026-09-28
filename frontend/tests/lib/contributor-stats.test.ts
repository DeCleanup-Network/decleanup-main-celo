import { contributorFieldMatches, type ContributorIdentity } from '@/lib/impact/contributor-match'

const identity: ContributorIdentity = {
  addresses: [
    '0x7D85fCbB505D48E6176483733b62b51704e0bF95',
    '0xA495467Bd90A3f4f6c20254685eDCc5ffde13601',
  ],
  emails: ['helper@example.com'],
}

describe('contributorFieldMatches', () => {
  it('matches listed email regardless of case', () => {
    expect(contributorFieldMatches('Helper@Example.com', identity)).toBe(true)
    expect(contributorFieldMatches('other@example.com', identity)).toBe(false)
  })

  it('matches signer or smart-account address', () => {
    expect(
      contributorFieldMatches('0x7d85fcbb505d48e6176483733b62b51704e0bf95', identity)
    ).toBe(true)
    expect(
      contributorFieldMatches('0xA495467Bd90A3f4f6c20254685eDCc5ffde13601', identity)
    ).toBe(true)
    expect(
      contributorFieldMatches('0x0000000000000000000000000000000000000001', identity)
    ).toBe(false)
  })

  it('does not treat ENS as an address match', () => {
    expect(contributorFieldMatches('alice.eth', identity)).toBe(false)
  })
})
