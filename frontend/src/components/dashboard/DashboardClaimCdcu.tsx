'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, HelpCircle, ExternalLink, Copy } from 'lucide-react'
import { CONTRACT_ADDRESSES, REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/blockchain/chain-constants'
import { GOVERNANCE_MIN_CDCU } from '@/config/cdcu'
import { claimCdcu } from '@/lib/blockchain/claim-vault'
import { formatEther } from 'viem'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'

const ELIGIBILITY_THRESHOLD = 50

interface EligibilityData {
  eligible: boolean
  totalPoints: string
  claimableCap: string
  claimableNextTranche?: string
  alreadyClaimed: string
  claimableNow: string
  thresholdPoints: string
  milestonesClaimed?: number
  nextMilestonePoints?: string
  dcuPointsPerTranche?: number
  /** e.g. "1.1" — from Reward Manager total DCU; each mint uses one 50-DCU slice under this multiplier curve */
  activityMultiplier?: string | null
}

/** Format wei as integer for display */
function weiToNum(wei: string) {
  return Number(formatEther(BigInt(wei)))
}

function fmtCdcuAmount(n: number) {
  if (!Number.isFinite(n)) return '0'
  return Math.abs(n - Math.round(n)) > 1e-4 ? n.toFixed(1) : n.toFixed(0)
}

function optimisticLockAfterClaim(prev: EligibilityData | null, claimedAmountWei: bigint): EligibilityData | null {
  if (!prev) return prev
  const milestoneStepWei = 50n * 10n ** 18n
  const totalPointsWei = BigInt(prev.totalPoints || '0')
  const prevMilestones = prev.milestonesClaimed ?? 0
  const currentNextMilestoneWei = BigInt(prev.nextMilestonePoints || '0')
  const nextMilestoneWei =
    currentNextMilestoneWei > 0n
      ? currentNextMilestoneWei + milestoneStepWei
      : BigInt(prevMilestones + 2) * milestoneStepWei
  const claimedNow = BigInt(prev.alreadyClaimed || '0') + claimedAmountWei

  return {
    ...prev,
    eligible: totalPointsWei >= nextMilestoneWei,
    alreadyClaimed: claimedNow.toString(),
    claimableNow: '0',
    claimableNextTranche: '0',
    milestonesClaimed: prevMilestones + 1,
    nextMilestonePoints: nextMilestoneWei.toString(),
  }
}

interface DashboardClaimCdcuProps {
  /** Address used for eligibility + milestone/pending accounting (current reward identity). */
  rewardAddress: string
  /** Address that should receive minted cDCU (social EOA). */
  payoutAddress: string
}

/**
 * $cDCU: each claim unlocks one 50-DCU tranche; the next claim needs 50 more DCU (next milestone).
 */
const TOKENOMICS_URL = 'https://decleanup.net/tokenomics'

export function DashboardClaimCdcu({ rewardAddress, payoutAddress }: DashboardClaimCdcuProps) {
  const { client: gaslessClient, expectsSponsoredGas } = useSmartAccountClient()
  const { isConnected: wagmiConnected } = useAccount()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [lastTxHash, setLastTxHash] = useState<`0x${string}` | null>(null)
  const [eligibility, setEligibility] = useState<EligibilityData | null>(null)
  const [eligibilityLoading, setEligibilityLoading] = useState(true)
  const [showCdcuInfoModal, setShowCdcuInfoModal] = useState(false)
  const [copyMsg, setCopyMsg] = useState<string | null>(null)
  const [lockedClaimHint, setLockedClaimHint] = useState(false)

  const claimVaultAddress = CONTRACT_ADDRESSES.CLAIMVAULT
  const cdcuTokenAddress = CONTRACT_ADDRESSES.DCU_TOKEN?.trim() ?? ''
  const cdcuExplorerUrl =
    cdcuTokenAddress && /^0x[a-fA-F0-9]{40}$/.test(cdcuTokenAddress)
      ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${cdcuTokenAddress}`
      : null

  const copyContractAddress = useCallback(async () => {
    if (!cdcuTokenAddress) return
    try {
      await navigator.clipboard.writeText(cdcuTokenAddress)
      setCopyMsg('Address copied')
      window.setTimeout(() => setCopyMsg(null), 2000)
    } catch {
      setCopyMsg('Select and copy the address below manually.')
      window.setTimeout(() => setCopyMsg(null), 4000)
    }
  }, [cdcuTokenAddress])

  useEffect(() => {
    let cancelled = false
    async function fetchEligibility() {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), 45_000)
      try {
        const q = new URLSearchParams({
          recipient: rewardAddress,
          mintRecipient: payoutAddress,
        })
        const res = await fetch(`/api/cdcu/eligibility?${q.toString()}`, {
          signal: controller.signal,
        })
        const data = (await res.json().catch(() => ({}))) as EligibilityData & { error?: string }
        if (!cancelled) {
          if (res.ok) {
            setEligibility(data)
            setError(null)
          } else {
            setEligibility(null)
            setError(
              typeof data.error === 'string' && data.error
                ? data.error
                : 'Eligibility check failed. Tap below to retry or refresh the page.'
            )
          }
        }
      } catch (e) {
        if (!cancelled) {
          setEligibility(null)
          if (e instanceof Error && e.name === 'AbortError') {
            setError('Eligibility check timed out. Tap below to retry or refresh the page.')
          } else {
            setError('Could not reach eligibility service. Check your connection and retry.')
          }
        }
      } finally {
        window.clearTimeout(timeout)
        if (!cancelled) setEligibilityLoading(false)
      }
    }
    fetchEligibility()
    return () => {
      cancelled = true
    }
  }, [rewardAddress, payoutAddress, success])

  useEffect(() => {
    if (!lockedClaimHint) return
    const id = window.setTimeout(() => setLockedClaimHint(false), 5000)
    return () => window.clearTimeout(id)
  }, [lockedClaimHint])

  if (!claimVaultAddress) return null

  const handleClaim = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setLastTxHash(null)
    try {
      const res = await fetch('/api/cdcu/claim-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: payoutAddress, source: rewardAddress }),
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
      const { hash } = await claimCdcu(signed, {
        gaslessClient:
          expectsSponsoredGas && gaslessClient
            ? (gaslessClient as {
                sendTransaction: (params: {
                  to: `0x${string}`
                  value?: bigint
                  data?: `0x${string}`
                }) => Promise<`0x${string}`>
              })
            : undefined,
        claimerAddress: payoutAddress as `0x${string}`,
        preferConnectedWallet: !expectsSponsoredGas && wagmiConnected,
      })
      const recordIssuedResponse = await fetch('/api/cdcu/record-issued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: rewardAddress, amount: data.amount }),
      })
      if (!recordIssuedResponse.ok) {
        console.warn('[DashboardClaimCdcu] Failed to persist issued claim on server.', await recordIssuedResponse.text().catch(() => ''))
      }
      const amountNum = Number(data.amount) / 1e18
      const amountFormatted =
        amountNum >= 100 || Number.isInteger(amountNum) ? amountNum.toFixed(0) : amountNum.toFixed(1)
      setSuccess(`Claimed ${amountFormatted} $cDCU`)
      setLastTxHash(hash)
      setEligibility((prev) => optimisticLockAfterClaim(prev, BigInt(data.amount)))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const isUserCancel =
        /user rejected|user denied|rejected the request|denied transaction|rejected transaction/i.test(msg) ||
        (e as { code?: number })?.code === 4001
      if (isUserCancel) {
        await fetch('/api/cdcu/clear-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: rewardAddress }),
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
  const dcuStep = eligibility?.dcuPointsPerTranche ?? ELIGIBILITY_THRESHOLD
  const multDisplay =
    eligibility?.activityMultiplier != null && eligibility.activityMultiplier !== ''
      ? Number(eligibility.activityMultiplier).toFixed(2)
      : null
  const mc = eligibility?.milestonesClaimed ?? 0
  const segmentStart = mc * ELIGIBILITY_THRESHOLD
  const segmentEnd = (mc + 1) * ELIGIBILITY_THRESHOLD
  const progress =
    segmentEnd > segmentStart
      ? Math.min(100, Math.max(0, ((pointsNum - segmentStart) / (segmentEnd - segmentStart)) * 100))
      : 0

  const lockedClaimHintText = `unlocked with every ${dcuStep} collected DCU points`

  return (
    <>
    <div className="w-full min-w-0 max-w-full rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
      <div className="mb-2 flex items-center gap-1">
        <span className="text-xs font-sans font-semibold tracking-wide text-muted-foreground">Claim $cDCU</span>
        <button
          type="button"
          onClick={() => setShowCdcuInfoModal(true)}
          className="inline-flex rounded p-0.5 text-muted-foreground transition-colors hover:bg-brand-green/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50"
          aria-label="About $cDCU, governance, tokenomics, and wallet import"
        >
          <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </button>
      </div>

      {eligibilityLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Checking eligibility…
        </div>
      ) : eligibility ? (
        <>
          <div className="mb-3">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2 text-xs mb-1">
              <span className="text-muted-foreground">DCU points</span>
              <span
                className={`shrink-0 ${eligibility.eligible ? 'text-brand-green font-medium' : 'text-muted-foreground'}`}
              >
                {pointsNum.toFixed(0)} / {segmentEnd}
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
              {multDisplay != null ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  Multiplier of <span className="font-medium text-brand-green">{multDisplay}x</span> will be applied
                </p>
              ) : null}
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
              <Button
                type="button"
                size="sm"
                variant="outline"
                title={lockedClaimHintText}
                aria-disabled="true"
                className="h-auto min-h-[2.75rem] w-full cursor-not-allowed border-muted px-3 py-2.5 text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                onClick={() => setLockedClaimHint(true)}
              >
                <span className="inline-flex w-full min-w-0 items-center justify-center text-center leading-snug">
                  Claim $cDCU
                </span>
              </Button>
              {lockedClaimHint ? (
                <p className="mt-2 text-center text-xs text-muted-foreground" role="status">
                  {lockedClaimHintText}
                </p>
              ) : null}
            </>
          )}
        </>
      ) : (
        <p className="text-xs text-muted-foreground mb-2">Eligibility unavailable. Complete cleanups and impact reports to earn DCU points.</p>
      )}

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      {success && <p className="mt-2 text-xs text-brand-green">{success}</p>}
      {success && lastTxHash ? (
        <p className="mt-1 text-xs text-muted-foreground">
          <a
            href={`${REQUIRED_BLOCK_EXPLORER_URL}/tx/${lastTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
          >
            View transaction →
          </a>
        </p>
      ) : null}
    </div>

    {showCdcuInfoModal ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
        <div
          className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cdcu-info-title"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 id="cdcu-info-title" className="font-bebas text-2xl tracking-wider text-foreground">
              About $cDCU
            </h2>
            <button
              type="button"
              onClick={() => setShowCdcuInfoModal(false)}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 text-sm text-muted-foreground">
            <p>
              <strong className="text-foreground">What is $cDCU?</strong> $cDCU is an ERC-20 on this network. You receive
              it by converting earned DCU points: when you reach a claim slice, you request a signed mint from the Claim
              Vault and confirm in your wallet.
            </p>
            <p>
              <strong className="text-foreground">What can you do with it?</strong> Hold or send $cDCU like any token. You
              can also vote and create governance proposals when your balance meets the snapshot rule (currently at least{' '}
              <strong className="text-foreground">{GOVERNANCE_MIN_CDCU} $cDCU</strong>). Allocations, pools, and mechanics
              are explained on the tokenomics page.
            </p>
            <p>
              <a
                href={TOKENOMICS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-brand-green underline-offset-4 hover:underline"
              >
                Tokenomics &amp; governance details
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </a>
            </p>

            {cdcuExplorerUrl ? (
              <p>
                <a
                  href={cdcuExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-medium text-brand-green underline-offset-4 hover:underline"
                >
                  View $cDCU contract on the explorer
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </a>
              </p>
            ) : (
              <p className="text-xs">
                Explorer link is unavailable until <code className="rounded bg-muted px-1 py-0.5 text-foreground">NEXT_PUBLIC_DCU_TOKEN_CONTRACT</code>{' '}
                is set for this deployment.
              </p>
            )}

            <div className="rounded-lg border border-border bg-background/80 p-4">
              <h3 className="mb-2 font-bebas text-lg tracking-wide text-foreground">Import $cDCU in your wallet</h3>
              <ol className="list-decimal space-y-2 pl-4 text-xs sm:text-sm">
                <li>Open your wallet’s “Import token” / “Add token” flow.</li>
                <li>
                  Paste the token contract address (same as on the explorer). Symbol:{' '}
                  <strong className="text-foreground">cDCU</strong>, decimals:{' '}
                  <strong className="text-foreground">18</strong>.
                </li>
                <li>Confirm; your balance should appear after you mint or receive $cDCU.</li>
              </ol>
              {cdcuTokenAddress && /^0x[a-fA-F0-9]{40}$/.test(cdcuTokenAddress) ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <code className="block max-w-full break-all rounded border border-border bg-muted/40 px-2 py-1.5 text-[11px] text-foreground">
                    {cdcuTokenAddress}
                  </code>
                  <Button type="button" size="sm" variant="outline" onClick={() => void copyContractAddress()} className="shrink-0 gap-1.5">
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copy address
                  </Button>
                </div>
              ) : null}
              {copyMsg ? <p className="mt-2 text-xs text-brand-green">{copyMsg}</p> : null}
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setShowCdcuInfoModal(false)}
            className="mt-6 w-full bg-brand-green font-semibold uppercase text-black hover:bg-brand-green/90"
          >
            Got it
          </Button>
        </div>
      </div>
    ) : null}
    </>
  )
}
