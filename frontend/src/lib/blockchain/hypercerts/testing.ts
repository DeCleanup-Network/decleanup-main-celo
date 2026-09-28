import { REQUIRED_CHAIN_IS_TESTNET, REQUIRED_CHAIN_ID } from '../chain-constants'

const CELO_MAINNET_CHAIN_ID = 42220

/**
 * When true, unused leftover for local experiments. Celo Hypercerts always use
 * production thresholds (10 cleanups + 1 report). Robinhood is the 1-cleanup demo.
 */
export function useRelaxedHypercertThresholds(): boolean {
  if (typeof process === 'undefined') return false
  return process.env.NEXT_PUBLIC_HYPERCERT_RELAXED_ELIGIBILITY === 'true'
}

/**
 * Testing mode: use testnet eligibility thresholds.
 * True when we're on the app's required chain (Celo Sepolia), or when the app is configured for
 * testnet and the wallet is on any non-mainnet chain (e.g. wrong chain 11138620 still gets test thresholds).
 */
export function isTestingMode(chainId?: number): boolean {
  if (chainId == null) return REQUIRED_CHAIN_IS_TESTNET
  if (chainId === REQUIRED_CHAIN_ID) return true
  if (REQUIRED_CHAIN_IS_TESTNET && chainId !== CELO_MAINNET_CHAIN_ID) return true
  return false
}