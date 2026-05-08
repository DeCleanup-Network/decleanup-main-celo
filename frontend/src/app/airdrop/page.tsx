'use client'

import { FormEvent, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { claimCdcu } from '@/lib/blockchain/claim-vault'
import { Button } from '@/components/ui/button'
import { Loader2, Gift, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'

const WalletConnect = dynamic(
  () =>
    import('@/features/wallet/components/WalletConnect').then((m) => ({
      default: m.WalletConnect,
    })),
  { ssr: false }
)

type CheckResponse = {
  eligible: boolean
  walletAddress?: string
  amountCdcu?: string
  amountWei?: string
  claimableWei?: string
  category?: string
  label?: string
  claimed?: boolean
  error?: string
}

export default function AirdropPage() {
  const { address, isConnected } = useAccount()
  const { client: gaslessClient } = useSmartAccountClient()
  const [inputAddress, setInputAddress] = useState('')
  const [checkedAddress, setCheckedAddress] = useState('')
  const [checkLoading, setCheckLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const normalizedChecked = checkedAddress.toLowerCase()
  const normalizedConnected = (address ?? '').toLowerCase()
  const walletMatches = isConnected && normalizedChecked !== '' && normalizedChecked === normalizedConnected
  const hasClaimable = (result?.claimableWei ? BigInt(result.claimableWei) : 0n) > 0n
  const canClaim = Boolean(result?.eligible && hasClaimable && walletMatches && !result?.claimed)

  const checkDisabled = useMemo(() => !isAddress(inputAddress.trim()) || checkLoading, [inputAddress, checkLoading])

  async function handleCheck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setResult(null)
    const value = inputAddress.trim()
    if (!isAddress(value)) {
      setError('Please enter a valid wallet address.')
      return
    }

    setCheckLoading(true)
    try {
      const res = await fetch(`/api/airdrop/check?address=${encodeURIComponent(value)}`)
      const data = (await res.json().catch(() => ({}))) as CheckResponse
      if (!res.ok) {
        setError(data?.error || `Check failed (${res.status})`)
        return
      }
      setCheckedAddress(value)
      setResult(data)
      if (!data.eligible) {
        setMessage('No allocation found for this address.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check allocation')
    } finally {
      setCheckLoading(false)
    }
  }

  async function handleClaim() {
    if (!canClaim || !result?.walletAddress) return
    setClaimLoading(true)
    setError(null)
    setMessage(null)
    try {
      const signRes = await fetch('/api/airdrop/claim-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: result.walletAddress }),
      })
      const signed = await signRes.json().catch(() => ({}))
      if (!signRes.ok) {
        setError(signed?.error || `Claim signing failed (${signRes.status})`)
        return
      }

      await claimCdcu(
        {
          recipient: signed.recipient,
          amount: signed.amount,
          category: signed.category,
          nonce: signed.nonce,
          expiry: signed.expiry,
          v: signed.v,
          r: signed.r,
          s: signed.s,
        },
        {
          gaslessClient: gaslessClient as { sendTransaction: (params: { to: `0x${string}`; value?: bigint; data?: `0x${string}` }) => Promise<`0x${string}`> } | undefined,
          claimerAddress: address as `0x${string}` | undefined,
        }
      )

      await fetch('/api/airdrop/record-issued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: result.walletAddress }),
      })

      setMessage(`Claim submitted for ${result.amountCdcu} cDCU.`)
      setResult((prev) =>
        prev
          ? {
              ...prev,
              claimed: true,
              claimableWei: '0',
            }
          : prev
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Claim failed'
      const userRejected = /user rejected|user denied|rejected the request|denied transaction/i.test(msg)
      if (userRejected && result?.walletAddress) {
        await fetch('/api/airdrop/clear-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipient: result.walletAddress }),
        }).catch(() => {})
      }
      setError(msg)
    } finally {
      setClaimLoading(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Gift className="h-5 w-5 text-brand-green" />
          <h1 className="font-bebas text-3xl tracking-wider">Early Supporters Airdrop</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Connect the same wallet you checked with only when you are ready to claim.
        </p>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <p className="mb-3 text-sm text-foreground">
          Check your eligibility by pasting your wallet address below.
        </p>
        <form onSubmit={handleCheck} className="space-y-3">
          <label htmlFor="airdrop-address" className="block text-sm font-medium text-muted-foreground">
            Wallet address
          </label>
          <input
            id="airdrop-address"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-green"
            placeholder="Paste 0x…"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button type="submit" disabled={checkDisabled} className="bg-brand-green text-black hover:bg-brand-green/90">
            {checkLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Check'
            )}
          </Button>
        </form>
      </section>

      {result?.eligible && (
        <section className="rounded-2xl border border-brand-green/40 bg-brand-green/5 p-5 sm:p-6">
          <div className="mb-3 flex items-center gap-2 text-brand-green">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-bebas text-2xl tracking-wider">Allocation Found</h2>
          </div>
          <div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Address:</span> {result.walletAddress}</p>
            <p><span className="text-muted-foreground">Amount:</span> {result.amountCdcu} cDCU</p>
            <p><span className="text-muted-foreground">Category:</span> {result.category}</p>
            <p><span className="text-muted-foreground">Label:</span> {result.label}</p>
          </div>

          {!walletMatches && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
              <p className="mb-2 flex items-center gap-2 text-yellow-300">
                <AlertTriangle className="h-4 w-4" />
                Connect the same wallet to claim
              </p>
              <WalletConnect />
              {isConnected && normalizedConnected !== normalizedChecked && (
                <p className="mt-2 text-xs text-yellow-200">
                  Connected wallet does not match checked address.
                </p>
              )}
            </div>
          )}

          {walletMatches && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={handleClaim}
                disabled={!canClaim || claimLoading}
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {claimLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Claiming...
                  </>
                ) : result.claimed ? (
                  'Already claimed'
                ) : !hasClaimable ? (
                  'No claimable amount'
                ) : (
                  `Claim ${result.amountCdcu} cDCU`
                )}
              </Button>
            </div>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-brand-green">{message}</p>}
    </main>
  )
}
