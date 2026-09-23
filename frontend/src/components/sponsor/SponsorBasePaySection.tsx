'use client'

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { isAddress } from 'viem'
import { BasePayButton } from '@base-org/account-ui/react'
import { getPaymentStatus, pay } from '@base-org/account'
import { campaignText, formatCusd, shortAddr } from '@/lib/sponsor/display'
import {
  BASESCAN_TX,
  formatUsdAmount,
  isBasePayTestnet,
  normalizeBasePaymentTxHash,
  pickBasePayPayer,
} from '@/lib/sponsor/base-pay'
import type { SponsorEventDto } from '@/lib/sponsor/types'

type Props = {
  event: SponsorEventDto
  recipientAddress: string
  onRecorded?: () => void
}

type StatusResult = {
  status?: string
  hash?: string
  transactionHash?: string
  from?: string
  sender?: string
  payer?: string
}

async function waitForBasePayment(id: string, testnet: boolean): Promise<StatusResult> {
  for (let i = 0; i < 24; i++) {
    const result = (await getPaymentStatus({ id, testnet })) as StatusResult
    if (result.status === 'completed') return result
    if (result.status === 'failed') throw new Error('Base Pay failed onchain.')
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('Payment is still pending. Save this id and check Basescan later.')
}

export function SponsorBasePaySection({ event, recipientAddress, onRecorded }: Props) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ amount: string; txHash: string | null } | null>(null)
  const testnet = isBasePayTestnet()
  const usd = formatUsdAmount(amount)
  const recipientOk = isAddress(recipientAddress)

  const handlePay = async () => {
    if (!recipientOk) {
      setActionError('This campaign is missing a Base recipient wallet.')
      return
    }
    if (!usd) {
      setActionError('Enter an amount first.')
      return
    }
    setActionError(null)
    setSuccess(null)
    setBusy(true)
    try {
      const payment = await pay({
        amount: usd,
        to: recipientAddress,
        testnet,
      })
      const status = await waitForBasePayment(payment.id, testnet)
      const txHash =
        normalizeBasePaymentTxHash(status.hash) ||
        normalizeBasePaymentTxHash(status.transactionHash) ||
        normalizeBasePaymentTxHash(payment.id)
      const payer = pickBasePayPayer({
        statusFrom: status.from || status.sender || status.payer,
        connectedAddress: address,
      })

      if (txHash && payer) {
        const res = await fetch('/api/sponsor/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            sponsorAddress: payer,
            amountCusd: Number(usd),
            txHash,
          }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error || 'Payment sent, but saving the receipt failed.')
        onRecorded?.()
      }

      setSuccess({ amount: usd, txHash })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Base Pay failed'
      if (!/rejected|denied|cancel/i.test(msg)) setActionError(msg)
      else setActionError('Payment cancelled.')
    } finally {
      setBusy(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-3 rounded-xl border border-brand-green/40 bg-brand-green/10 px-3 py-4 text-sm">
        <p className="font-medium text-brand-green">Donation confirmed</p>
        <p className="text-gray-200">
          {formatCusd(Number(success.amount))} USDC on Base sent to {event.name}.
        </p>
        {success.txHash ? (
          <a
            href={`${BASESCAN_TX}/${success.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-brand-green/40 bg-brand-green/15 px-3 font-heading text-xs font-semibold uppercase tracking-wide text-brand-green hover:bg-brand-green/25"
          >
            Check your transaction on Basescan
          </a>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
        <h2 className={campaignText.label}>USDC on Base</h2>
        <p className={campaignText.note}>
          Funds go to {shortAddr(recipientAddress)} on Base. Base Pay opens a Coinbase / Base Account
          checkout — no MiniPay or Celo switch.
        </p>
        {testnet ? (
          <p className="text-xs text-amber-200">Testnet mode: Base Sepolia USDC.</p>
        ) : null}
        <label className="block space-y-1.5">
          <span className={campaignText.formLabel}>Amount (USDC)</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="10.00"
            value={amount}
            disabled={busy}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-white outline-none focus:border-brand-green/50"
          />
        </label>
        <div className={busy ? 'pointer-events-none opacity-60' : undefined}>
          <BasePayButton colorScheme="dark" onClick={() => void handlePay()} />
        </div>
        {!usd ? (
          <p className={campaignText.meta}>Enter an amount, then tap Base Pay.</p>
        ) : null}
        {!recipientOk ? (
          <p className="text-xs text-amber-300">This campaign is missing a Base recipient wallet.</p>
        ) : null}
      </section>
      {actionError ? (
        <p
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
    </div>
  )
}
