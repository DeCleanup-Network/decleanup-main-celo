import { encodeFunctionData } from 'viem'
import {
  getActiveAppChainId,
  getRewardManagerAddress,
  getSubmissionAddress,
  usesBaseMiniAppSubmission,
} from '@/lib/blockchain/active-contracts'
import { CHAIN_PREFERENCE_KEY } from '@/lib/blockchain/chain-constants'

describe('active contracts', () => {
  afterEach(() => {
    window.localStorage.removeItem(CHAIN_PREFERENCE_KEY)
  })

  it('uses Base Submission and Reward when the experience is Base', () => {
    window.localStorage.setItem(CHAIN_PREFERENCE_KEY, '8453')
    expect(getActiveAppChainId()).toBe(8453)
    expect(usesBaseMiniAppSubmission()).toBe(true)
    expect(getSubmissionAddress()?.toLowerCase()).toBe(
      '0x69715d43ea6d46f65045fce2391d9b7f89ec819f'
    )
    expect(getRewardManagerAddress()?.toLowerCase()).toBe(
      '0x492065137e07c660dcfae4dc335a3fa9c1203dd9'
    )
  })

  it('uses Celo env contracts when the experience is Celo', () => {
    window.localStorage.setItem(CHAIN_PREFERENCE_KEY, '42220')
    expect(getActiveAppChainId()).toBe(42220)
    expect(usesBaseMiniAppSubmission()).toBe(false)
    expect(getSubmissionAddress()?.toLowerCase()).toBe(
      (process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT || '').toLowerCase()
    )
  })

  it('encodes the live Base Mini App submitCleanup selector', () => {
    window.localStorage.setItem(CHAIN_PREFERENCE_KEY, '8453')
    expect(usesBaseMiniAppSubmission()).toBe(true)
    const data = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'submitCleanup',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'beforePhotoHash', type: 'string' },
            { name: 'afterPhotoHash', type: 'string' },
            { name: 'latitude', type: 'uint256' },
            { name: 'longitude', type: 'uint256' },
            { name: 'referrerAddress', type: 'address' },
            { name: 'hasImpactForm', type: 'bool' },
            { name: 'impactReportHash', type: 'string' },
          ],
          outputs: [],
        },
      ],
      functionName: 'submitCleanup',
      args: [
        'QmBefore',
        'QmAfter',
        9_710_957n,
        99_999_994n,
        '0x0000000000000000000000000000000000000000',
        false,
        '',
      ],
    })
    expect(data.slice(0, 10)).toBe('0xaf923bd3')
  })
})
