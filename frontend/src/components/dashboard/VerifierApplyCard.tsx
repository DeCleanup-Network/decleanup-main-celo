/**
 * VerifierApplyCard Component
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { useVerifierEligibility } from '@/hooks/useVerifierEligibility'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { VERIFIER_CONFIG } from '@/config/verifier'
import { Shield, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import type { VerifierApplication } from '@/lib/verifier/types'
import type { Address } from 'viem'
import { isVerifier as isVerifierOnChain } from '@/lib/blockchain/contracts'

const { minLevel, minDCUBalance, minApprovedCleanups } = VERIFIER_CONFIG.requirements

export function VerifierApplyCard() {
  const { address } = useAccount()
  const { submissionOwnerAddress } = useSmartAccountClient()
  const applicantAddress = submissionOwnerAddress
  const { eligibility, isLoading, error } = useVerifierEligibility()
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [latestApp, setLatestApp] = useState<VerifierApplication | null>(null)
  const [loadingApplication, setLoadingApplication] = useState(false)
  const [isVerifierNow, setIsVerifierNow] = useState(false)
  const [checkingVerifierRole, setCheckingVerifierRole] = useState(true)

  const loadLatestApplication = useCallback(async () => {
    if (!address && !applicantAddress) return
    setLoadingApplication(true)
    try {
      const targets = [address, applicantAddress].filter(Boolean) as string[]
      const rows = await Promise.all(
        targets.map(async (candidate) => {
          const res = await fetch(`/api/verifier/applications?address=${encodeURIComponent(candidate)}`, {
            cache: 'no-store',
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data?.success) return null
          if (data.verifierApplicationsUnavailable) return null
          return (data.application || null) as VerifierApplication | null
        })
      )
      const mine = rows
        .filter((row): row is VerifierApplication => !!row)
        .sort((a, b) => b.appliedAt - a.appliedAt)
      const next = mine[0] || null
      setLatestApp((prev) => {
        if (next) return next
        return prev
      })
    } catch {
      // Keep UI functional even if status fetch fails.
    } finally {
      setLoadingApplication(false)
    }
  }, [address, applicantAddress])

  useEffect(() => {
    void loadLatestApplication()
  }, [loadLatestApplication])

  useEffect(() => {
    let cancelled = false
    async function checkVerifierRole() {
      if (!applicantAddress) {
        setIsVerifierNow(false)
        setCheckingVerifierRole(false)
        return
      }
      try {
        const status = await isVerifierOnChain(applicantAddress)
        if (!cancelled) setIsVerifierNow(status)
      } catch {
        if (!cancelled) setIsVerifierNow(false)
      } finally {
        if (!cancelled) setCheckingVerifierRole(false)
      }
    }
    void checkVerifierRole()
    return () => {
      cancelled = true
    }
  }, [applicantAddress, latestApp?.status])

  useEffect(() => {
    if (!latestApp?.status) return
    if (latestApp.status !== 'PENDING' && latestApp.status !== 'PENDING_ONCHAIN') return
    const id = window.setInterval(() => {
      void loadLatestApplication()
    }, 10_000)
    return () => window.clearInterval(id)
  }, [latestApp?.id, latestApp?.status, loadLatestApplication])

  const handleApply = async () => {
    if (!eligibility?.eligible || !applicantAddress) return
    setIsApplying(true)
    setApplyError(null)

    try {
      const response = await fetch('/api/verifier/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: applicantAddress, metrics: eligibility.metrics }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMessage =
          [data?.error, data?.hint, data?.detail].filter(Boolean).join(' — ') ||
          'Failed to submit application'
        if (response.status === 409 && /pending application/i.test(errorMessage)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('decleanup_last_verifier_applicant', applicantAddress.toLowerCase())
          }
          setLatestApp((prev) =>
            prev ?? {
              id: 'pending-local',
              address: (applicantAddress as string).toLowerCase(),
              appliedAt: Date.now(),
              status: 'PENDING',
            }
          )
          await loadLatestApplication()
          setApplyError(null)
          return
        }
        throw new Error(data.error || 'Failed to submit application')
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('decleanup_last_verifier_applicant', applicantAddress.toLowerCase())
      }
      const created = data?.application as VerifierApplication | undefined
      if (created?.id) {
        setLatestApp(created)
      }
      await loadLatestApplication()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsApplying(false)
    }
  }

  if (!address) return null

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <SectionHeading
          icon={Shield}
          aside={<Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-yellow" aria-hidden />}
        >
          BECOME A VERIFIER
        </SectionHeading>
        <p className="text-sm text-muted-foreground">Loading eligibility...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <SectionHeading icon={Shield}>BECOME A VERIFIER</SectionHeading>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (loadingApplication && !latestApp) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <SectionHeading icon={Shield}>VERIFIER APPLICATION</SectionHeading>
        <p className="text-sm text-muted-foreground">Loading application status...</p>
      </div>
    )
  }

  if (!checkingVerifierRole && isVerifierNow && !latestApp) {
    return (
      <div className="rounded-2xl border border-brand-green/30 bg-brand-green/5 p-6">
        <SectionHeading icon={Shield}>VERIFIER STATUS</SectionHeading>
        <p className="text-sm text-green-400">You are now a verifier.</p>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          <li>• Review fairly using photo evidence.</li>
          <li>• Check that reports match the photos.</li>
          <li>• Approve only valid cleanups; reject suspicious ones.</li>
          <li>• Do not review your own submissions.</li>
          <li>• The team may audit decisions and penalize misuse.</li>
        </ul>
      </div>
    )
  }

  if (latestApp) {
    const showApprovedState = latestApp.status === 'APPROVED' || isVerifierNow
    const effectiveStatus = showApprovedState ? 'APPROVED' : latestApp.status
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <SectionHeading icon={Shield}>VERIFIER APPLICATION</SectionHeading>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex items-center gap-2">
              {loadingApplication && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
              )}
              {effectiveStatus === 'PENDING' && (
                <>
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Under review</span>
                </>
              )}
              {showApprovedState && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Approved</span>
                </>
              )}
              {effectiveStatus === 'REJECTED' && (
                <>
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">Rejected</span>
                </>
              )}
              {effectiveStatus === 'PENDING_ONCHAIN' && (
                <>
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-brand-yellow" aria-hidden />
                  <span className="text-sm font-medium text-brand-yellow">On-chain approval pending</span>
                </>
              )}
            </div>
          </div>

          {showApprovedState && (
            <>
              <p className="text-sm text-green-400">You are now a verifier.</p>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Review fairly using photo evidence.</li>
                <li>• Check that reports match the photos.</li>
                <li>• Approve only valid cleanups; reject suspicious ones.</li>
                <li>• Do not review your own submissions.</li>
                <li>• The team may audit decisions and penalize misuse.</li>
              </ul>
            </>
          )}
          {effectiveStatus === 'REJECTED' && latestApp.notes && (
            <p className="text-sm text-red-400">Reason: {latestApp.notes}</p>
          )}
          {effectiveStatus === 'PENDING' && (
            <p className="text-sm text-muted-foreground">
              Your application was received. An admin will review it; this page updates automatically.
            </p>
          )}
          {effectiveStatus === 'PENDING_ONCHAIN' && (
            <p className="text-sm text-muted-foreground">
              Waiting for the admin approval transaction to confirm on-chain…
            </p>
          )}
        </div>
      </div>
    )
  }

  const metrics = eligibility?.metrics
  const levelProgress = metrics ? Math.min((metrics.level / minLevel) * 100, 100) : 0
  const dcuProgress = metrics ? Math.min((metrics.dcuBalance / minDCUBalance) * 100, 100) : 0
  const cleanupProgress = metrics
    ? Math.min((metrics.approvedCleanups / minApprovedCleanups) * 100, 100)
    : 0
  if (!eligibility?.eligible) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <SectionHeading icon={Shield}>BECOME A VERIFIER</SectionHeading>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="mb-1.5 text-[10px] font-bebas uppercase tracking-wider text-muted-foreground">Level</p>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div className="h-2 rounded bg-brand-green transition-all" style={{ width: `${levelProgress}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs text-foreground">
              {metrics?.level ?? 0} / {minLevel}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="mb-1.5 text-[10px] font-bebas uppercase tracking-wider text-muted-foreground">DCU</p>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div className="h-2 rounded bg-brand-green transition-all" style={{ width: `${dcuProgress}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs text-foreground">
              {(metrics?.dcuBalance ?? 0).toFixed(0)} / {minDCUBalance}
            </p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/50 p-3">
            <p className="mb-1.5 text-[10px] font-bebas uppercase tracking-wider text-muted-foreground">Cleanups</p>
            <div className="h-2 overflow-hidden rounded bg-muted">
              <div className="h-2 rounded bg-brand-green transition-all" style={{ width: `${cleanupProgress}%` }} />
            </div>
            <p className="mt-2 font-mono text-xs text-foreground">
              {metrics?.approvedCleanups ?? 0} / {minApprovedCleanups}
            </p>
          </div>
        </div>

        <Button
          onClick={handleApply}
          disabled
          className="mt-4 w-full bg-brand-green/60 text-black font-semibold disabled:opacity-60"
        >
          Apply to Be a Verifier
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">Complete the above to unlock.</p>
        {applyError && <p className="text-sm text-red-400 mt-3 break-words">{applyError}</p>}
      </div>
    )
  }

  return (
    <div className="min-w-0 rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 sm:p-6">
      <SectionHeading icon={Shield}>BECOME A VERIFIER</SectionHeading>

      <div className="mb-4 min-w-0 space-y-3">
        <div className="break-words text-sm text-foreground">
          <p className="mb-2 font-medium">You meet all requirements:</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              ✓ Impact Product level: {eligibility?.metrics.level} / {minLevel}
            </li>
            <li>✓ DCU: {eligibility?.metrics.dcuBalance.toFixed(2)} / {minDCUBalance}</li>
            <li>
              ✓ Approved cleanups: {eligibility?.metrics.approvedCleanups} / {minApprovedCleanups}
            </li>
          </ul>
        </div>
      </div>

      <Button
        onClick={handleApply}
        disabled={isApplying || !!latestApp}
        className="w-full bg-brand-green text-black hover:bg-brand-green/90 font-semibold"
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting…
          </>
        ) : (
          'Apply to Be a Verifier'
        )}
      </Button>

      {applyError && <p className="text-sm text-red-400 mt-3 break-words">{applyError}</p>}

      <p className="text-xs text-muted-foreground mt-3 break-words">
        Application will be reviewed by admins
      </p>
    </div>
  )
}
