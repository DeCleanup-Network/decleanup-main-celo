import {
  getActiveAaChain,
  getActiveNativeGasSymbol,
  getActivePimlicoSlug,
  getPimlicoBundlerUrl,
  isSupportedChainId,
  resolveActiveChainId,
} from '@/lib/blockchain/aa-chain'
import { CHAIN_PREFERENCE_KEY } from '@/lib/blockchain/chain-constants'

describe('AA chain helpers', () => {
  it('maps Pimlico slugs for Celo and Base', () => {
    expect(getActivePimlicoSlug(42220)).toBe('celo')
    expect(getActivePimlicoSlug(11142220)).toBe('celo-sepolia')
    expect(getActivePimlicoSlug(8453)).toBe('base')
    expect(getActivePimlicoSlug(84532)).toBe('base-sepolia')
  })

  it('builds the bundler URL from the slug', () => {
    expect(getPimlicoBundlerUrl('test-key', 8453)).toBe(
      'https://api.pimlico.io/v2/base/rpc?apikey=test-key'
    )
    expect(getPimlicoBundlerUrl('test-key', 42220)).toBe(
      'https://api.pimlico.io/v2/celo/rpc?apikey=test-key'
    )
  })

  it('uses ETH on Base and CELO on Celo', () => {
    expect(getActiveNativeGasSymbol(8453)).toBe('ETH')
    expect(getActiveNativeGasSymbol(84532)).toBe('ETH')
    expect(getActiveNativeGasSymbol(42220)).toBe('CELO')
    expect(getActiveNativeGasSymbol(11142220)).toBe('CELO')
  })

  it('returns a viem chain with the requested id', () => {
    expect(getActiveAaChain(8453).id).toBe(8453)
    expect(getActiveAaChain(42220).id).toBe(42220)
    expect(isSupportedChainId(8453)).toBe(true)
    expect(isSupportedChainId(1)).toBe(false)
  })

  it('reads the stored experience when no chainId is passed', () => {
    window.localStorage.setItem(CHAIN_PREFERENCE_KEY, '8453')
    expect(resolveActiveChainId()).toBe(8453)
    expect(getActivePimlicoSlug()).toBe('base')
    window.localStorage.setItem(CHAIN_PREFERENCE_KEY, '42220')
    expect(getActivePimlicoSlug()).toBe('celo')
    window.localStorage.removeItem(CHAIN_PREFERENCE_KEY)
  })
})
