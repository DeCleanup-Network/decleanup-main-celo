'use client'

import { useEffect, useState } from 'react'
import {
  BASE_MAINNET_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
  REQUIRED_CHAIN_ID,
  type SupportedChainId,
} from '@/lib/blockchain/chain-constants'
import {
  isBaseExperience,
  readChainPreference,
  writeChainPreference,
} from '@/lib/blockchain/chain-preference'
import { BaseUserGuide } from '@/components/guide/BaseUserGuide'
import { CeloUserGuide } from '@/components/guide/CeloUserGuide'

/** Deep-link from marketing site: /guide?chain=base | /guide?chain=celo */
function preferenceFromQuery(): SupportedChainId | null {
  if (typeof window === 'undefined') return null
  const chain = (new URLSearchParams(window.location.search).get('chain') || '').toLowerCase()
  if (chain === 'base') return BASE_MAINNET_CHAIN_ID
  if (chain === 'celo') return CELO_MAINNET_CHAIN_ID
  return null
}

export function UserGuideView() {
  const [chainId, setChainId] = useState<SupportedChainId | null>(null)

  useEffect(() => {
    const fromQuery = preferenceFromQuery()
    if (fromQuery != null) {
      writeChainPreference(fromQuery)
      setChainId(fromQuery)
      return
    }
    setChainId(readChainPreference() ?? REQUIRED_CHAIN_ID)
  }, [])

  if (chainId == null) {
    return <div className="min-h-screen bg-background" />
  }

  return isBaseExperience(chainId) ? <BaseUserGuide /> : <CeloUserGuide />
}
