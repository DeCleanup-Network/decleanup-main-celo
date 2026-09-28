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

  it('keeps Celo mainnet at ten cleanups and one report', () => {
    const result = checkHypercertEligibility({
      cleanupsCount: 1,
      reportsCount: 1,
      publishedCount: 0,
      chainId: 42220,
    })
    expect(result.eligible).toBe(false)
    expect(result.nextMilestoneCleanups).toBe(10)
  })

  it('keeps Celo Sepolia at ten cleanups, not the 1-cleanup demo', () => {
    const result = checkHypercertEligibility({
      cleanupsCount: 3,
      reportsCount: 2,
      publishedCount: 0,
      chainId: 11142220,
    })
    expect(result.eligible).toBe(false)
    expect(result.nextMilestoneCleanups).toBe(10)
  })

  it('uses production thresholds when chainId is omitted', () => {
    const result = checkHypercertEligibility({
      cleanupsCount: 3,
      reportsCount: 2,
      publishedCount: 0,
    })
    expect(result.eligible).toBe(false)
    expect(result.nextMilestoneCleanups).toBe(10)
  })
})
