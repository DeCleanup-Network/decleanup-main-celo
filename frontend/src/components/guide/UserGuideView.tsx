'use client'

import { useEffect, useState } from 'react'
import { isBaseExperience } from '@/lib/blockchain/chain-preference'
import { BaseUserGuide } from '@/components/guide/BaseUserGuide'
import { CeloUserGuide } from '@/components/guide/CeloUserGuide'

export function UserGuideView() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="min-h-screen bg-background" />
  }

  return isBaseExperience() ? <BaseUserGuide /> : <CeloUserGuide />
}
