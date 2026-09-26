'use client'

import { useEffect, useState } from 'react'
import {
  BASE_MAINNET_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
  type SupportedChainId,
} from '@/lib/blockchain/chain-constants'
import { readChainPreference, writeChainPreference } from '@/lib/blockchain/chain-preference'
import { websiteGuideUrl } from '@/lib/guides/website-guides'
import { ExperiencePickerModal } from '@/components/network/ExperiencePickerModal'

function preferenceFromQuery(): SupportedChainId | null {
  if (typeof window === 'undefined') return null
  const chain = (new URLSearchParams(window.location.search).get('chain') || '').toLowerCase()
  if (chain === 'base') return BASE_MAINNET_CHAIN_ID
  if (chain === 'celo') return CELO_MAINNET_CHAIN_ID
  return null
}

export function FirstVisitExperienceGate() {
  const [phase, setPhase] = useState<'unknown' | 'gate' | 'ready'>('unknown')

  useEffect(() => {
    const fromQuery = preferenceFromQuery()
    if (fromQuery != null) {
      writeChainPreference(fromQuery)
      setPhase('ready')
      return
    }
    setPhase(readChainPreference() ? 'ready' : 'gate')
  }, [])

  const handleSelect = (chainId: SupportedChainId) => {
    writeChainPreference(chainId)
    // Old /guide bookmarks go to the website guide for the chosen chain.
    if (window.location.pathname.startsWith('/guide')) {
      window.location.assign(websiteGuideUrl(chainId))
      return
    }
    window.location.assign('/')
  }

  if (phase === 'ready') return null

  if (phase === 'unknown') {
    return <div className="fixed inset-0 z-[80] bg-black" aria-hidden />
  }

  return <ExperiencePickerModal onSelect={handleSelect} />
}
