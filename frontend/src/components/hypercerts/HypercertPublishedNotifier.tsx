'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useHypercertWallet } from '@/hooks/useHypercertWallet'
import {
  fetchHypercertRequestsByUser,
  isHypercertPublished,
} from '@/lib/blockchain/hypercerts/requests'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'
import {
  getNotifiedHypercertRequestIds,
  markHypercertPublishNotified,
} from '@/lib/blockchain/hypercerts/publish-notification'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import { AlertModal } from '@/components/ui/alert-modal'

function pickLatestUnnotifiedPublished(
  requests: HypercertRequest[],
  notified: Set<string>
): HypercertRequest | null {
  const candidates = requests
    .filter((r) => isHypercertPublished(r) && r.atUri && !notified.has(r.id))
    .sort((a, b) => {
      const aAt = a.atPublishedAt ?? a.reviewedAt ?? a.submittedAt
      const bAt = b.atPublishedAt ?? b.reviewedAt ?? b.submittedAt
      return bAt - aAt
    })
  return candidates[0] ?? null
}

/**
 * Shows a one-time success modal when the user returns and has a newly published Hypercert.
 */
export function HypercertPublishedNotifier() {
  const { showMainApp } = useAppWalletAddress()
  const { eoaAddress, eligibilityAddress } = useHypercertWallet()
  const [pending, setPending] = useState<HypercertRequest | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    if (!showMainApp || !eoaAddress) {
      setPending(null)
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const requests = await fetchHypercertRequestsByUser(
          eoaAddress,
          eligibilityAddress && eligibilityAddress.toLowerCase() !== eoaAddress.toLowerCase()
            ? eligibilityAddress
            : undefined
        )
        if (cancelled) return

        const notified = getNotifiedHypercertRequestIds(eoaAddress)
        const latest = pickLatestUnnotifiedPublished(requests, notified)
        setPending(latest)
      } catch {
        if (!cancelled) setPending(null)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [showMainApp, eoaAddress, eligibilityAddress, refreshKey])

  useEffect(() => {
    if (!showMainApp) return

    const onVisible = () => {
      if (document.visibilityState === 'visible') bumpRefresh()
    }
    const onFocus = () => bumpRefresh()

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
  }, [showMainApp, bumpRefresh])

  if (!pending?.atUri) return null

  const title =
    pending.metadata?.branding?.title ?? pending.metadata?.name ?? 'Your Hypercert'
  const hyperscanUrl = buildHyperscanHypercertUrl(pending.atUri)

  const handleClose = () => {
    if (eoaAddress) markHypercertPublishNotified(eoaAddress, pending.id)
    setPending(null)
    bumpRefresh()
  }

  return (
    <AlertModal
      isOpen
      onClose={handleClose}
      title="Hypercert published"
      variant="success"
      closeOnBackdropClick={false}
      message={
        <div className="space-y-3">
          <p>
            Your certificate <strong className="text-white">{title}</strong> is live on Hyperscan.
          </p>
          <p>
            <Link
              href={hyperscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
            >
              View on Hyperscan
            </Link>
          </p>
        </div>
      }
    />
  )
}
