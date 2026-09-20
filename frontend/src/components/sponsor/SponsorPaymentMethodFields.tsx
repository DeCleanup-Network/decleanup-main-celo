'use client'

import { useState } from 'react'
import { Landmark, QrCode, Wallet, X } from 'lucide-react'
import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import { hashToProxyDisplayUrl } from '@/lib/impact/public-portfolio-shared'
import {
  MAX_PAYMENT_METHODS,
  PAYMENT_METHOD_HINT,
  PAYMENT_METHOD_LABEL,
  PAYMENT_NOTES_MAX,
  type PaymentMethodKind,
  type SponsorPaymentMethod,
} from '@/lib/sponsor/payment-methods'

const inputClass =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-brand-green/50'

const KINDS: PaymentMethodKind[] = ['bank', 'local', 'crypto']

const ICONS = {
  bank: Landmark,
  local: QrCode,
  crypto: Wallet,
} as const

function emptyMethod(kind: PaymentMethodKind, recipientDefault = ''): SponsorPaymentMethod {
  if (kind === 'crypto') return { kind, recipientAddress: recipientDefault }
  if (kind === 'bank') return { kind, bankName: '', accountName: '', accountNumber: '', notes: '' }
  return { kind, localMethodName: '', localDetails: '', qrImageCid: '' }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-gray-600">{hint}</span> : null}
    </label>
  )
}

export function SponsorPaymentMethodFields({
  methods,
  onChange,
  defaultRecipient = '',
  walletAddress,
}: {
  methods: SponsorPaymentMethod[]
  onChange: (next: SponsorPaymentMethod[]) => void
  defaultRecipient?: string
  walletAddress?: string
}) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const chosen = new Set(methods.map((m) => m.kind))
  const remaining = KINDS.filter((k) => !chosen.has(k))
  const canAdd = methods.length < MAX_PAYMENT_METHODS && remaining.length > 0

  const update = (index: number, patch: Partial<SponsorPaymentMethod>) => {
    onChange(methods.map((m, i) => (i === index ? { ...m, ...patch } : m)))
  }

  const add = (kind: PaymentMethodKind) => {
    if (!canAdd || chosen.has(kind)) return
    onChange([...methods, emptyMethod(kind, defaultRecipient)])
  }

  const remove = (index: number) => {
    onChange(methods.filter((_, i) => i !== index))
  }

  const uploadQr = async (index: number, file: File | undefined) => {
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const result = await uploadToIPFS(file, {
        pinataKeyvalueType: 'sponsor-payment-qr',
        walletAddress,
      })
      update(index, { qrImageCid: result.hash })
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'QR upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-400">How can donors pay you?</p>
        <p className="mt-1 text-[11px] text-gray-600">
          Pick one method, then you can add one more. Bank and local payments happen outside the app.
        </p>
      </div>

      {methods.length === 0 || canAdd ? (
        <div className="grid grid-cols-1 gap-2">
          {(methods.length === 0 ? KINDS : remaining).map((kind) => {
            const Icon = ICONS[kind]
            return (
              <button
                key={kind}
                type="button"
                onClick={() => add(kind)}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-left transition hover:border-brand-green/40"
              >
                <span className="flex items-center gap-2 text-sm font-medium text-white">
                  <Icon className="h-4 w-4 text-brand-green" />
                  {PAYMENT_METHOD_LABEL[kind]}
                </span>
                <span className="mt-1 block text-[11px] text-gray-500">{PAYMENT_METHOD_HINT[kind]}</span>
              </button>
            )
          })}
        </div>
      ) : null}

      {methods.map((method, index) => (
        <div key={method.kind} className="space-y-3 rounded-xl border border-brand-green/30 bg-brand-green/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-white">{PAYMENT_METHOD_LABEL[method.kind]}</p>
            <button
              type="button"
              onClick={() => remove(index)}
              className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          </div>

          {method.kind === 'bank' ? (
            <>
              <Field label="Bank name">
                <input
                  className={inputClass}
                  value={method.bankName || ''}
                  onChange={(e) => update(index, { bankName: e.target.value })}
                  placeholder="Kasikorn Bank"
                />
              </Field>
              <Field label="Account holder name">
                <input
                  className={inputClass}
                  value={method.accountName || ''}
                  onChange={(e) => update(index, { accountName: e.target.value })}
                  placeholder="Cleanup organiser"
                />
              </Field>
              <Field label="Account number">
                <input
                  className={inputClass}
                  value={method.accountNumber || ''}
                  onChange={(e) => update(index, { accountNumber: e.target.value })}
                  placeholder="123-4-56789-0"
                />
              </Field>
              <Field label="Extra notes" hint={`${(method.notes || '').length}/${PAYMENT_NOTES_MAX}`}>
                <textarea
                  className={`${inputClass} min-h-[72px] resize-y`}
                  value={method.notes || ''}
                  maxLength={PAYMENT_NOTES_MAX}
                  onChange={(e) => update(index, { notes: e.target.value.slice(0, PAYMENT_NOTES_MAX) })}
                  placeholder="Branch, SWIFT, or what the donor should write as the transfer note."
                />
              </Field>
            </>
          ) : null}

          {method.kind === 'local' ? (
            <>
              <Field label="Local method name">
                <input
                  className={inputClass}
                  value={method.localMethodName || ''}
                  onChange={(e) => update(index, { localMethodName: e.target.value })}
                  placeholder="PromptPay, GCash, PayNow"
                />
              </Field>
              <Field label="Details" hint={`${(method.localDetails || '').length}/${PAYMENT_NOTES_MAX}`}>
                <textarea
                  className={`${inputClass} min-h-[72px] resize-y`}
                  value={method.localDetails || ''}
                  maxLength={PAYMENT_NOTES_MAX}
                  onChange={(e) => update(index, { localDetails: e.target.value.slice(0, PAYMENT_NOTES_MAX) })}
                  placeholder="Phone number, reference, or how to complete the payment."
                />
              </Field>
              <Field label="QR code (optional)">
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-xs text-gray-400 file:mr-3 file:rounded-md file:border-0 file:bg-brand-green/20 file:px-3 file:py-1.5 file:text-xs file:text-brand-green"
                  onChange={(e) => void uploadQr(index, e.target.files?.[0])}
                />
              </Field>
              {uploading ? <p className="text-xs text-gray-500">Uploading QR…</p> : null}
              {method.qrImageCid ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hashToProxyDisplayUrl(method.qrImageCid)}
                  alt="Payment QR preview"
                  className="max-h-40 rounded-lg border border-white/10 object-contain"
                />
              ) : null}
            </>
          ) : null}

          {method.kind === 'crypto' ? (
            <Field
              label="Recipient wallet (cUSD)"
              hint="Defaults to your connected wallet. Donors send cUSD in MiniPay or WalletConnect."
            >
              <input
                className={`${inputClass} font-mono text-xs`}
                value={method.recipientAddress || ''}
                onChange={(e) => update(index, { recipientAddress: e.target.value })}
                placeholder={defaultRecipient || '0x…'}
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          ) : null}
        </div>
      ))}

      {methods.length === 1 && canAdd ? (
        <p className="text-[11px] text-gray-600">Optional: add one more payment method from the cards above.</p>
      ) : null}

      {uploadError ? (
        <p className="text-sm text-amber-200" role="alert">
          {uploadError}
        </p>
      ) : null}

      {methods.length >= MAX_PAYMENT_METHODS ? (
        <p className="text-[11px] text-gray-600">Two payment methods is the maximum for now.</p>
      ) : null}
    </div>
  )
}

export function PaymentMethodCardButton({
  kind,
  selected,
  onClick,
}: {
  kind: PaymentMethodKind
  selected?: boolean
  onClick: () => void
}) {
  const Icon = ICONS[kind]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left transition ${
        selected
          ? 'border-brand-green/50 bg-brand-green/10'
          : 'border-white/10 bg-zinc-950/80 hover:border-white/20'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium text-white">
        <Icon className="h-4 w-4 text-brand-green" />
        {PAYMENT_METHOD_LABEL[kind]}
      </span>
      <span className="mt-1 block text-[11px] text-gray-500">{PAYMENT_METHOD_HINT[kind]}</span>
    </button>
  )
}
