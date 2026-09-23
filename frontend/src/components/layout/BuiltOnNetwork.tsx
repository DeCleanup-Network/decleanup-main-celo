'use client'

import { useEffect, useState } from 'react'
import { isBaseExperience } from '@/lib/blockchain/chain-preference'

export function BuiltOnNetwork() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const base = mounted && isBaseExperience()
  return (
    <div className="font-meta flex items-center justify-center gap-2 opacity-50">
      <span>Built on</span>
      {base ? (
        <img src="/base-logo-white.svg" alt="Base" className="h-5 w-auto rounded-sm sm:h-6" />
      ) : (
        <img src="/celo-celo-logo.svg" alt="Celo" className="h-5 w-auto rounded-sm sm:h-6" />
      )}
    </div>
  )
}
