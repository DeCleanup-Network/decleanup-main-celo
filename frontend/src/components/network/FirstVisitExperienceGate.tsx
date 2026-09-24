'use client'

import { useEffect, useState } from 'react'
import { type SupportedChainId } from '@/lib/blockchain/chain-constants'
import { readChainPreference, writeChainPreference } from '@/lib/blockchain/chain-preference'
import { ExperiencePickerModal } from '@/components/network/ExperiencePickerModal'

export function FirstVisitExperienceGate() {
  const [phase, setPhase] = useState<'unknown' | 'gate' | 'ready'>('unknown')

  useEffect(() => {
    setPhase(readChainPreference() ? 'ready' : 'gate')
  }, [])

  const handleSelect = (chainId: SupportedChainId) => {
    writeChainPreference(chainId)
    window.location.assign('/')
  }

  if (phase === 'ready') return null

  if (phase === 'unknown') {
    return <div className="fixed inset-0 z-[80] bg-black" aria-hidden />
  }

  return <ExperiencePickerModal onSelect={handleSelect} />
}
