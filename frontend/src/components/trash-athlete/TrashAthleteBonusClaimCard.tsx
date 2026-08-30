'use client'

import { useState } from 'react'
import { Loader2, Gift, CheckCircle2 } from 'lucide-react'
import type { Address } from 'viem'
import { Button } from '@/components/ui/button'
import { TransactionWaitNotice } from '@/components/ui/transaction-wait-notice'
import { claimCdcu } from '@/lib/blockchain/claim-vault'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { useWallet } from '@/providers/WalletProvider'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'

type Props = {
  challenge: TrashAthleteChallenge
  onClaimed?: () => void
}

export function TrashAthleteBonusClaimCard({ challenge, onClaimed }: Props) {
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { address: appAddress } = useAppWalletAddress()
  const { eoaAddress, getGaslessClient, hasActiveSigningSession } = useWallet()
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const recipient = (isEmbeddedAccount ? eoaAddress : appAddress) as Address | undefined
  const amountLabel = challenge.bonusCdcuAmount || TRASH_ATHLETE_BONUS_CDCU

  async function claim() {
    if (!recipient) {
      setError('Wallet address not ready')
      return
    }
    setLoading(true)
    setError(null)
    setPhase('Requesting claim signature…')
    try {
      const res = await fetch('/api/trash-athlete/claim-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient,
          challengeId: challenge.id,
        }),
      })
      const signed = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(signed.error || 'Could not get claim signature')
      }

      setPhase('Submitting ClaimVault transaction…')
      const gasless =
        isEmbeddedAccount && hasActiveSigningSession
          ? await getGaslessClient().catch(() => null)
          : null

      const { hash } = await claimCdcu(
        {
          recipient: signed.recipient as Address,
          amount: String(signed.amount),
          category: Number(signed.category),
          nonce: String(signed.nonce),
          expiry: Number(signed.expiry),
          v: Number(signed.v),
          r: signed.r as `0x${string}`,
          s: signed.s as `0x${string}`,
        },
        {
          gaslessClient: gasless ?? undefined,
          claimerAddress: appAddress as Address | undefined,
        }
      )

      setPhase('Recording claim…')
      await fetch('/api/trash-athlete/claim-request', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: challenge.id, txHash: hash }),
      })

      setDone(true)
      onClaimed?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed')
    } finally {
      setLoading(false)
      setPhase(null)
    }
  }

  if (done || challenge.bonusCdcuClaimed) {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-brand-green">
          <CheckCircle2 className="h-4 w-4" />
          {amountLabel} $cDCU claimed
        </div>
        <p className="mt-2 text-muted-foreground">
          Level {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_DCU_POINTS} DCU: team grant after social
          verification.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-brand-green/40 bg-card p-4">
      <div className="flex items-center gap-2 font-heading text-lg uppercase tracking-wide text-foreground">
        <Gift className="h-5 w-5 text-brand-green" />
        Challenge approved
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Claim your {amountLabel} $cDCU bonus (on top of {TRASH_ATHLETE_DCU_POINTS} DCU / level{' '}
        {TRASH_ATHLETE_TARGET_LEVEL} package).
      </p>
      {error ? (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <Button className="mt-4 w-full" disabled={loading || !recipient} onClick={() => void claim()}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {phase || 'Claiming…'}
          </>
        ) : (
          `Claim ${amountLabel} $cDCU`
        )}
      </Button>
      {loading ? <TransactionWaitNotice active className="mt-3" /> : null}
    </div>
  )
}
