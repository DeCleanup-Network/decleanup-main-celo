'use client'

import { useMemo, useState } from 'react'
import { Landmark, QrCode, Wallet } from 'lucide-react'
import { hashToProxyDisplayUrl } from '@/lib/impact/public-portfolio-shared'
import {
  eventPaymentMethods,
  PAYMENT_METHOD_LABEL,
  type PaymentMethodKind,
  type SponsorPaymentMethod,
} from '@/lib/sponsor/payment-methods'
import { SponsorDonateSection } from '@/components/sponsor/SponsorDonateSection'
import type { SponsorEventDto } from '@/lib/sponsor/types'

const ICONS = {
  bank: Landmark,
  local: QrCode,
  crypto: Wallet,
} as const

function ManualNotice() {
  return (
    <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-400">
      This option is completed outside the app. Use the details below, then tell the organiser if you need a receipt.
    </p>
  )
}

function MethodDetails({ method }: { method: SponsorPaymentMethod }) {
  if (method.kind === 'bank') {
    return (
      <div className="space-y-2 text-sm text-gray-200">
        <ManualNotice />
        {method.bankName ? <p>Bank: {method.bankName}</p> : null}
        {method.accountName ? <p>Account name: {method.accountName}</p> : null}
        {method.accountNumber ? <p className="font-mono text-xs">Account number: {method.accountNumber}</p> : null}
        {method.notes ? <p className="whitespace-pre-wrap text-gray-300">{method.notes}</p> : null}
      </div>
    )
  }
  if (method.kind === 'local') {
    return (
      <div className="space-y-3 text-sm text-gray-200">
        <ManualNotice />
        {method.localMethodName ? <p>{method.localMethodName}</p> : null}
        {method.localDetails ? <p className="whitespace-pre-wrap text-gray-300">{method.localDetails}</p> : null}
        {method.qrImageCid ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hashToProxyDisplayUrl(method.qrImageCid)}
            alt="Payment QR code"
            className="max-h-56 rounded-lg border border-white/10 bg-white object-contain p-2"
          />
        ) : null}
      </div>
    )
  }
  return null
}

export function SponsorDonorPaymentOptions({
  event,
  onRecorded,
}: {
  event: SponsorEventDto
  onRecorded: () => void
}) {
  const methods = useMemo(() => eventPaymentMethods(event), [event])
  const [selected, setSelected] = useState<PaymentMethodKind | null>(null)
  const active = methods.find((m) => m.kind === selected) || null

  if (methods.length === 0) return null

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-xs tracking-wider text-gray-500">How to donate</h2>
        <p className="mt-1 text-xs text-gray-500">
          Pick a method this cleanup accepts. Bank and local payments are manual. Crypto is sent in this app.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {methods.map((method) => {
          const Icon = ICONS[method.kind]
          const isOn = selected === method.kind
          return (
            <button
              key={method.kind}
              type="button"
              onClick={() => setSelected(isOn ? null : method.kind)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                isOn
                  ? 'border-brand-green/50 bg-brand-green/10'
                  : 'border-white/10 bg-zinc-950/80 hover:border-white/20'
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-white">
                <Icon className="h-4 w-4 text-brand-green" />
                {PAYMENT_METHOD_LABEL[method.kind]}
              </span>
              <span className="mt-1 block text-[11px] text-gray-500">
                {method.kind === 'crypto' ? 'Pay in the app with MiniPay or a wallet.' : 'Manual payment, outside the app.'}
              </span>
            </button>
          )
        })}
      </div>

      {active?.kind === 'crypto' ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">Connect a wallet only when you are ready to send cUSD.</p>
          <SponsorDonateSection
            event={{
              ...event,
              recipientAddress: active.recipientAddress || event.recipientAddress,
            }}
            onRecorded={onRecorded}
          />
        </div>
      ) : null}

      {active && active.kind !== 'crypto' ? (
        <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-4">
          <MethodDetails method={active} />
        </div>
      ) : null}
    </section>
  )
}
