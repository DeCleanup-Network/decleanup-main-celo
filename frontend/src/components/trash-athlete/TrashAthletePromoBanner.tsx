'use client'

import Link from 'next/link'
import { Trophy } from 'lucide-react'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_LABEL,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'

/**
 * Home promo for the Trash Athlete Challenge (global cleanup games).
 */
export function TrashAthletePromoBanner() {
  return (
    <section
      aria-label={TRASH_ATHLETE_LABEL}
      className="rounded-xl border border-brand-green/40 bg-brand-green/10 p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden />
          <div>
            <p className="font-heading text-sm uppercase tracking-wider text-foreground">
              {TRASH_ATHLETE_LABEL}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Global cleanup games — post on socials, get verified, unlock level{' '}
              {TRASH_ATHLETE_TARGET_LEVEL} + {TRASH_ATHLETE_BONUS_CDCU} $cDCU bonus.
            </p>
            <Link
              href="/cleanup/trash-athlete"
              className="mt-2 inline-flex items-center gap-1 font-heading text-xs uppercase tracking-wider text-brand-green hover:underline"
            >
              Click here to find out more →
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
