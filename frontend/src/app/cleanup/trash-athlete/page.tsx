'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useAccount, useSignMessage } from 'wagmi'
import { Loader2, Trophy, ExternalLink, CheckCircle2 } from 'lucide-react'
import type { Address } from 'viem'
import { BackButton } from '@/components/layout/BackButton'
import { Button } from '@/components/ui/button'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useWallet } from '@/providers/WalletProvider'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_LABEL,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import { TrashAthleteBonusClaimCard } from '@/components/trash-athlete/TrashAthleteBonusClaimCard'
import { buildTrashAthleteSubmitMessage } from '@/lib/trash-athlete/review-signing'

export default function TrashAthleteChallengePage() {
  const router = useRouter()
  const aaEnabled = isAaAuthEnabledClient()
  const { data: session, status: sessionStatus } = useSession()
  const { address, showMainApp, walletReady, walletPhase } = useAppWalletAddress()
  const { smartAccountAddress } = useWallet()
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [username, setUsername] = useState('')
  const [socialProfileUrl, setSocialProfileUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mine, setMine] = useState<TrashAthleteChallenge[]>([])
  const [loadingMine, setLoadingMine] = useState(true)

  const emailSignedIn = aaEnabled ? Boolean(session?.user) : false
  const walletConnected = Boolean(wagmiConnected && (wagmiAddress || address))
  /** Email session or WalletConnect / browser wallet */
  const canAccess = emailSignedIn || walletConnected || (!aaEnabled && showMainApp)

  const embeddedReady =
    emailSignedIn &&
    walletReady &&
    Boolean(smartAccountAddress || address) &&
    walletPhase !== 'no-wallet' &&
    walletPhase !== 'loading'

  const canSubmitForm = embeddedReady || walletConnected

  useEffect(() => {
    if (sessionStatus === 'loading') return
    if (!canAccess) {
      setLoadingMine(false)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        let res: Response
        if (emailSignedIn) {
          res = await fetch('/api/trash-athlete/challenges?mine=1', { cache: 'no-store' })
        } else {
          const w = (wagmiAddress || address) as string
          res = await fetch(
            `/api/trash-athlete/challenges?wallet=${encodeURIComponent(w)}`,
            { cache: 'no-store' }
          )
        }
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
  }, [canAccess, emailSignedIn, sessionStatus, wagmiAddress, address])

  const pending = mine.find((c) => c.status === 'PENDING')
  const approved = mine.find((c) => c.status === 'APPROVED')
  const latest = mine[0]
  const canShowSubmitForm = !pending && !approved && (!latest || latest.status === 'REJECTED')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!canSubmitForm) {
      setError('Connect a wallet (WalletConnect / MetaMask) or sign in with email first.')
      return
    }
    if (pending) {
      setError('You already have a submission waiting for verification.')
      return
    }
    setSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        username,
        socialProfileUrl,
        notes,
      }

      // Prefer email/embedded when session exists; otherwise sign with connected wallet
      if (!emailSignedIn) {
        const wallet = (wagmiAddress || address) as Address | undefined
        if (!wallet || !signMessageAsync) {
          throw new Error('Wallet not ready to sign. Reconnect WalletConnect and try again.')
        }
        const timestamp = Date.now()
        const message = buildTrashAthleteSubmitMessage({
          username,
          socialProfileUrl,
          notes,
          wallet,
          timestamp,
        })
        const signature = await signMessageAsync({ message })
        body.wallet = wallet
        body.timestamp = timestamp
        body.signature = signature
      }

      const res = await fetch('/api/trash-athlete/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <BackButton href="/cleanup" label="Back to submit cleanup" />
        <h1 className="mt-6 font-heading text-2xl uppercase tracking-wide text-foreground">
          {TRASH_ATHLETE_LABEL}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in with email or connect your wallet (WalletConnect / MetaMask) to submit your 30-day
          result.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/login?callbackUrl=/cleanup/trash-athlete">Sign in with email</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Connect wallet on home</Link>
          </Button>
        </div>
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
            How to participate: every day for a month remove one piece of litter from environment, post it
            on socials with hashtags #TrashMob2026MMDD, #GlobalCleanupGamesOrg and #DeCleanupNetwork. After
            30 days complete, share your result below. After verification, you receive{' '}
            {TRASH_ATHLETE_BONUS_CDCU} $cDCU tokens, level {TRASH_ATHLETE_TARGET_LEVEL}, and{' '}
            {TRASH_ATHLETE_DCU_POINTS} DCU (sent by the team).
          </p>
          {walletConnected && !emailSignedIn ? (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Submitting as {(wagmiAddress || address)?.toLowerCase()}
            </p>
          ) : null}
        </div>
      </div>

      {loadingMine ? (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {approved ? (
        <div className="mt-8">
          <TrashAthleteBonusClaimCard challenge={approved} />
          {approved.bonusCdcuClaimed && approved.levelGrantStatus === 'granted' ? (
            <Button variant="outline" className="mt-4" onClick={() => router.push('/')}>
              Back to dashboard
            </Button>
          ) : null}
        </div>
      ) : null}

      {pending ? (
        <div className="mt-8 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-400">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Waiting for verification
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Submit is locked until a verifier approves @{pending.username}.
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

      {!pending && !approved && latest?.status === 'APPROVED' ? (
        <div className="mt-8 rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-brand-green">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Challenge approved
          </div>
        </div>
      ) : null}

      {canShowSubmitForm ? (
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          {!canSubmitForm ? (
            <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              Connect WalletConnect / MetaMask, or finish email wallet setup (passcode), so we know where
              to send rewards.
            </p>
          ) : null}

          {walletConnected && !emailSignedIn ? (
            <p className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
              You will confirm a signature in your wallet. Rewards go to that connected address.
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
              Instagram, TikTok, X, Facebook, etc. where your cleanup photos are visible.
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

          <a
            href="https://globalcleanupgames.org/untitled-176"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-green hover:underline"
          >
            More about Trash Athlete Challenge
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>

          <Button type="submit" disabled={submitting || !canSubmitForm} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {emailSignedIn ? 'Submitting…' : 'Confirm in wallet…'}
              </>
            ) : emailSignedIn ? (
              'Submit Trash Athlete completion'
            ) : (
              'Sign & submit with wallet'
            )}
          </Button>
        </form>
      ) : null}

      {latest?.status === 'REJECTED' && !pending && !approved ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Previous submission was rejected
          {latest.rejectionReason ? `: ${latest.rejectionReason}` : ''}. You can submit again with an
          updated link.
        </p>
      ) : null}
    </div>
  )
}
