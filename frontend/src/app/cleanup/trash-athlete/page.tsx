'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2, Trophy, ExternalLink, CheckCircle2 } from 'lucide-react'
import { BackButton } from '@/components/layout/BackButton'
import { Button } from '@/components/ui/button'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_LABEL,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import { TrashAthleteBonusClaimCard } from '@/components/trash-athlete/TrashAthleteBonusClaimCard'

export default function TrashAthleteChallengePage() {
  const router = useRouter()
  const aaEnabled = isAaAuthEnabledClient()
  const { data: session, status: sessionStatus } = useSession()
  const { address, showMainApp, walletReady } = useAppWalletAddress()

  const [username, setUsername] = useState('')
  const [socialProfileUrl, setSocialProfileUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState<TrashAthleteChallenge[]>([])
  const [loadingMine, setLoadingMine] = useState(true)

  const signedIn = aaEnabled ? Boolean(session?.user) : showMainApp

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!signedIn) {
      setLoadingMine(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/trash-athlete/challenges?mine=1', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && Array.isArray(data.challenges)) {
          setMine(data.challenges)
        }
      } finally {
        if (!cancelled) setLoadingMine(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [signedIn, sessionStatus])

  const pending = mine.find((c) => c.status === 'PENDING')
  const approvedUnclaimed = mine.find((c) => c.status === 'APPROVED' && !c.bonusCdcuClaimed)
  const latest = mine[0]

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!address) {
      setError('Wallet not ready. Finish account setup first.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/trash-athlete/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          socialProfileUrl,
          notes,
          walletAddress: address,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Submit failed')
      }
      setMine((prev) => [data.challenge as TrashAthleteChallenge, ...prev])
      setUsername('')
      setSocialProfileUrl('')
      setNotes('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (sessionStatus === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <BackButton href="/cleanup" label="Back to submit cleanup" />
        <h1 className="mt-6 font-heading text-2xl uppercase tracking-wide text-foreground">
          {TRASH_ATHLETE_LABEL}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in with email, then submit your social post link. A verifier checks your photos on socials.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login?callbackUrl=/cleanup/trash-athlete">Sign in with email</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-16">
      <BackButton href="/cleanup" label="Back to submit cleanup" />

      <div className="mt-6 flex items-start gap-3">
        <Trophy className="mt-1 h-7 w-7 shrink-0 text-brand-green" aria-hidden />
        <div>
          <h1 className="font-heading text-2xl uppercase tracking-wide text-foreground">
            {TRASH_ATHLETE_LABEL}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Post your cleanup on socials, then share the link here. After a verifier confirms your photos,
            you unlock Impact Product level {TRASH_ATHLETE_TARGET_LEVEL}, {TRASH_ATHLETE_DCU_POINTS} DCU,
            plus {TRASH_ATHLETE_BONUS_CDCU} $cDCU bonus.
          </p>
        </div>
      </div>

      {loadingMine ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {approvedUnclaimed ? (
        <div className="mt-8">
          <TrashAthleteBonusClaimCard
            challenge={approvedUnclaimed}
            onClaimed={() => {
              setMine((prev) =>
                prev.map((c) =>
                  c.id === approvedUnclaimed.id ? { ...c, bonusCdcuClaimed: true } : c
                )
              )
            }}
          />
        </div>
      ) : null}

      {pending ? (
        <div className="mt-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Waiting for verification
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            @{pending.username} — verifier will open your social link and check the cleanup photos.
          </p>
          <a
            href={pending.socialProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-brand-green hover:underline"
          >
            Your submitted link <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      ) : null}

      {!pending && !approvedUnclaimed && latest?.status === 'APPROVED' && latest.bonusCdcuClaimed ? (
        <div className="mt-8 rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-brand-green">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Challenge approved
          </div>
          <p className="mt-2 text-muted-foreground">
            Bonus $cDCU claimed. Level {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_DCU_POINTS} DCU are
            granted by the team after social verification (onchain level cannot jump in one step yet).
          </p>
          <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
            Back to dashboard
          </Button>
        </div>
      ) : null}

      {!pending && !approvedUnclaimed && (!latest || latest.status === 'REJECTED') ? (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {!walletReady ? (
            <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Finish wallet setup (passcode / Face ID) so rewards can go to your account.
            </p>
          ) : null}

          <div>
            <label htmlFor="ta-username" className="mb-1.5 block text-sm font-medium text-foreground">
              Username
            </label>
            <input
              id="ta-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              maxLength={64}
              placeholder="How you want to be listed"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand-green/40 focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="ta-social" className="mb-1.5 block text-sm font-medium text-foreground">
              Link to social post or profile
            </label>
            <input
              id="ta-social"
              type="url"
              value={socialProfileUrl}
              onChange={(e) => setSocialProfileUrl(e.target.value)}
              required
              placeholder="https://…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand-green/40 focus:ring-2"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Instagram, TikTok, X, Facebook, etc. — where your cleanup photos are visible.
            </p>
          </div>

          <div>
            <label htmlFor="ta-notes" className="mb-1.5 block text-sm font-medium text-foreground">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="ta-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Location, event name, anything helpful for the verifier"
              className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none ring-brand-green/40 focus:ring-2"
            />
          </div>

          {error ? (
            <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={submitting || !walletReady} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit Trash Athlete Challenge'
            )}
          </Button>
        </form>
      ) : null}

      {latest?.status === 'REJECTED' && !pending ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Previous submission was rejected
          {latest.rejectionReason ? `: ${latest.rejectionReason}` : ''}. You can submit again with an
          updated link.
        </p>
      ) : null}
    </div>
  )
}
