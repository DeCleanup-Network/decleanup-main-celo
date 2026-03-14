'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, Coins, CheckCircle, Lock } from 'lucide-react'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
import { claimCdcu } from '@/lib/blockchain/claim-vault'
import { formatEther } from 'viem'

const ELIGIBILITY_THRESHOLD = 50

interface EligibilityData {
  eligible: boolean
  totalPoints: string
  claimableCap: string
  alreadyClaimed: string
  claimableNow: string
  thresholdPoints: string
}

/** Format wei as integer for display */
function weiToNum(wei: string) {
  return Number(formatEther(BigInt(wei)))
}

interface DashboardClaimCdcuProps {
  address: string
}

/**
 * $cDCU claim: eligibility at 50 DCU points; claimable = (points - 50) × 0.1 × progressive multiplier (1.1x–2x).
 * Shows progress to 50, claimable amount, and Claim button when eligible.
 */
export function DashboardClaimCdcu({ address }: DashboardClaimCdcuProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(true)

  const claimVaultAddress = CONTRACT_ADDRESSES.CLAIMVAULT
  if (!claimVaultAddress) return null

  useEffect(() => {
    let cancelled = false
    async function fetchEligibility() {
      try {
        const res = await fetch(`/api/cdcu/eligibility?recipient=${encodeURIComponent(address)}`)
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) setEligibility(data)
      } catch {
        if (!cancelled) setEligibility(null)
      } finally {
        if (!cancelled) setEligibilityLoading(false)
      }
    }
    fetchEligibility()
    return () => { cancelled = true }
  }, [address, success])

  const handleClaim = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/cdcu/claim-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: address }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || `Request failed (${res.status})`)
        return
      }
      const signed = {
        recipient: data.recipient as `0x${string}`,
        amount: data.amount,
        category: data.category,
        nonce: data.nonce,
        expiry: data.expiry,
        v: data.v,
        r: data.r as `0x${string}`,
        s: data.s as `0x${string}`,
      }
      const { hash } = await claimCdcu(signed)
      await fetch('/api/cdcu/record-issued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: address, amount: data.amount }),
      })
      const amountFormatted = (Number(data.amount) / 1e18).toFixed(0)
      setSuccess(`Claimed ${amountFormatted} DCU. Tx: ${hash.slice(0, 10)}...`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isUserCancel =
        /user rejected|user denied|rejected the request|denied transaction|rejected transaction/i.test(msg) ||
        (e as { code?: number })?.code === 4001
      if (isUserCancel) {
        await fetch('/api/cdcu/clear-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: address }),
        }).catch(() => {})
        setError('You cancelled the request.')
      } else {
        setError(msg || 'Claim failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const pointsNum = eligibility ? weiToNum(eligibility.totalPoints) : 0
  const claimableCapNum = eligibility ? weiToNum(eligibility.claimableCap) : 0
  const claimableNum = eligibility ? weiToNum(eligibility.claimableNow) : 0
  const progress = Math.min(100, (pointsNum / ELIGIBILITY_THRESHOLD) * 100)

  return (
    <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-sans font-semibold text-muted-foreground tracking-wide">Claim $cDCU</span>
        <Coins className="h-4 w-4 text-brand-green" />
      </div>

      {eligibilityLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking eligibility…
        </div>
      ) : eligibility ? (
        <>
          {/* Progress to 50 DCU points */}
          <div className="mb-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">DCU points (need {ELIGIBILITY_THRESHOLD} to unlock)</span>
              <span className={eligibility.eligible ? 'text-brand-green font-medium' : 'text-muted-foreground'}>
                {pointsNum.toFixed(0)} / {ELIGIBILITY_THRESHOLD}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${eligibility.eligible ? 'bg-brand-green' : 'bg-brand-green/50'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {eligibility.eligible ? (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Based on your DCU score you will receive <strong className="text-foreground">{claimableCapNum.toFixed(0)} $cDCU</strong>.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-brand-green/50 text-brand-green hover:bg-brand-green/10"
                onClick={handleClaim}
                disabled={loading || claimableNum <= 0}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Claiming…
                  </>
                ) : claimableNum > 0 ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Claim $cDCU
                  </>
                ) : (
                  'No claimable amount'
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Earn <strong className="text-foreground">{ELIGIBILITY_THRESHOLD - pointsNum} more</strong> DCU points to unlock $cDCU claims.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-muted text-muted-foreground cursor-not-allowed"
                disabled
              >
                <Lock className="h-4 w-4 mr-2" />
                Unlock at 50 points
              </Button>
            </>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground mb-2">Eligibility unavailable. Complete cleanups and impact reports to earn DCU points.</p>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-brand-green">{success}</p>}
    </div>
  )
}
