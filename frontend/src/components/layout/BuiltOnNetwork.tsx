'use client'

import { useEffect, useState } from 'react'
import { isBaseExperience, isRobinhoodExperience } from '@/lib/blockchain/chain-preference'

export function BuiltOnNetwork() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const robinhood = mounted && isRobinhoodExperience()
  const base = mounted && isBaseExperience()
  return (
    <div className="font-meta flex items-center justify-center gap-2 opacity-50">
      <span>Built on</span>
      {robinhood ? (
        <img
          src="/robinhood-chain-logo-white.svg"
          alt="Robinhood Chain"
          className="h-5 w-auto sm:h-6"
        />
      ) : base ? (
        <img src="/base-logo-white.svg" alt="Base" className="h-5 w-auto rounded-sm sm:h-6" />
      ) : (
        <img src="/celo-celo-logo.svg" alt="Celo" className="h-5 w-auto rounded-sm sm:h-6" />
      )}
    </div>
  )
}
