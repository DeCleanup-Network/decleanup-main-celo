'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WalletPasscodeSetupWizard } from '@/components/aa/WalletPasscodeSetupWizard'
import { WALLET_PASSCODE_LOWER } from '@/lib/client-wallet/copy'

type Props = {
  /** Settings page: expanded by default */
  defaultOpen?: boolean
  compact?: boolean
  ctaLabel?: string
}

/** Create wallet passcode while account is in pending-password phase */
export function WalletPasskeySetupForm({
  defaultOpen = false,
  compact = false,
  ctaLabel,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)

  if (!open && !defaultOpen) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-white/10 text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        {ctaLabel ?? `Set ${WALLET_PASSCODE_LOWER} now`}
      </Button>
    )
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4 border-t border-gray-800 pt-4'}>
      <WalletPasscodeSetupWizard />
      {!defaultOpen ? (
        <p className="text-center text-xs text-gray-500">
          Or finish in{' '}
          <Link href="/wallet" className="text-brand-green underline">
            Account settings
          </Link>
        </p>
      ) : null}
    </div>
  )
}
