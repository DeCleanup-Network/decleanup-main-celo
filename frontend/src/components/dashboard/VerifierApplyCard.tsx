/**
 * VerifierApplyCard Component
 */

'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { useVerifierEligibility } from '@/hooks/useVerifierEligibility'
import { getLatestApplicationByAddress } from '@/lib/verifier/applications'
import { Shield, AlertCircle, CheckCircle, Clock, XCircle, Loader2 } from 'lucide-react'

export function VerifierApplyCard() {
  const { address } = useAccount()
  const { eligibility, isLoading, error } = useVerifierEligibility()
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  if (!address) return null

  const latestApp = getLatestApplicationByAddress(address)

  const handleApply = async () => {
    if (!eligibility?.eligible || !address) return
    setIsApplying(true)
    setApplyError(null)

    try {
      const response = await fetch('/api/verifier/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, metrics: eligibility.metrics }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit application')
      }

      window.location.reload()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsApplying(false)
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-foreground">Verifier Status</h3>
          </div>
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading eligibility...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-foreground">Verifier Status</h3>
        </div>
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  if (latestApp) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold text-foreground">Verifier Application</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex items-center gap-2">
              {latestApp.status === 'PENDING' && (
                <>
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Pending Review</span>
                </>
              )}
              {latestApp.status === 'APPROVED' && (
                <>
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-medium text-green-400">Approved</span>
                </>
              )}
              {latestApp.status === 'REJECTED' && (
                <>
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm font-medium text-red-400">Rejected</span>
                </>
              )}
            </div>
          </div>

          {latestApp.status === 'APPROVED' && (
            <p className="text-sm text-green-400">✅ You are now a verifier!</p>
          )}
          {latestApp.status === 'REJECTED' && latestApp.notes && (
            <p className="text-sm text-red-400">Reason: {latestApp.notes}</p>
          )}
          {latestApp.status === 'PENDING' && (
            <p className="text-sm text-muted-foreground">Under review...</p>
          )}
        </div>
      </div>
    )
  }

  if (!eligibility?.eligible) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertCircle className="w-5 h-5 text-orange-400" />
          <h3 className="font-semibold text-foreground">Verifier Requirements</h3>
        </div>

        {eligibility?.reasons && (
          <div className="space-y-2 text-sm text-muted-foreground">
            {eligibility.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-orange-400 mt-0.5">•</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4">
          Meet all requirements to apply
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-brand-green/30 bg-brand-green/5 p-4 sm:p-6 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle className="w-5 h-5 text-brand-green shrink-0" />
        <h3 className="font-semibold text-foreground break-words">Ready to Be a Verifier?</h3>
      </div>

      <div className="space-y-3 mb-4 min-w-0">
        <div className="text-sm text-foreground break-words">
          <p className="font-medium mb-2">You meet all requirements:</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>✓ Level: {eligibility?.metrics.level}</li>
            <li>✓ DCU Balance: {eligibility?.metrics.dcuBalance.toFixed(2)}</li>
            <li>✓ Approved Cleanups: {eligibility?.metrics.approvedCleanups}</li>
          </ul>
        </div>
      </div>

      <Button
        onClick={handleApply}
        disabled={isApplying}
        className="w-full bg-brand-green text-black hover:bg-brand-green/90 font-semibold"
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting...
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
