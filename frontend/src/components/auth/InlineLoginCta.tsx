'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LoginOptions } from '@/components/auth/LoginOptions'

type Props = {
  callbackUrl?: string
  /** Rendered next to the Log in button (e.g. a secondary CTA). */
  children?: React.ReactNode
}

/** Log in without leaving the page: the button expands into the sign-in options. */
export function InlineLoginCta({ callbackUrl = '/', children }: Props) {
  const [open, setOpen] = useState(false)
  const [mountedPanel, setMountedPanel] = useState(false)

  const toggle = () => {
    setMountedPanel(true)
    setOpen((value) => !value)
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
        <Button
          type="button"
          size="default"
          aria-expanded={open}
          aria-controls="inline-login-panel"
          onClick={toggle}
        >
          {open ? 'Close' : 'Log in'}
        </Button>
        {children}
      </div>

      {mountedPanel ? (
        <div
          id="inline-login-panel"
          hidden={!open}
          className="w-full max-w-sm rounded-xl border border-white/10 bg-elevated/60 p-4 text-left"
        >
          <LoginOptions callbackUrl={callbackUrl} />
        </div>
      ) : null}
    </div>
  )
}
