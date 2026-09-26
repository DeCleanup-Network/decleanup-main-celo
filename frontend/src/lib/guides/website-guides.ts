import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { isBaseExperience, readChainPreference } from '@/lib/blockchain/chain-preference'

export const WEBSITE_GUIDE_BASE = 'https://www.decleanup.net/public/guides/base'
export const WEBSITE_GUIDE_CELO = 'https://www.decleanup.net/public/guides/celo'

export function websiteGuideUrl(chainId?: number): string {
  const id = chainId ?? (typeof window !== 'undefined' ? readChainPreference() : null) ?? REQUIRED_CHAIN_ID
  return isBaseExperience(id) ? WEBSITE_GUIDE_BASE : WEBSITE_GUIDE_CELO
}
