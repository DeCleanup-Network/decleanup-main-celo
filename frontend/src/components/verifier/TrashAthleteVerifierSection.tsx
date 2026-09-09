'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ExternalLink, Loader2, Trophy } from 'lucide-react'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { buildTrashAthleteReviewMessage } from '@/lib/trash-athlete/review-signing'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'

type Props = {
  challenges: TrashAthleteChallenge[]
  reviewerAddress: Address
  signMessage: (message: string) => Promise<`0x${string}`>
  onChanged: () => void
  onNotify?: (params: { variant: 'success' | 'error'; title: string; message: string }) => void
}

function shortAddr(addr: string) {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function TrashAthleteVerifierSection({
  challenges,
  reviewerAddress,
  signMessage,
  onChanged,
  onNotify,
}: Props) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<TrashAthleteChallenge[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await fetch(
        `/api/trash-athlete/challenges?status=APPROVED&reviewer=${encodeURIComponent(reviewerAddress)}`,
        { cache: 'no-store' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load history')
      setHistory(Array.isArray(data.challenges) ? data.challenges : [])
    } catch (e) {
      setHistoryError(e instanceof Error ? e.message : 'Failed to load history')
      setHistory(null)
    } finally {
      setHistoryLoading(false)
    }
  }, [reviewerAddress])

  useEffect(() => {
    if (!historyOpen) return
    void loadHistory()
  }, [historyOpen, loadHistory])

  async function review(challengeId: string, action: 'approve' | 'reject') {
    setProcessingId(challengeId)
    try {
      const timestamp = Date.now()
      const message = buildTrashAthleteReviewMessage({
        action,
        challengeId,
        reviewer: reviewerAddress,
        timestamp,
      })
      const signature = await signMessage(message)
      const res = await fetch('/api/trash-athlete/challenges/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          action,
          reviewer: reviewerAddress,
          timestamp,
          signature,
          reason: action === 'reject' ? 'Social photos not verified' : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Review failed')
      onNotify?.({
        variant: 'success',
        title: action === 'approve' ? 'Challenge approved' : 'Challenge rejected',
        message:
          action === 'approve'
            ? typeof data.rewardsNote === 'string' && data.rewardsNote
              ? data.rewardsNote
              : `Approved. Ops will send ${TRASH_ATHLETE_BONUS_CDCU} $cDCU + level ${TRASH_ATHLETE_TARGET_LEVEL} + ${TRASH_ATHLETE_DCU_POINTS} DCU.`
            : 'Rejected.',
      })
      onChanged()
      if (historyOpen) void loadHistory()
    } catch (e) {
      onNotify?.({
        variant: 'error',
        title: 'Review failed',
        message: e instanceof Error ? e.message : 'Review failed',
      })
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="mb-8">
      <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
        Trash Athlete Challenges
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Open the social link and confirm cleanup photos before approving. Reward: level{' '}
        {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_DCU_POINTS} DCU + {TRASH_ATHLETE_BONUS_CDCU} $cDCU.
      </p>
      {challenges.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No pending Trash Athlete Challenges.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {challenges.map((c) => (
            <div key={c.id} className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="bg-gray-900 p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 font-heading text-lg text-foreground">
                    <Trophy className="h-4 w-4 text-brand-green" />
                    TRASH ATHLETE
                  </span>
                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">
                    Pending
                  </span>
                </div>
                <p className="font-mono text-xs text-gray-400">ID: {c.id}</p>
              </div>
              <div className="space-y-3 p-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400">Username</p>
                  <p className="text-foreground">@{c.username}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Signer address</p>
                  <p className="break-all font-mono text-xs text-gray-300">{c.walletAddress}</p>
                </div>
                {c.email ? (
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="text-foreground">{c.email}</p>
                  </div>
                ) : null}
                <div>
                  <p className="mb-1 text-xs text-gray-400">Social link</p>
                  <a
                    href={c.socialProfileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 break-all text-brand-green hover:underline"
                  >
                    Open post / profile <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </a>
                </div>
                {c.notes ? (
                  <div>
                    <p className="text-xs text-gray-400">Notes</p>
                    <p className="whitespace-pre-wrap text-muted-foreground">{c.notes}</p>
                  </div>
                ) : null}
                <p className="text-xs text-gray-400">
                  Submitted: {new Date(c.submittedAt).toLocaleString()}
                </p>
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => void review(c.id, 'reject')}
                    disabled={processingId === c.id}
                    className="flex-1 bg-red-600 text-white hover:bg-red-700"
                    size="sm"
                  >
                    {processingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                  </Button>
                  <Button
                    onClick={() => void review(c.id, 'approve')}
                    disabled={processingId === c.id}
                    className="flex-1 bg-green-600 text-white hover:bg-green-700"
                    size="sm"
                  >
                    {processingId === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  After approve, ops sends {TRASH_ATHLETE_BONUS_CDCU} $cDCU + level{' '}
                  {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_DCU_POINTS} DCU to the signer
                  address from the Safe.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40"
        >
          <span className="font-heading text-sm uppercase tracking-wide text-foreground">
            Verified Trash Athlete history
            {history && historyOpen ? (
              <span className="ml-2 font-sans text-xs font-normal normal-case tracking-normal text-muted-foreground">
                ({history.length})
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
              historyOpen ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        </button>

        {historyOpen ? (
          <div className="border-t border-border px-4 py-4">
            {historyLoading && !history ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading verified submissions…
              </div>
            ) : historyError ? (
              <div className="space-y-2 text-sm">
                <p className="text-red-400">{historyError}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => void loadHistory()}>
                  Retry
                </Button>
              </div>
            ) : !history || history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No verified Trash Athlete submissions yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((c) => (
                  <li key={c.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">@{c.username}</span>
                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-500">
                          Verified
                        </span>
                        {c.bonusCdcuClaimed ? (
                          <span className="rounded-full bg-brand-green/15 px-2 py-0.5 text-xs text-brand-green">
                            $cDCU sent
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-500">
                            $cDCU pending
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {shortAddr(c.walletAddress)}
                        {c.email ? ` · ${c.email}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Verified{' '}
                        {c.reviewedAt
                          ? new Date(c.reviewedAt).toLocaleString()
                          : new Date(c.submittedAt).toLocaleString()}
                        {c.reviewedBy ? ` · by ${shortAddr(c.reviewedBy)}` : ''}
                      </p>
                    </div>
                    <a
                      href={c.socialProfileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 text-sm text-brand-green hover:underline"
                    >
                      Social <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
