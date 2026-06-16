'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useSearchParams } from 'next/navigation'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import { getUserSubmissions } from '@/lib/blockchain/contracts'
import { normalizeReferrerAddress } from '@/lib/wallet/normalize-referrer-address'
import { scheduleIdle } from '@/lib/dashboard/schedule-idle'

type Params = {
  mounted: boolean
  address?: Address
  isConnected: boolean
  publicWalletAddress?: Address
  onchainOwnerAddress?: Address
  /** @deprecated Use onchainOwnerAddress */
  submissionOwnerAddress?: Address
}

/** Referral banner — deferred until browser idle to avoid competing with dashboard core RPCs. */
export function useHomeReferralNotification({
  mounted,
  address,
  isConnected,
  publicWalletAddress,
  onchainOwnerAddress,
  submissionOwnerAddress,
}: Params) {
  const submissionOwner = onchainOwnerAddress ?? submissionOwnerAddress
  const searchParams = useSearchParams()
  const [showReferralNotification, setShowReferralNotification] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<Address | null>(null)

  useEffect(() => {
    if (!mounted || !address || !isConnected) return

    setShowReferralNotification(false)
    setReferrerAddress(null)

    const cancelIdle = scheduleIdle(() => {
      void (async () => {
        try {
          if (!submissionOwner) return
          const owner = submissionOwner

          const { getUserReferrer } = await import('@/lib/blockchain/contracts')
          const contractReferrer = await getUserReferrer(owner)

          if (contractReferrer) {
            const submissions = await getUserSubmissions(owner)
            const hasSubmitted = submissions.length > 0
            const currentStatus = await getUserCleanupStatus(owner)
            const hasPendingCleanup = currentStatus?.hasPendingCleanup || false
            const displayReferrer = await normalizeReferrerAddress(contractReferrer)

            if (hasSubmitted || hasPendingCleanup) {
              setReferrerAddress(displayReferrer)
              setShowReferralNotification(false)
            } else {
              setReferrerAddress(displayReferrer)
              const dismissedKey = `referral_notification_dismissed_${displayReferrer.toLowerCase()}`
              if (!localStorage.getItem(dismissedKey)) {
                setShowReferralNotification(true)
              }
            }
            return
          }

          const submissions = await getUserSubmissions(owner)
          if (submissions.length > 0) {
            setShowReferralNotification(false)
            setReferrerAddress(null)
            if (typeof window !== 'undefined') {
              const scope = (publicWalletAddress ?? address).toLowerCase()
              localStorage.removeItem(`referrer_${scope}`)
              localStorage.removeItem('referrer_pending')
            }
            return
          }

          let ref: string | null = searchParams?.get('ref') ?? null
          if (!ref && typeof window !== 'undefined') {
            ref = new URLSearchParams(window.location.search).get('ref')
          }

          if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
            const referrerAddr = await normalizeReferrerAddress(ref as Address)
            setReferrerAddress(referrerAddr)
            const dismissedKey = `referral_notification_dismissed_${referrerAddr.toLowerCase()}`
            if (!localStorage.getItem(dismissedKey)) {
              setShowReferralNotification(true)
            }
            const scope = (publicWalletAddress ?? address).toLowerCase()
            localStorage.setItem(`referrer_${scope}`, referrerAddr)
            localStorage.removeItem('referrer_pending')
            return
          }

          const scope = (publicWalletAddress ?? address).toLowerCase()
          const savedReferrer = localStorage.getItem(`referrer_${scope}`)
          if (savedReferrer && /^0x[a-fA-F0-9]{40}$/.test(savedReferrer)) {
            const referrerAddr = await normalizeReferrerAddress(savedReferrer as Address)
            setReferrerAddress(referrerAddr)
            const dismissedKey = `referral_notification_dismissed_${referrerAddr.toLowerCase()}`
            if (!localStorage.getItem(dismissedKey)) {
              setShowReferralNotification(true)
            }
          } else {
            setShowReferralNotification(false)
            setReferrerAddress(null)
            localStorage.removeItem('referrer_pending')
          }
        } catch (error) {
          console.error('[Referral] Error checking referral:', error)
        }
      })()
    }, 3000)

    return cancelIdle
  }, [mounted, address, publicWalletAddress, isConnected, searchParams, submissionOwner])

  return { showReferralNotification, setShowReferralNotification, referrerAddress }
}
