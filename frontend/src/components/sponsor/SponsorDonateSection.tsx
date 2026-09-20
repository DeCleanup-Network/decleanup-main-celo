'use client'

import { useEffect, useState } from 'react'
import {
  useAccount,
  useConfig,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi'
import { formatUnits, getAddress, isAddress, parseUnits } from 'viem'
import { Button } from '@/components/ui/button'
import {
  CELO_MAINNET_CHAIN_ID,
  CUSD_CELO_MAINNET_ADDRESS,
  CUSD_ERC20_ABI,
  CUSD_TRANSFER_GAS,
  isMiniPayInjected,
} from '@/lib/blockchain/cusd'
import { connectWithWalletConnect } from '@/lib/blockchain/connect-wallet-connect'
import { formatCusd, shortAddr } from '@/lib/sponsor/display'
import type { SponsorEventDto } from '@/lib/sponsor/types'

type Props = {
  event: SponsorEventDto
  onRecorded?: () => void
}

export function SponsorDonateSection({ event, onRecorded }: Props) {
  const { address, isConnected, chainId } = useAccount()
  const config = useConfig()
  const { connectAsync, connectors, isPending: connecting, reset } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChainAsync, isPending: switching } = useSwitchChain()
  const { writeContractAsync, isPending: writing } = useWriteContract()

  const [amount, setAmount] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ txHash: string; amount: string } | null>(null)
  const [miniPay, setMiniPay] = useState(false)
  const [recording, setRecording] = useState(false)

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

  useEffect(() => {
    setMiniPay(isMiniPayInjected())
  }, [])

  useEffect(() => {
    if (!miniPay || isConnected) return
    const injected = connectors.find((c) => c.id === 'injected' || c.type === 'injected')
    if (!injected) return
    void connectAsync({ connector: injected, chainId: CELO_MAINNET_CHAIN_ID }).catch(() => {
      /* user may dismiss */
    })
  }, [miniPay, isConnected, connectors, connectAsync])

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
              ? `${e.message} (tx may still have succeeded; save your hash: ${txHash})`
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
    if (!address || !amountValid || !onCelo) return
    if (!isAddress(event.recipientAddress)) {
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
        args: [getAddress(event.recipientAddress), value],
        chainId: CELO_MAINNET_CHAIN_ID,
        gas: CUSD_TRANSFER_GAS,
        ...(miniPay ? { feeCurrency: CUSD_CELO_MAINNET_ADDRESS } : {}),
      })
      setTxHash(hash)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Transaction failed'
      if (!/rejected|denied|cancel/i.test(msg)) setActionError(msg)
      else setActionError('Transaction cancelled.')
    }
  }

  const busy = connecting || writing || confirming || recording || switching
  const canSend = isConnected && onCelo && amountValid && !exceedsBalance && !busy && !success

  return (
    <div className="space-y-3">
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
                  className="w-full"
                  disabled={connecting}
                  onClick={() => void connectBrowser('walletConnect')}
                >
                  {connecting ? 'Opening WalletConnect…' : 'Connect wallet'}
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
                <Button type="button" className="w-full" disabled={switching} onClick={() => void switchToCelo()}>
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

      {isConnected && onCelo && !success ? (
        <section className="space-y-3 rounded-xl border border-white/10 bg-zinc-950/80 p-4">
          <h2 className="font-heading text-xs tracking-wider text-gray-500">Amount</h2>
          <p className="text-[11px] text-gray-500">Funds go to {shortAddr(event.recipientAddress)}</p>
          <label className="block space-y-1.5">
            <span className="text-xs text-gray-400">Amount (cUSD)</span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="10"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value.replace(/[^0-9.]/g, ''))
                setSuccess(null)
              }}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2.5 text-base text-white outline-none focus:border-brand-green/50"
            />
          </label>
          {exceedsBalance ? (
            <p className="text-xs text-amber-300">Amount exceeds your cUSD balance.</p>
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

      {success ? (
        <div className="space-y-3 rounded-xl border border-brand-green/40 bg-brand-green/10 px-3 py-4 text-sm">
          <p className="font-medium text-brand-green">Donation confirmed</p>
          <p className="text-gray-200">
            {success.amount} cUSD sent to {event.name}.
          </p>
          <a
            href={`https://celoscan.io/tx/${success.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-brand-green/40 bg-brand-green/15 px-3 font-heading text-xs font-semibold uppercase tracking-wide text-brand-green hover:bg-brand-green/25"
          >
            Check your transaction on CeloScan
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
