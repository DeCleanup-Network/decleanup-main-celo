'use client'

import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useSearchParams } from 'next/navigation'
import { getUserCleanupStatus } from '@/lib/blockchain/verification'
import { getUserSubmissions } from '@/lib/blockchain/contracts'
import { scheduleIdle } from '@/lib/dashboard/schedule-idle'

type Params = {
  mounted: boolean
  address?: Address
  isConnected: boolean
  submissionOwnerAddress?: Address
}

/** Referral banner — deferred until browser idle to avoid competing with dashboard core RPCs. */
export function useHomeReferralNotification({
  mounted,
  address,
  isConnected,
  submissionOwnerAddress,
}: Params) {
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
          if (!submissionOwnerAddress) return
          const owner = submissionOwnerAddress

          const { getUserReferrer } = await import('@/lib/blockchain/contracts')
          const contractReferrer = await getUserReferrer(owner)

          if (contractReferrer) {
            const submissions = await getUserSubmissions(owner)
            const hasSubmitted = submissions.length > 0
            const currentStatus = await getUserCleanupStatus(owner)
            const hasPendingCleanup = currentStatus?.hasPendingCleanup || false

            if (hasSubmitted || hasPendingCleanup) {
              setReferrerAddress(contractReferrer)
              setShowReferralNotification(false)
            } else {
              setReferrerAddress(contractReferrer)
              const dismissedKey = `referral_notification_dismissed_${contractReferrer.toLowerCase()}`
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
              localStorage.removeItem(`referrer_${address.toLowerCase()}`)
              localStorage.removeItem('referrer_pending')
            }
            return
          }

          let ref: string | null = searchParams?.get('ref') ?? null
          if (!ref && typeof window !== 'undefined') {
            ref = new URLSearchParams(window.location.search).get('ref')
          }

          if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
            const referrerAddr = ref as Address
            setReferrerAddress(referrerAddr)
            const dismissedKey = `referral_notification_dismissed_${referrerAddr.toLowerCase()}`
            if (!localStorage.getItem(dismissedKey)) {
              setShowReferralNotification(true)
            }
            localStorage.setItem(`referrer_${address.toLowerCase()}`, referrerAddr)
            localStorage.removeItem('referrer_pending')
            return
          }

          const savedReferrer = localStorage.getItem(`referrer_${address.toLowerCase()}`)
          if (savedReferrer && /^0x[a-fA-F0-9]{40}$/.test(savedReferrer)) {
            setReferrerAddress(savedReferrer as Address)
            const dismissedKey = `referral_notification_dismissed_${savedReferrer.toLowerCase()}`
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
  }, [mounted, address, isConnected, searchParams, submissionOwnerAddress])

  return { showReferralNotification, setShowReferralNotification, referrerAddress }
}
