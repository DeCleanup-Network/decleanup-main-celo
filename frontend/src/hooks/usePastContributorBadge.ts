'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'

/**
 * True when this address claimed the manual past-contributor airdrop (server store).
 */
export function usePastContributorBadge(address?: Address | string) {
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address) {
      setShow(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetch(`/api/airdrop/check?address=${encodeURIComponent(address)}`)
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && data.pastContributorBadge) {
          setShow(true)
        } else if (!cancelled) {
          setShow(false)
        }
      } catch {
        if (!cancelled) setShow(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [address])

  return { showPastContributorBadge: show, badgeLoading: loading }
}
