'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isAddress, type Address } from 'viem'
import { claimCdcu } from '@/lib/blockchain/claim-vault'
import { ensureRequiredChain } from '@/lib/blockchain/ensure-required-chain'
import { Button } from '@/components/ui/button'
import { Loader2, Gift, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useEmbeddedAuth } from '@/hooks/useEmbeddedAuth'
import { useWallet } from '@/providers/WalletProvider'
import {
  airdropPageUrl,
  clearPendingAirdropAddress,
  readPendingAirdropAddress,
  savePendingAirdropAddress,
} from '@/lib/airdrop/pending-session'
import { isAaAuthEnabledClient } from '@/lib/auth/is-aa-auth-enabled'
import { PastContributorBadge } from '@/components/badges/PastContributorBadge'

type CheckResponse = {
  eligible: boolean
  walletAddress?: string
  amountCdcu?: string
  amountWei?: string
  claimableWei?: string
  category?: string
  label?: string
  claimed?: boolean
  pastContributorBadge?: boolean
  error?: string
}

type Props = {
  /** Pre-fill from home banner or external link */
  initialAddress?: string
}

export function AirdropClaimPanel({ initialAddress }: Props) {
  const searchParams = useSearchParams()
  const aaEnabled = isAaAuthEnabledClient()
  const { isEmbeddedAccount } = useEmbeddedAuth()
  const { address: appAddress, showMainApp, wagmiConnected } = useAppWalletAddress()
  const {
    smartAccountAddress: embeddedSmartAddress,
    getGaslessClient,
    hasActiveSigningSession,
  } = useWallet()

  const [inputAddress, setInputAddress] = useState('')
  const [checkedAddress, setCheckedAddress] = useState('')
  const [checkLoading, setCheckLoading] = useState(false)
  const [claimLoading, setClaimLoading] = useState(false)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoCheckedRef = useRef<string | null>(null)

  const connectedClaimAddress = useMemo((): Address | undefined => {
    if (isEmbeddedAccount) {
      return embeddedSmartAddress ?? undefined
    }
    if (wagmiConnected && appAddress) return appAddress
    return undefined
  }, [isEmbeddedAccount, embeddedSmartAddress, wagmiConnected, appAddress])

  const normalizedChecked = checkedAddress.toLowerCase()
  const normalizedConnected = (connectedClaimAddress ?? '').toLowerCase()
  const isSignedIn = aaEnabled ? showMainApp : Boolean(connectedClaimAddress)
  const walletLoading =
    isSignedIn && isEmbeddedAccount && !connectedClaimAddress && checkedAddress !== ''
  const walletMatches =
    isSignedIn && normalizedChecked !== '' && normalizedChecked === normalizedConnected
  const hasClaimable = (result?.claimableWei ? BigInt(result.claimableWei) : 0n) > 0n
  const canClaim = Boolean(result?.eligible && hasClaimable && walletMatches && !result?.claimed)
  const needsEmbeddedUnlock =
    isEmbeddedAccount && !hasActiveSigningSession && !wagmiConnected

  const checkDisabled = useMemo(() => !isAddress(inputAddress.trim()) || checkLoading, [inputAddress, checkLoading])

  const runCheck = useCallback(async (value: string) => {
    setError(null)
    setMessage(null)
    setResult(null)
    const trimmed = value.trim()
    if (!isAddress(trimmed)) {
      setError('Please enter a valid wallet address.')
      return
    }

    setCheckLoading(true)
    try {
      const res = await fetch(`/api/airdrop/check?address=${encodeURIComponent(trimmed)}`)
      const data = (await res.json().catch(() => ({}))) as CheckResponse
      if (!res.ok) {
        setError(data?.error || `Check failed (${res.status})`)
        return
      }
      setCheckedAddress(trimmed)
      setInputAddress(trimmed)
      setResult(data)
      if (data.eligible && BigInt(data.claimableWei ?? '0') > 0n && !data.claimed) {
        savePendingAirdropAddress(trimmed)
      } else {
        clearPendingAirdropAddress()
        setMessage('No allocation found for this address.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check allocation')
    } finally {
      setCheckLoading(false)
    }
  }, [])

  async function handleCheck(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    await runCheck(inputAddress)
  }

  // Restore address from URL, session, or prop — then auto-check once
  useEffect(() => {
    const fromUrl = searchParams.get('address')?.trim()
    const fromSession = readPendingAirdropAddress()
    const candidate = fromUrl || initialAddress || fromSession || ''
    if (!candidate || !isAddress(candidate)) return
    if (autoCheckedRef.current === candidate.toLowerCase()) return
    autoCheckedRef.current = candidate.toLowerCase()
    setInputAddress(candidate)
    void runCheck(candidate)
  }, [searchParams, initialAddress, runCheck])

  async function handleClaim() {
    if (!canClaim || !result?.walletAddress) return
    setClaimLoading(true)
    setError(null)
    setMessage(null)
    try {
      let gaslessClient:
        | { sendTransaction: (params: { to: Address; value?: bigint; data?: `0x${string}` }) => Promise<`0x${string}`> }
        | undefined

      if (!isEmbeddedAccount && wagmiConnected) {
        try {
          await ensureRequiredChain()
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Please switch MetaMask to Celo Sepolia Testnet.')
          return
        }
      }

      if (isEmbeddedAccount) {
        if (!hasActiveSigningSession) {
          setError(
            'Unlock your wallet passkey in Smart account settings first, or connect MetaMask with CELO to pay gas for this claim.'
          )
          return
        }
        const gasless = await getGaslessClient()
        if (!gasless) {
          setError(
            'Could not start sponsored gas. Unlock your wallet again, or connect MetaMask with CELO on the correct network.'
          )
          return
        }
        gaslessClient = gasless
      }

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
          gaslessClient,
          claimerAddress: connectedClaimAddress,
        }
      )

      await fetch('/api/airdrop/record-issued', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: result.walletAddress }),
      })

      clearPendingAirdropAddress()
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

  const loginCallbackUrl = checkedAddress
    ? airdropPageUrl(checkedAddress)
    : '/airdrop'

  return (
    <>
      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-brand-green" />
          <h1 className="font-bebas text-3xl tracking-wider">Early Supporters Airdrop</h1>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
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
              'Check eligibility'
            )}
          </Button>
        </form>
      </section>

      {result?.eligible && (
        <section className="rounded-2xl border border-brand-green/40 bg-brand-green/5 p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-brand-green">
            <CheckCircle2 className="h-5 w-5" />
            <h2 className="font-bebas text-2xl tracking-wider">Allocation found</h2>
            {result.pastContributorBadge || (result.claimed && result.category === 'past_contributor') ? (
              <PastContributorBadge />
            ) : null}
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Address:</span> {result.walletAddress}
            </p>
            <p>
              <span className="text-muted-foreground">Amount:</span> {result.amountCdcu} cDCU
            </p>
            <p>
              <span className="text-muted-foreground">Category:</span> {result.category}
            </p>
            <p>
              <span className="text-muted-foreground">Label:</span> {result.label}
            </p>
          </div>

          {!isSignedIn && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
              <p className="mb-3 flex items-center gap-2 text-yellow-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Sign in with the wallet that owns this address to claim
              </p>
              <Button asChild className="w-full bg-brand-green text-black hover:bg-brand-green/90 sm:w-auto">
                <Link href={`/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`}>
                  Sign in to claim {result.amountCdcu} cDCU
                </Link>
              </Button>
              <p className="mt-2 text-xs text-yellow-200/90">
                After sign-in you will land back here — no need to enter your address again.
              </p>
            </div>
          )}

          {isSignedIn && walletLoading && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your wallet…
            </div>
          )}

          {isSignedIn && !walletLoading && !walletMatches && (
            <div className="mt-4 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm">
              <p className="flex items-center gap-2 text-yellow-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Connected wallet does not match this allocation
              </p>
              {connectedClaimAddress ? (
                <p className="mt-2 text-xs text-yellow-200">
                  Signed in as {connectedClaimAddress}. Switch account or sign in with the wallet that
                  matches {checkedAddress}.
                </p>
              ) : (
                <p className="mt-2 text-xs text-yellow-200">Waiting for your wallet to finish loading…</p>
              )}
            </div>
          )}

          {walletMatches && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => void handleClaim()}
                disabled={!canClaim || claimLoading || needsEmbeddedUnlock}
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
              {!hasClaimable && !result.claimed && walletMatches ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-200"
                  onClick={() => void runCheck(checkedAddress)}
                >
                  Refresh eligibility
                </Button>
              ) : null}
              {isEmbeddedAccount && !hasActiveSigningSession && (
                <p className="text-xs text-amber-300">
                  <Link href="/wallet" className="underline">
                    Unlock in Smart account settings
                  </Link>{' '}
                  before claiming (or connect MetaMask with CELO).
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-brand-green">{message}</p>}
    </>
  )
}
