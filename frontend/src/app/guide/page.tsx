'use client'

import { useEffect } from 'react'
import {
  BASE_MAINNET_CHAIN_ID,
  CELO_MAINNET_CHAIN_ID,
} from '@/lib/blockchain/chain-constants'
import { writeChainPreference } from '@/lib/blockchain/chain-preference'
import { websiteGuideUrl } from '@/lib/guides/website-guides'

export default function UserGuidePage() {
  useEffect(() => {
    const chain = (new URLSearchParams(window.location.search).get('chain') || '').toLowerCase()
    if (chain === 'base') writeChainPreference(BASE_MAINNET_CHAIN_ID)
    if (chain === 'celo') writeChainPreference(CELO_MAINNET_CHAIN_ID)
    window.location.replace(websiteGuideUrl())
  }, [])

  return <div className="min-h-screen bg-background" aria-label="Opening user guide" />
}
