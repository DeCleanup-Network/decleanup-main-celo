'use client'

import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export const TRANSACTION_WAIT_HINT =
  "Don't close or reload this page. Your wallet may ask you to approve in a few seconds."

export const TRANSACTION_WAIT_ACTIVE = 'Keep this page open while your wallet approves.'

function waitNoticeText(active: boolean, transactionCount?: number): string {
  if (!active) return TRANSACTION_WAIT_HINT
  if (transactionCount && transactionCount > 1) {
    return `Keep this page open while you approve ${transactionCount} transactions in the wallet.`
  }
  if (transactionCount === 1) {
    return 'Keep this page open while you approve 1 transaction in the wallet.'
  }
  return TRANSACTION_WAIT_ACTIVE
}

type TransactionWaitNoticeProps = {
  /** Stronger styling while a wallet / chain action is in progress. */
  active?: boolean
  /** When set, the yellow note names how many wallet approvals to expect. */
  transactionCount?: number
  className?: string
}

export function TransactionWaitNotice({
  active = false,
  transactionCount,
  className,
}: TransactionWaitNoticeProps) {
  const text = waitNoticeText(active, transactionCount)

  return (
    <div
      role={active ? 'status' : undefined}
      aria-live={active ? 'polite' : undefined}
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center',
        active
          ? 'rounded-lg border border-brand-yellow/35 bg-brand-yellow/10 px-4 py-3'
          : 'px-2',
        className
      )}
    >
      {active ? (
        <Loader2
          className="h-5 w-5 shrink-0 animate-spin text-brand-yellow"
          aria-hidden
        />
      ) : null}
      <p
        className={cn(
          'max-w-sm text-xs leading-relaxed',
          active ? 'text-yellow-100/90' : 'text-muted-foreground'
        )}
      >
        {text}
      </p>
    </div>
  )
}

type TransactionActionBlockProps = {
  children: ReactNode
  pending?: boolean
  /** Show the subtle hint when idle (default false; notice appears with spinner when pending). */
  showHint?: boolean
  transactionCount?: number
  className?: string
}

/** Wraps an action button with the standard don't-close-page notice. */
export function TransactionActionBlock({
  children,
  pending = false,
  showHint = false,
  transactionCount,
  className,
}: TransactionActionBlockProps) {
  if (!pending && !showHint) {
    return <>{children}</>
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <TransactionWaitNotice active={pending} transactionCount={transactionCount} className="w-full" />
      {children}
    </div>
  )
}
