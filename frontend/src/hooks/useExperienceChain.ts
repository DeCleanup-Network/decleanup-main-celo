'use client'

import { useEffect, useState } from 'react'
import { REQUIRED_CHAIN_ID, type SupportedChainId } from '@/lib/blockchain/chain-constants'
import {
  isBaseExperience,
  isCeloExperience,
  readChainPreference,
} from '@/lib/blockchain/chain-preference'

/** Live Celo/Base pick after mount. Defaults to env chain until localStorage is read. */
export function useExperienceChain() {
  const [chainId, setChainId] = useState<SupportedChainId>(REQUIRED_CHAIN_ID)

  useEffect(() => {
    setChainId(readChainPreference() ?? REQUIRED_CHAIN_ID)
  }, [])

  return {
    chainId,
    isBase: isBaseExperience(chainId),
    isCelo: isCeloExperience(chainId),
  }
}
