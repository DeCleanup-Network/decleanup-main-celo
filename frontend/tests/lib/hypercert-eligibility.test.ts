import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'

describe('hypercert eligibility', () => {
  it('unlocks a Robinhood testnet Hypercert after one verified cleanup', () => {
    const result = checkHypercertEligibility({
      cleanupsCount: 1,
      reportsCount: 0,
      publishedCount: 0,
      chainId: 46630,
    })
    expect(result.eligible).toBe(true)
    expect(result.nextMilestoneCleanups).toBe(1)
  })

  it('keeps production Celo at ten cleanups', () => {
    const result = checkHypercertEligibility({
      cleanupsCount: 1,
      reportsCount: 1,
      publishedCount: 0,
      chainId: 42220,
    })
    expect(result.eligible).toBe(false)
    expect(result.nextMilestoneCleanups).toBe(10)
  })
})
