import { encodeFunctionData } from 'viem'
import {
  BASE_MINIAPP_VERIFICATION_ABI,
  basePointsToWei,
  nextBaseImpactLevel,
} from '@/lib/blockchain/base-miniapp'

describe('Base Mini App ABI', () => {
  it('encodes live Verification selectors', () => {
    expect(
      encodeFunctionData({
        abi: BASE_MINIAPP_VERIFICATION_ABI,
        functionName: 'submitCleanup',
        args: [
          'QmBefore',
          'QmAfter',
          1n,
          2n,
          '0x0000000000000000000000000000000000000000',
          false,
          '',
        ],
      }).slice(0, 10)
    ).toBe('0xaf923bd3')

    expect(
      encodeFunctionData({
        abi: BASE_MINIAPP_VERIFICATION_ABI,
        functionName: 'claimImpactProduct',
        args: [2n],
      }).slice(0, 10)
    ).toBe('0x0344b24b')

    expect(
      encodeFunctionData({
        abi: BASE_MINIAPP_VERIFICATION_ABI,
        functionName: 'verifyCleanup',
        args: [2n, 1],
      }).startsWith('0x')
    ).toBe(true)
  })

  it('scales whole points to 18-decimal DCU for existing UI', () => {
    expect(basePointsToWei(10n)).toBe(10n * 10n ** 18n)
  })

  it('assigns the next Impact Product level on verify', () => {
    expect(nextBaseImpactLevel(0)).toBe(1)
    expect(nextBaseImpactLevel(1)).toBe(2)
    expect(nextBaseImpactLevel(10)).toBe(10)
  })
})
