'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { formatUnits, isAddress, parseUnits } from 'viem'
import { Button } from '@/components/ui/button'
import { BackToDeCleanupLink } from '@/components/layout/BackToDeCleanupLink'
import {
  CELO_MAINNET_CHAIN_ID,
  CUSD_CELO_MAINNET_ADDRESS,
  CUSD_ERC20_ABI,
  isMiniPayInjected,
} from '@/lib/blockchain/cusd'
import type { SponsorEventDto } from '@/lib/sponsor/types'
import { isMobileBrowser } from '@/lib/blockchain/mobile-browser'

function formatCusd(n: number): string {
  if (!Number.isFinite(n)) return '0'
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a
  return `${a.slice(0, 6)}…${a.slice(-4)}`
}

function progressPct(raised: number, goal: number): number {
  if (!(goal > 0)) return 0
  return Math.min(100, Math.round((raised / goal) * 100))
}

export function SponsorPanel() {
  const { address, isConnected, chainId } = useAccount()
  const { connectAsync, connectors, isPending: connecting, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const { writeContractAsync, isPending: writing } = useWriteContract()

  const [events, setEvents] = useState<SponsorEventDto[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    txHash: string
    amount: string
    eventName: string
  } | null>(null)
  const [miniPay, setMiniPay] = useState(false)
  const [recording, setRecording] = useState(false)

  const selected = useMemo(
    () => events.find((e) => e.id === selectedId) ?? null,
    [events, selectedId]
  )

  const onCelo = chainId === CELO_MAINNET_CHAIN_ID

  const { data: balanceRaw, refetch: refetchBalance } = useReadContract({
    address: CUSD_CELO_MAINNET_ADDRESS,
    abi: CUSD_ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: CELO_MAINNET_CHAIN_ID,
    query: { enabled: Boolean(address && onCelo) },
  })

  const balance = balanceRaw != null ? Number(formatUnits(balanceRaw, 18)) : null
  const amountNum = Number(amount)
  const amountValid = Number.isFinite(amountNum) && amountNum > 0
  const exceedsBalance = balance != null && amountValid && amountNum > balance + 1e-12

  const { isLoading: confirming, isSuccess: confirmed, isError: confirmFailed } =
    useWaitForTransactionReceipt({
      hash: txHash ?? undefined,
      chainId: CELO_MAINNET_CHAIN_ID,
    })

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/sponsor/events', { cache: 'no-store' })
      const data = (await res.json()) as { events?: SponsorEventDto[]; error?: string }
      if (!res.ok) {
        setLoadError(data.error || 'Could not load events')
        setEvents([])
        return
      }
      setEvents(data.events || [])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load events')
      setEvents([])
    } finally {
      setLoadingEvents(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    setMiniPay(isMiniPayInjected())
  }, [])

  // MiniPay: auto-connect injected provider
  useEffect(() => {
    if (!miniPay || isConnected) return
    const injected = connectors.find((c) => c.id === 'injected' || c.type === 'injected')
    if (!injected) return
    void connectAsync({ connector: injected, chainId: CELO_MAINNET_CHAIN_ID }).catch(() => {
      /* user may dismiss */
    })
  }, [miniPay, isConnected, connectors, connectAsync])

  useEffect(() => {
    if (!txHash || !confirmed || !selected || !address || success) return
    let cancelled = false
    void (async () => {
      setRecording(true)
      setActionError(null)
      try {
        const res = await fetch('/api/sponsor/record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selected.id,
            sponsorAddress: address,
            amountCusd: amountNum,
            txHash,
          }),
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(data.error || 'Failed to save sponsorship')
        if (cancelled) return
        setSuccess({
          txHash,
          amount: amount,
          eventName: selected.name,
        })
        void loadEvents()
        void refetchBalance()
      } catch (e) {
        if (!cancelled) {
          setActionError(
            e instanceof Error
              ? `${e.message} (tx may still have succeeded — save your hash: ${txHash})`
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
  }, [
    txHash,
    confirmed,
    selected,
    address,
    amountNum,
    amount,
    success,
    loadEvents,
    refetchBalance,
  ])

  useEffect(() => {
    if (confirmFailed) {
      setActionError('Transaction failed onchain. Try again.')
      setTxHash(null)
    }
  }, [confirmFailed])

  const walletConnect = connectors.find((c) => c.id === 'walletConnect') ?? null
  const injected =
    connectors.find((c) => c.id === 'injected' || c.type === 'injected') ?? null

  const connectBrowser = async (kind: 'injected' | 'walletConnect') => {
    setActionError(null)
    reset()
    const connector = kind === 'injected' ? injected : walletConnect
    if (!connector) {
      setActionError(
        kind === 'injected'
          ? 'No browser wallet detected.'
          : 'WalletConnect is not available.'
      )
      return
    }
    try {
      if (kind === 'walletConnect') {
        await connectAsync({ connector })
      } else {
        await connectAsync({ connector, chainId: CELO_MAINNET_CHAIN_ID })
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Connect failed'
      if (!/rejected|denied|cancel/i.test(msg)) setActionError(msg)
    }
  }

  const switchToCelo = async () => {
    setActionError(null)
    try {
      await switchChainAsync({ chainId: CELO_MAINNET_CHAIN_ID })
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not switch to Celo')
    }
  }

  const sponsor = async () => {
    if (!selected || !address || !amountValid || !onCelo) return
    if (!isAddress(selected.recipientAddress)) {
      setActionError('Event recipient address is invalid.')
      return
    }
    setActionError(null)
    setSuccess(null)
    setTxHash(null)
    try {
      const value = parseUnits(amount, 18)
      const hash = await writeContractAsync({
        address: CUSD_CELO_MAINNET_ADDRESS,
        abi: CUSD_ERC20_ABI,
        functionName: 'transfer',
        args: [selected.recipientAddress as `0x${string}`, value],
        chainId: CELO_MAINNET_CHAIN_ID,
      })
      setTxHash(hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      if (!/rejected|denied|cancel/i.test(msg)) setActionError(msg)
      else setActionError('Transaction cancelled.')
    }
  }

  const busy = connecting || writing || confirming || recording || switching
  const canSend =
    isConnected &&
    onCelo &&
    selected &&
    amountValid &&
    !exceedsBalance &&
    !busy &&
    !success

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 py-6 sm:px-5">
      <div>
        <BackToDeCleanupLink />
        <h1 className="mt-2 font-heading text-2xl tracking-wider text-white">Sponsor a cleanup</h1>
        <p className="mt-1 text-sm text-gray-400">
          Send cUSD on Celo to fund a verified cleanup event
          {miniPay ? ' · MiniPay detected' : ''}.
        </p>
      </div>

      {/* Events */}
      <section className="space-y-3">
        <h2 className="font-heading text-xs tracking-wider text-gray-500">Events</h2>
        {loadingEvents ? (
          <div className="h-28 animate-pulse rounded-xl bg-zinc-900" />
        ) : loadError ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
            {loadError}
          </p>
        ) : events.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-4 text-sm text-gray-400">
            No active or upcoming events yet. Check back soon.
          </p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => {
              const pct = progressPct(ev.amountRaisedCusd, ev.fundingGoalCusd)
              const active = selectedId === ev.id
              return (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(ev.id)
                      setSuccess(null)
                      setActionError(null)
                      setTxHash(null)
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? 'border-brand-green/50 bg-brand-green/10'
                        : 'border-white/10 bg-zinc-950/80 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-white">{ev.name}</p>
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 ring-1 ring-white/10">
                        {ev.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {ev.location} · {ev.organiser}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {new Date(ev.eventDate).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-brand-green"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">
                      {formatCusd(ev.amountRaisedCusd)} / {formatCusd(ev.fundingGoalCusd)} cUSD ·{' '}
                      {ev.verifiedCleanupsCount} verified cleanup
                      {ev.verifiedCleanupsCount === 1 ? '' : 's'}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Wallet */}
      <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
        <h2 className="font-heading text-xs tracking-wider text-gray-500">Wallet</h2>
        {!isConnected ? (
          miniPay ? (
            <p className="text-sm text-gray-400">Connecting MiniPay…</p>
          ) : (
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
                  variant={injected ? 'outline' : 'default'}
                  className="w-full border-white/10"
                  disabled={connecting}
                  onClick={() => void connectBrowser('walletConnect')}
                >
                  {connecting
                    ? 'Opening…'
                    : isMobileBrowser()
                      ? 'WalletConnect'
                      : 'WalletConnect (QR)'}
                </Button>
              ) : null}
            </div>
          )
        ) : (
          <div className="space-y-2 text-sm">
            <p className="text-gray-300">{shortAddr(address!)}</p>
            {!onCelo ? (
              <div className="space-y-2">
                <p className="text-amber-200">Switch to Celo mainnet to send cUSD.</p>
                <Button
                  type="button"
                  className="w-full"
                  disabled={switching}
                  onClick={() => void switchToCelo()}
                >
                  {switching ? 'Switching…' : 'Switch to Celo'}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                cUSD balance:{' '}
                <span className="text-brand-green">
                  {balance == null ? '…' : `${formatCusd(balance)} cUSD`}
                </span>
              </p>
            )}
            {!miniPay ? (
              <button
                type="button"
                className="text-xs text-gray-500 underline hover:text-gray-300"
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            ) : null}
          </div>
        )}
      </section>

      {/* Amount + send */}
      {selected && isConnected && onCelo ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
          <h2 className="font-heading text-xs tracking-wider text-gray-500">
            Sponsor · {selected.name}
          </h2>
          <p className="text-[11px] text-gray-500">
            Funds go to {shortAddr(selected.recipientAddress)}
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs text-gray-400">Amount (cUSD)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="10"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9.]/g, '')
                setAmount(v)
                setSuccess(null)
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-white outline-none focus:border-brand-green/50"
            />
          </label>
          {exceedsBalance ? (
            <p className="text-xs text-amber-300">Amount exceeds your cUSD balance.</p>
          ) : null}
          <Button
            type="button"
            className="w-full"
            disabled={!canSend}
            onClick={() => void sponsor()}
          >
            {writing || confirming
              ? 'Confirm in wallet…'
              : recording
                ? 'Saving…'
                : 'Sponsor'}
          </Button>
        </section>
      ) : null}

      {success ? (
        <div className="space-y-2 rounded-xl border border-brand-green/40 bg-brand-green/10 px-3 py-3 text-sm">
          <p className="font-medium text-brand-green">Sponsorship sent</p>
          <p className="text-gray-200">
            {success.amount} cUSD → {success.eventName}
          </p>
          <a
            href={`https://celoscan.io/tx/${success.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-xs text-brand-green underline"
          >
            {success.txHash}
          </a>
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
