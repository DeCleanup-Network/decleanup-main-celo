import { isAddress, getAddress } from 'viem'
import type { SponsorEventDto } from '@/lib/sponsor/types'

export const MAX_PAYMENT_METHODS = 3
export const PAYMENT_NOTES_MAX = 500

export type PaymentMethodKind = 'bank' | 'local' | 'crypto' | 'crypto-base'

export type SponsorPaymentMethod = {
  kind: PaymentMethodKind
  bankName?: string
  accountName?: string
  accountNumber?: string
  notes?: string
  localMethodName?: string
  localDetails?: string
  qrImageCid?: string
  recipientAddress?: string
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethodKind, string> = {
  bank: 'Bank account',
  local: 'Other local payment method',
  crypto: 'Crypto (cUSD on Celo)',
  'crypto-base': 'Crypto on Base',
}

export const PAYMENT_METHOD_HINT: Record<PaymentMethodKind, string> = {
  bank: 'Account name, bank, and number for a manual transfer.',
  local: 'PromptPay, GCash, or another local rail. Add a QR and notes.',
  crypto: 'Donors send cUSD in the app with MiniPay or a wallet.',
  'crypto-base': 'Donors pay USDC with Base Pay. No Celo wallet needed.',
}

export function isOnchainPaymentKind(kind: PaymentMethodKind): boolean {
  return kind === 'crypto' || kind === 'crypto-base'
}

function clip(value: unknown, max = PAYMENT_NOTES_MAX): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function parsePaymentMethods(raw: unknown): SponsorPaymentMethod[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<PaymentMethodKind>()
  const out: SponsorPaymentMethod[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const kind = rec.kind
    if (kind !== 'bank' && kind !== 'local' && kind !== 'crypto' && kind !== 'crypto-base') continue
    if (seen.has(kind)) continue
    seen.add(kind)
    const method: SponsorPaymentMethod = { kind }
    if (kind === 'bank') {
      method.bankName = clip(rec.bankName, 120)
      method.accountName = clip(rec.accountName, 120)
      method.accountNumber = clip(rec.accountNumber, 80)
      method.notes = clip(rec.notes)
    }
    if (kind === 'local') {
      method.localMethodName = clip(rec.localMethodName, 80)
      method.localDetails = clip(rec.localDetails)
      method.qrImageCid = clip(rec.qrImageCid, 128)
    }
    if (isOnchainPaymentKind(kind)) {
      const addr = clip(rec.recipientAddress, 64)
      method.recipientAddress = isAddress(addr) ? getAddress(addr) : ''
    }
    out.push(method)
    if (out.length >= MAX_PAYMENT_METHODS) break
  }
  return out
}

export function validatePaymentMethods(methods: SponsorPaymentMethod[]): string | null {
  if (methods.length < 1) return 'Pick at least one payment method.'
  if (methods.length > MAX_PAYMENT_METHODS) return `You can add up to ${MAX_PAYMENT_METHODS} payment methods.`
  for (const method of methods) {
    if (method.kind === 'bank') {
      if (!method.bankName || !method.accountNumber) {
        return 'Bank account needs a bank name and account number.'
      }
    }
    if (method.kind === 'local') {
      if (!method.localMethodName && !method.localDetails && !method.qrImageCid) {
        return 'Add a local method name, details, or a QR code.'
      }
    }
    if (isOnchainPaymentKind(method.kind)) {
      if (!method.recipientAddress || !isAddress(method.recipientAddress)) {
        return method.kind === 'crypto-base'
          ? 'Crypto on Base needs a valid 0x recipient wallet.'
          : 'Crypto needs a valid 0x recipient wallet.'
      }
    }
  }
  return null
}

export function eventPaymentMethods(event: Pick<SponsorEventDto, 'paymentMethods' | 'recipientAddress'>): SponsorPaymentMethod[] {
  const stored = parsePaymentMethods(event.paymentMethods)
  if (stored.length > 0) return stored
  if (event.recipientAddress && isAddress(event.recipientAddress)) {
    return [{ kind: 'crypto', recipientAddress: getAddress(event.recipientAddress) }]
  }
  return []
}

export function cryptoRecipientFromMethods(
  methods: SponsorPaymentMethod[],
  fallbackAddress?: string | null
): string {
  const crypto =
    methods.find((m) => m.kind === 'crypto') || methods.find((m) => m.kind === 'crypto-base')
  if (crypto?.recipientAddress && isAddress(crypto.recipientAddress)) {
    return getAddress(crypto.recipientAddress)
  }
  if (fallbackAddress && isAddress(fallbackAddress)) return getAddress(fallbackAddress)
  return ''
}

export function paymentMethodBadges(methods: SponsorPaymentMethod[]): string[] {
  return methods.map((m) => PAYMENT_METHOD_LABEL[m.kind])
}
