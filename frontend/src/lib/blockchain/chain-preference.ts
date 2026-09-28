import {
  BASE_MAINNET_CHAIN_ID,
  BASE_SEPOLIA_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
  CHAIN_CONFIGS,
  CHAIN_PREFERENCE_KEY,
  REQUIRED_CHAIN_ID,
  ROBINHOOD_TESTNET_CHAIN_ID,
  type SupportedChainId,
} from './chain-constants'

export { CHAIN_PREFERENCE_KEY }

export function isSupportedExperienceChain(id: number): id is SupportedChainId {
  return id in CHAIN_CONFIGS
}

function liveExperienceChainId(): number {
  return readChainPreference() ?? REQUIRED_CHAIN_ID
}

export function isCeloExperience(chainId: number = liveExperienceChainId()): boolean {
  return chainId === CELO_MAINNET_CHAIN_ID || chainId === CELO_SEPOLIA_CHAIN_ID
}

export function isBaseExperience(chainId: number = liveExperienceChainId()): boolean {
  return chainId === BASE_MAINNET_CHAIN_ID || chainId === BASE_SEPOLIA_CHAIN_ID
}

export function isRobinhoodExperience(chainId: number = liveExperienceChainId()): boolean {
  return chainId === ROBINHOOD_TESTNET_CHAIN_ID
}

export function readChainPreference(): SupportedChainId | null {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(CHAIN_PREFERENCE_KEY)
  if (!stored) return null
  const id = Number(stored)
  return isSupportedExperienceChain(id) ? id : null
}

export const CHAIN_PREFERENCE_CHANGE_EVENT = 'decleanup-chain-preference'

export function writeChainPreference(chainId: SupportedChainId): void {
  window.localStorage.setItem(CHAIN_PREFERENCE_KEY, String(chainId))
  window.dispatchEvent(new Event(CHAIN_PREFERENCE_CHANGE_EVENT))
}
