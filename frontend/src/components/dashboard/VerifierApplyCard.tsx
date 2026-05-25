/**
 * VerifierApplyCard Component
 */

'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useVerifierEligibility } from '@/hooks/useVerifierEligibility'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useVerifierAccess } from '@/hooks/useVerifierAccess'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { VERIFIER_CONFIG } from '@/config/verifier'
import { Shield, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { AlertModal } from '@/components/ui/alert-modal'
const { minLevel, minDCUBalance, minApprovedCleanups } = VERIFIER_CONFIG.requirements

const TELEGRAM_APPEAL_URL = 'https://t.me/decentralizedcleanup'

export function VerifierApplyCard() {
  const { isConnected: hasWallet } = useAppWalletAddress()
  const { submissionOwnerAddress } = useSmartAccountClient()
  const applicantAddress = submissionOwnerAddress
  const {
    latestApp,
    loading: loadingApplication,
    applicationApproved,
    onChainRoleWithoutApplication,
    refreshApplication,
  } = useVerifierAccess()
  const { eligibility, isLoading, error } = useVerifierEligibility()
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [verifierOutcomeModal, setVerifierOutcomeModal] = useState<'promoted' | 'rejected' | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !applicantAddress) return
    const current = applicantAddress.toLowerCase()
    try {
      const last = localStorage.getItem('decleanup_last_verifier_applicant')?.trim().toLowerCase()
      if (last && last !== current) {
        localStorage.removeItem('decleanup_last_verifier_applicant')
      }
    } catch {
      /* ignore */
    }
  }, [applicantAddress])

  useEffect(() => {
    if (!latestApp?.status) return
    if (latestApp.status !== 'PENDING' && latestApp.status !== 'PENDING_ONCHAIN') return
    const tick = () => {
      void refreshApplication()
    }
    const id = window.setInterval(tick, 5_000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [latestApp?.id, latestApp?.status, refreshApplication])

  useEffect(() => {
    if (!applicantAddress || loadingApplication) return
    if (!latestApp?.id || latestApp.address.toLowerCase() !== applicantAddress.toLowerCase()) return
    if (latestApp.status !== 'REJECTED') return
    const addr = applicantAddress.toLowerCase()
    const key = `decleanup_verifier_rejected_dismissed_v1_${addr}_${latestApp.id}`
    try {
      if (localStorage.getItem(key) === '1') return
    } catch {
      return
    }
    setVerifierOutcomeModal((m) => (m ? m : 'rejected'))
  }, [applicantAddress, loadingApplication, latestApp?.id, latestApp?.status, latestApp?.address])

  useEffect(() => {
    if (!applicantAddress || loadingApplication) return
    if (!applicationApproved || !latestApp?.id) return
    if (latestApp.address.toLowerCase() !== applicantAddress.toLowerCase()) return

    const addr = applicantAddress.toLowerCase()
    const key = `decleanup_verifier_promoted_dismissed_v1_${addr}_${latestApp.id}`
    try {
      if (localStorage.getItem(key) === '1') return
    } catch {
      return
    }

    setVerifierOutcomeModal((m) => (m ? m : 'promoted'))
  }, [
    applicantAddress,
    applicationApproved,
    loadingApplication,
    latestApp?.id,
    latestApp?.address,
  ])

  const dismissVerifierOutcomeModal = () => {
    if (!applicantAddress) {
      setVerifierOutcomeModal(null)
      return
    }
    const addr = applicantAddress.toLowerCase()
    try {
      if (verifierOutcomeModal === 'rejected' && latestApp?.id) {
        localStorage.setItem(`decleanup_verifier_rejected_dismissed_v1_${addr}_${latestApp.id}`, '1')
      }
      if (verifierOutcomeModal === 'promoted' && latestApp?.id) {
        localStorage.setItem(`decleanup_verifier_promoted_dismissed_v1_${addr}_${latestApp.id}`, '1')
      }
    } catch {
      /* ignore */
    }
    setVerifierOutcomeModal(null)
    void refreshApplication()
  }

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
          [data?.error, data?.hint, data?.detail].filter(Boolean).join(' | ') ||
          'Failed to submit application'
        if (response.status === 409 && /pending application/i.test(errorMessage)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('decleanup_last_verifier_applicant', applicantAddress.toLowerCase())
          }
          await refreshApplication()
          setApplyError(null)
          return
        }
        throw new Error(errorMessage)
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('decleanup_last_verifier_applicant', applicantAddress.toLowerCase())
      }
      await refreshApplication()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsApplying(false)
    }
  }

  if (!hasWallet || !applicantAddress) return null

  const outcomeModal = verifierOutcomeModal ? (
    <AlertModal
      isOpen
      onClose={dismissVerifierOutcomeModal}
      closeOnBackdropClick={false}
      variant={verifierOutcomeModal === 'promoted' ? 'success' : 'info'}
      title={
        verifierOutcomeModal === 'promoted'
          ? 'Congratulations'
          : 'Verifier application update'
      }
      message={
        verifierOutcomeModal === 'promoted' ? (
          <p className="text-sm text-muted-foreground">
            You have been promoted to verifier. Open the Verifier cabinet from the home page when you are ready to review
            submissions.
          </p>
        ) : (
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Sorry, your verifier application was rejected as we found your statistics don&apos;t make you eligible quite
              yet.
            </p>
            <p>
              If you would like to appeal, send your request on Telegram:{' '}
              <a
                href={TELEGRAM_APPEAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand-green underline underline-offset-2"
              >
                {TELEGRAM_APPEAL_URL}
              </a>
            </p>
          </div>
        )
      }
    />
  ) : null

  if (isLoading) {
    return (
      <>
        {outcomeModal}
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionHeading
            icon={Shield}
            aside={<Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-yellow" aria-hidden />}
          >
            BECOME A VERIFIER
          </SectionHeading>
          <p className="text-sm text-muted-foreground">Loading eligibility...</p>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        {outcomeModal}
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionHeading icon={Shield}>BECOME A VERIFIER</SectionHeading>
          <p className="text-sm text-red-400">{error}</p>
        </div>
      </>
    )
  }

  if (loadingApplication && !latestApp) {
    return (
      <>
        {outcomeModal}
        <div className="rounded-2xl border border-border bg-card p-6">
          <SectionHeading icon={Shield}>VERIFIER APPLICATION</SectionHeading>
          <p className="text-sm text-muted-foreground">Loading application status...</p>
        </div>
      </>
    )
  }

  if (latestApp) {
    const showApprovedState = latestApp.status === 'APPROVED'
    const effectiveStatus = showApprovedState ? 'APPROVED' : latestApp.status
    return (
      <>
        {outcomeModal}
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

            {onChainRoleWithoutApplication && (
              <p className="text-xs text-amber-300/90">
                This wallet has an on-chain verifier role from testing, but no approved application on file.
                Verifier tools stay hidden until an application is approved.
              </p>
            )}

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
            {effectiveStatus === 'REJECTED' && (
              <div className="space-y-3 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground">
                  You can submit a new application if you still meet the requirements.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-brand-green text-black hover:bg-brand-green/90 font-semibold"
                    disabled={isApplying || !eligibility?.eligible}
                    onClick={() => void handleApply()}
                  >
                    {isApplying ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        Submitting…
                      </>
                    ) : (
                      'Apply again'
                    )}
                  </Button>
                </div>
                {!eligibility?.eligible && (
                  <p className="text-xs text-muted-foreground">Apply again unlocks when eligibility requirements are met.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </>
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
      <>
        {outcomeModal}
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
      </>
    )
  }

  return (
    <>
      {outcomeModal}
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
    </>
  )
}
