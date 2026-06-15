'use client'

import { Delete } from 'lucide-react'
import { WALLET_PASSCODE_LENGTH, normalizeWalletPasscodeInput } from '@/lib/client-wallet/passcode'

type Props = {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  title: string
  subtitle?: string
  error?: string | null
  disabled?: boolean
  length?: number
}

export function NumericPasscodePad({
  value,
  onChange,
  onComplete,
  title,
  subtitle,
  error,
  disabled = false,
  length = WALLET_PASSCODE_LENGTH,
}: Props) {
  const digits = normalizeWalletPasscodeInput(value)

  const pushDigit = (digit: string) => {
    if (disabled || digits.length >= length) return
    const next = `${digits}${digit}`
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  const popDigit = () => {
    if (disabled || digits.length === 0) return
    onChange(digits.slice(0, -1))
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const

  return (
    <div className="mx-auto w-full max-w-xs space-y-5">
      <div className="space-y-2 text-center">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle ? <p className="text-sm text-gray-400">{subtitle}</p> : null}
      </div>

      <div className="flex justify-center gap-3" aria-hidden>
        {Array.from({ length }, (_, i) => (
          <span
            key={i}
            className={`h-3 w-3 rounded-full border transition-colors ${
              i < digits.length
                ? 'border-brand-green bg-brand-green'
                : 'border-gray-600 bg-transparent'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3" role="group" aria-label={title}>
        {keys.map((key, index) => {
          if (key === '') {
            return <div key={`spacer-${index}`} />
          }
          if (key === 'back') {
            return (
              <button
                key="back"
                type="button"
                disabled={disabled || digits.length === 0}
                onClick={popDigit}
                className="flex h-14 items-center justify-center rounded-xl border border-gray-800 bg-gray-900/80 text-gray-300 transition-colors hover:bg-gray-800 disabled:opacity-40 sm:h-16"
                aria-label="Delete digit"
              >
                <Delete className="h-5 w-5" />
              </button>
            )
          }
          return (
            <button
              key={key}
              type="button"
              disabled={disabled || digits.length >= length}
              onClick={() => pushDigit(key)}
              className="flex h-14 items-center justify-center rounded-xl border border-gray-800 bg-gray-900/80 text-xl font-medium text-white transition-colors hover:border-brand-green/40 hover:bg-gray-800 disabled:opacity-40 sm:h-16 sm:text-2xl"
            >
              {key}
            </button>
          )
        })}
      </div>

      {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
