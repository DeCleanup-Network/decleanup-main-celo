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
import { campaignText } from '@/lib/sponsor/display'
import type { SponsorEventDto } from '@/lib/sponsor/types'

const ICONS = {
  bank: Landmark,
  local: QrCode,
  crypto: Wallet,
} as const

function ManualNotice() {
  return (
    <p className={campaignText.noteBox}>
      This option is completed outside the app. Use the details below, then tell the organiser if you need a receipt.
    </p>
  )
}

function MethodDetails({ method }: { method: SponsorPaymentMethod }) {
  if (method.kind === 'bank') {
    return (
      <div className="space-y-2">
        <ManualNotice />
        {method.bankName ? (
          <p>
            <span className={campaignText.formLabel}>Bank </span>
            <span className={campaignText.formValue}>{method.bankName}</span>
          </p>
        ) : null}
        {method.accountName ? (
          <p>
            <span className={campaignText.formLabel}>Account name </span>
            <span className={campaignText.formValue}>{method.accountName}</span>
          </p>
        ) : null}
        {method.accountNumber ? (
          <p>
            <span className={campaignText.formLabel}>Account number </span>
            <span className={`${campaignText.formValue} font-mono text-xs`}>{method.accountNumber}</span>
          </p>
        ) : null}
        {method.notes ? <p className={`whitespace-pre-wrap ${campaignText.note}`}>{method.notes}</p> : null}
      </div>
    )
  }
  if (method.kind === 'local') {
    return (
      <div className="space-y-3">
        <ManualNotice />
        {method.localMethodName ? <p className={campaignText.cardTitle}>{method.localMethodName}</p> : null}
        {method.localDetails ? <p className={`whitespace-pre-wrap ${campaignText.note}`}>{method.localDetails}</p> : null}
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
    <section className="space-y-4 rounded-2xl border border-white/10 bg-zinc-900/90 p-4">
      <div className="space-y-2">
        <h2 className={campaignText.section}>How to donate</h2>
        <p className={campaignText.noteBox}>
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
                  : 'border-white/15 bg-black/40 hover:border-white/30'
              }`}
            >
              <span className={`flex items-center gap-2 ${campaignText.cardTitle}`}>
                <Icon className="h-4 w-4 text-brand-green" />
                {PAYMENT_METHOD_LABEL[method.kind]}
              </span>
              <span className={campaignText.cardHint}>
                {method.kind === 'crypto' ? 'Pay in the app with MiniPay or a wallet.' : 'Manual payment, outside the app.'}
              </span>
            </button>
          )
        })}
      </div>

      {active?.kind === 'crypto' ? (
        <div className="space-y-3">
          <p className={campaignText.noteBox}>Connect a wallet only when you are ready to send cUSD.</p>
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
