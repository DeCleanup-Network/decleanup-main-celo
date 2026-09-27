import {
  isBaseExperience,
  isCeloExperience,
  isRobinhoodExperience,
  isSupportedExperienceChain,
} from '@/lib/blockchain/chain-preference'

describe('chain experience', () => {
  it('treats Celo mainnet and sepolia as Celo', () => {
    expect(isCeloExperience(42220)).toBe(true)
    expect(isCeloExperience(11142220)).toBe(true)
    expect(isCeloExperience(8453)).toBe(false)
  })

  it('treats Base mainnet and sepolia as Base', () => {
    expect(isBaseExperience(8453)).toBe(true)
    expect(isBaseExperience(84532)).toBe(true)
    expect(isBaseExperience(42220)).toBe(false)
  })

  it('accepts only supported experience chains', () => {
    expect(isSupportedExperienceChain(42220)).toBe(true)
    expect(isSupportedExperienceChain(8453)).toBe(true)
    expect(isSupportedExperienceChain(46630)).toBe(true)
    expect(isSupportedExperienceChain(1)).toBe(false)
  })

  it('treats Robinhood testnet as its own experience', () => {
    expect(isRobinhoodExperience(46630)).toBe(true)
    expect(isRobinhoodExperience(42220)).toBe(false)
    expect(isBaseExperience(46630)).toBe(false)
    expect(isCeloExperience(46630)).toBe(false)
  })
})
