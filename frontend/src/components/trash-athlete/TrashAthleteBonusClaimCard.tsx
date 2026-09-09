'use client'

import { CheckCircle2, Gift, Loader2 } from 'lucide-react'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'

type Props = {
  challenge: TrashAthleteChallenge
}

/** Status card after approval — $cDCU is minted automatically on verifier approve. */
export function TrashAthleteBonusClaimCard({ challenge }: Props) {
  const amountLabel = challenge.bonusCdcuAmount || TRASH_ATHLETE_BONUS_CDCU

  if (challenge.bonusCdcuClaimed) {
    return (
      <div className="rounded-xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-brand-green">
          <CheckCircle2 className="h-4 w-4" />
          {amountLabel} $cDCU sent
        </div>
        <p className="mt-2 text-muted-foreground">
          Bonus was credited automatically after verification
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
          . Level {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_DCU_POINTS} DCU are granted by the team.
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
        Your {amountLabel} $cDCU bonus is being sent automatically to your signer address. Refresh in a
        minute if it is not in your wallet yet.
      </p>
      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-brand-green" aria-hidden />
        Waiting for automatic credit…
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Level {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_DCU_POINTS} DCU: team grant after social
        verification.
      </p>
    </div>
  )
}
