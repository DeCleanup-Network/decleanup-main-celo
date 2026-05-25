'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { isVerifier as isVerifierOnChain } from '@/lib/blockchain/contracts'
import type { VerifierApplication } from '@/lib/verifier/types'
import {
  ownedVerifierWalletTargets,
  pickOwnedVerifierApplication,
} from '@/lib/verifier/owned-application'
import { scheduleIdle } from '@/lib/dashboard/schedule-idle'

type Options = {
  /** Wait until browser idle before hitting verifier APIs / on-chain role check. */
  defer?: boolean
}

/**
 * Verifier UX is driven by an approved application — not raw on-chain VERIFIER_ROLE alone.
 */
export function useVerifierAccess(options?: Options) {
  const defer = options?.defer ?? false
  const [active, setActive] = useState(!defer)
  const { submissionOwnerAddress } = useSmartAccountClient()
  const { address, isAuthenticated } = useAppWalletAddress()
  const rewardIdentity = (submissionOwnerAddress ?? address) as Address | undefined
  const ownedTargets = useMemo(
    () => ownedVerifierWalletTargets(submissionOwnerAddress ?? null, address ?? null),
    [submissionOwnerAddress, address]
  )

  const [latestApp, setLatestApp] = useState<VerifierApplication | null>(null)
  const [loading, setLoading] = useState(false)
  const [onChainRole, setOnChainRole] = useState(false)

  useEffect(() => {
    if (!defer || active) return
    return scheduleIdle(() => setActive(true), 3500)
  }, [defer, active])

  const applicationApproved = latestApp?.status === 'APPROVED'
  const showVerifierFeatures = active && applicationApproved
  const showVerifierApplyCard = active && isAuthenticated && !applicationApproved

  const loadApplication = useCallback(async () => {
    if (!active) return
    if (!ownedTargets.length) {
      setLatestApp(null)
      return
    }
    setLoading(true)
    try {
      const preferred = submissionOwnerAddress?.toLowerCase() ?? address?.toLowerCase()
      const settled = await Promise.allSettled(
        ownedTargets.map(async (candidate) => {
          const res = await fetch(
            `/api/verifier/applications?address=${encodeURIComponent(candidate)}`,
            { cache: 'no-store' }
          )
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data?.success || data.verifierApplicationsUnavailable) {
            return null
          }
          return (data.application as VerifierApplication | null) ?? null
        })
      )
      const rows: VerifierApplication[] = []
      for (const s of settled) {
        if (s.status === 'fulfilled' && s.value) rows.push(s.value)
      }
      setLatestApp(pickOwnedVerifierApplication(rows, preferred))
    } catch {
      setLatestApp(null)
    } finally {
      setLoading(false)
    }
  }, [active, ownedTargets, submissionOwnerAddress, address])

  useEffect(() => {
    void loadApplication()
  }, [loadApplication])

  useEffect(() => {
    if (!active || !rewardIdentity) {
      setOnChainRole(false)
      return
    }
    void isVerifierOnChain(rewardIdentity)
      .then(setOnChainRole)
      .catch(() => setOnChainRole(false))
  }, [active, rewardIdentity])

  return {
    rewardIdentity,
    latestApp,
    loading,
    applicationApproved,
    showVerifierFeatures,
    showVerifierApplyCard,
    onChainRoleWithoutApplication: active && onChainRole && !applicationApproved,
    onChainRole,
    refreshApplication: loadApplication,
  }
}
