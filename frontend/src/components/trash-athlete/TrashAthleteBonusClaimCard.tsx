'use client'

import { CheckCircle2, Gift } from 'lucide-react'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'

type Props = {
  challenge: TrashAthleteChallenge
}

/** Approved status — rewards are sent manually by ops (Safe). */
export function TrashAthleteBonusClaimCard({ challenge }: Props) {
  const amountLabel = challenge.bonusCdcuAmount || TRASH_ATHLETE_BONUS_CDCU

  if (challenge.bonusCdcuClaimed && challenge.levelGrantStatus === 'granted') {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-brand-green">
          <CheckCircle2 className="h-4 w-4" />
          Rewards recorded
        </div>
        <p className="mt-2 text-muted-foreground">
          {amountLabel} $cDCU
          {challenge.bonusCdcuClaimTx ? (
            <>
              {' '}
              (
              <a
                href={`https://celoscan.io/tx/${challenge.bonusCdcuClaimTx}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green hover:underline"
              >
                view tx
              </a>
              )
            </>
          ) : null}
          {' '}
          and level / DCU grants are marked done for this challenge.
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
        Verified. The team will send {amountLabel} $cDCU tokens, level {TRASH_ATHLETE_TARGET_LEVEL}, and{' '}
        {TRASH_ATHLETE_DCU_POINTS} DCU to your signer address (the one you import to MetaMask). No action
        needed here.
      </p>
      <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
        Signer: {challenge.walletAddress}
      </p>
    </div>
  )
}
