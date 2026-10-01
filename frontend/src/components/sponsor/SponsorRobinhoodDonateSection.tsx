'use client'

import { useEffect, useState } from 'react'
import {
  useAccount,
  useBalance,
  useConfig,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatEther, getAddress, isAddress, parseEther } from 'viem'
import { Button } from '@/components/ui/button'
import { ROBINHOOD_TESTNET_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { connectWithWalletConnect } from '@/lib/blockchain/connect-wallet-connect'
import { getConfig } from '@/lib/blockchain/get-wagmi-config'
import { switchToExperienceChain } from '@/lib/blockchain/switch-to-required-chain'
import { campaignText, formatCusd, shortAddr } from '@/lib/sponsor/display'
import type { SponsorEventDto } from '@/lib/sponsor/types'

const EXPLORER_TX = 'https://explorer.testnet.chain.robinhood.com/tx'

function ExplorerLink({ hash, label }: { hash: string; label: string }) {
  return (
    <a
      href={`${EXPLORER_TX}/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-brand-green/40 bg-brand-green/15 px-3 font-heading text-xs font-semibold uppercase tracking-wide text-brand-green hover:bg-brand-green/25"
    >
      {label}
    </a>
  )
}

type Props = {
  event: SponsorEventDto
  recipientAddress: string
  onRecorded?: () => void
}

export function SponsorRobinhoodDonateSection({ event, recipientAddress, onRecorded }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const config = useConfig()
  const { connectAsync, connectors, isPending: connecting, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const { sendTransactionAsync, isPending: writing } = useSendTransaction()

  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ txHash: string; amount: string } | null>(null)
  const [recording, setRecording] = useState(false)

  const onRobinhood = chainId === ROBINHOOD_TESTNET_CHAIN_ID
  const recipientOk = isAddress(recipientAddress)

  const { data: balanceData, refetch: refetchBalance } = useBalance({
    address,
    chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    query: { enabled: Boolean(address && onRobinhood) },
  })

  const balance = balanceData != null ? Number(formatEther(balanceData.value)) : null
  const noTestEth = balance != null && balance <= 0
  const amountNum = Number(amount)
  const amountValid = Number.isFinite(amountNum) && amountNum > 0
  const exceedsBalance = balance != null && amountValid && amountNum > balance + 1e-12

  const { isLoading: confirming, isSuccess: confirmed, isError: confirmFailed } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      chainId: ROBINHOOD_TESTNET_CHAIN_ID,
    })

  useEffect(() => {
    if (!txHash || !confirmed || !address || success) return
    let cancelled = false
    void (async () => {
      setRecording(true)
      setActionError(null)
      try {
        const res = await fetch('/api/sponsor/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            sponsorAddress: address,
            amountCusd: amountNum,
            txHash,
          }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to save sponsorship')
        if (cancelled) return
        setSuccess({ txHash, amount })
        onRecorded?.()
        void refetchBalance()
      } catch (e) {
        if (!cancelled) {
          setActionError(
            e instanceof Error
              ? `${e.message} Payment went through on Robinhood; save this hash if the campaign does not update: ${txHash}`
              : 'Record failed'
          )
        }
      } finally {
        if (!cancelled) setRecording(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [txHash, confirmed, address, amountNum, amount, success, event.id, onRecorded, refetchBalance])

  useEffect(() => {
    if (confirmFailed) {
      setActionError('Transaction failed onchain. Try again.')
      setTxHash(null)
    }
  }, [confirmFailed])

  const walletConnect = connectors.find((c) => c.id === 'walletConnect') ?? null
  const injected = connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? null

  const connectBrowser = async (kind: 'injected' | 'walletConnect') => {
    setActionError(null)
    reset()
    const connector = kind === 'injected' ? injected : walletConnect
    if (!connector) {
      setActionError(kind === 'injected' ? 'No browser wallet detected.' : 'WalletConnect is not available.')
      return
    }
    try {
      if (kind === 'walletConnect') {
        await connectWithWalletConnect({ config, connector, connectAsync })
      } else {
        await connectAsync({ connector, chainId: ROBINHOOD_TESTNET_CHAIN_ID })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connect failed'
      if (/provider not found/i.test(msg)) {
        setActionError(
          'No browser wallet in this session. Use Connect wallet, or open this page in a wallet browser that can add Robinhood Chain testnet (46630).'
        )
        return
      }
      if (!/rejected|denied|cancel/i.test(msg)) setActionError(msg)
    }
  }

  const switchToRobinhood = async () => {
    setActionError(null)
    try {
      const ok = await switchToExperienceChain(getConfig(), ROBINHOOD_TESTNET_CHAIN_ID)
      if (!ok) await switchChainAsync({ chainId: ROBINHOOD_TESTNET_CHAIN_ID })
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : 'Could not switch to Robinhood Chain testnet (46630). Add the chain in your wallet and try again.'
      )
    }
  }

  const sponsor = async () => {
    if (!address || !amountValid || !onRobinhood || !recipientOk || noTestEth) return
    setActionError(null)
    setSuccess(null)
    setTxHash(null)
    try {
      const hash = await sendTransactionAsync({
        to: getAddress(recipientAddress),
        value: parseEther(amount),
        chainId: ROBINHOOD_TESTNET_CHAIN_ID,
      })
      setTxHash(hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      if (/insufficient|exceeds|not enough/i.test(msg)) {
        setActionError(
          'Not enough test ETH on Robinhood Chain testnet (46630) to cover this send and gas.'
        )
        return
      }
      if (!/rejected|denied|cancel/i.test(msg)) setActionError(msg)
      else setActionError('Transaction cancelled.')
    }
  }

  const busy = connecting || writing || confirming || recording || switching
  const canSend =
    isConnected &&
    onRobinhood &&
    recipientOk &&
    amountValid &&
    !exceedsBalance &&
    !noTestEth &&
    !busy &&
    !success

  return (
    <div className="space-y-3">
      <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
        <h2 className={campaignText.label}>Wallet</h2>
        {!isConnected ? (
          <div className="space-y-2">
            {injected ? (
              <Button
                type="button"
                className="w-full"
                disabled={connecting}
                onClick={() => void connectBrowser('injected')}
              >
                {connecting ? 'Connecting…' : 'Browser wallet'}
              </Button>
            ) : null}
            {walletConnect ? (
              <Button
                type="button"
                className="w-full"
                disabled={connecting}
                onClick={() => void connectBrowser('walletConnect')}
              >
                {connecting ? 'Opening WalletConnect…' : 'Connect wallet'}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p className={campaignText.formValue}>{shortAddr(address!)}</p>
            {!onRobinhood ? (
              <div className="space-y-2">
                <p className="text-amber-200">
                  This wallet is on chain {chainId ?? 'unknown'}. Switch to Robinhood Chain testnet
                  (46630) to send ETH.
                </p>
                <Button type="button" className="w-full" disabled={switching} onClick={() => void switchToRobinhood()}>
                  {switching ? 'Switching…' : 'Switch to Robinhood testnet'}
                </Button>
              </div>
            ) : noTestEth ? (
              <p className="text-amber-200">
                Connected on Robinhood Chain testnet (46630), but this wallet has no test ETH. The
                send is blocked until you add a small amount.
              </p>
            ) : (
              <p className={campaignText.formLabel}>
                ETH balance:{' '}
                <span className="text-brand-green">
                  {balance == null ? '…' : `${formatCusd(balance)} ETH`}
                </span>
              </p>
            )}
            <button
              type="button"
              className="text-xs text-zinc-400 underline hover:text-zinc-200"
              onClick={() => disconnect()}
            >
              Disconnect
            </button>
          </div>
        )}
      </section>

      {isConnected && onRobinhood && !success && !noTestEth ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
          <h2 className={campaignText.label}>Amount</h2>
          <p className={campaignText.note}>
            Funds go to {shortAddr(recipientOk ? recipientAddress : event.recipientAddress)}
          </p>
          <label className="block space-y-1.5">
            <span className={campaignText.formLabel}>Amount (ETH)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.001"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                setSuccess(null)
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-white outline-none focus:border-brand-green/50"
            />
          </label>
          {exceedsBalance ? (
            <p className="text-xs text-amber-300">Amount exceeds your ETH balance.</p>
          ) : null}
          <Button type="button" className="w-full" disabled={!canSend} onClick={() => void sponsor()}>
            {writing
              ? 'Confirm in wallet…'
              : confirming
                ? 'Waiting for confirmation…'
                : recording
                  ? 'Saving…'
                  : 'Sponsor'}
          </Button>
        </section>
      ) : null}

      {txHash && !success ? (
        <div className="space-y-2 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-3">
          <p className={campaignText.note}>
            {confirming || recording
              ? 'Transaction submitted. Keep this explorer link while it confirms.'
              : 'Transaction hash is on Robinhood even if saving the campaign record failed.'}
          </p>
          <ExplorerLink hash={txHash} label="Open on Robinhood explorer" />
        </div>
      ) : null}

      {success ? (
        <div className="space-y-3 rounded-xl border border-brand-green/40 bg-brand-green/10 px-3 py-4 text-sm">
          <p className="font-medium text-brand-green">Donation confirmed</p>
          <p className="text-gray-200">
            {success.amount} ETH sent to {event.name}.
          </p>
          <ExplorerLink hash={success.txHash} label="Check your transaction" />
        </div>
      ) : null}

      {actionError ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100" role="alert">
          {actionError}
        </p>
      ) : null}
    </div>
  )
}
