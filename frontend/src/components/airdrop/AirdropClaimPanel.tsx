'use client'

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { isAddress, type Address } from 'viem'
import { useChainId, useConfig } from 'wagmi'
import { claimCdcu } from '@/lib/blockchain/claim-vault'
import { shouldShowMobileWalletConnectHint, needsWalletConnectSettle } from '@/lib/blockchain/wallet-provider-write'
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from '@/lib/blockchain/chain-constants'
import { switchToRequiredChain } from '@/lib/blockchain/switch-to-required-chain'
import { waitForWalletConnectChainReady } from '@/lib/blockchain/wait-for-wc-chain-ready'
import { getAccount } from '@wagmi/core'
import { formatAddress } from '@/lib/utils/format-address'
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
import { useClientMounted } from '@/hooks/useClientMounted'

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

type ClaimSignResult = {
  ok: boolean
  signed?: Record<string, unknown>
  error?: string
  status?: number
}

export function AirdropClaimPanel({ initialAddress }: Props) {
  const searchParams = useSearchParams()
  const config = useConfig()
  const chainId = useChainId()
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
  const [switchLoading, setSwitchLoading] = useState(false)
  const [claimPhase, setClaimPhase] = useState<string | null>(null)
  const [result, setResult] = useState<CheckResponse | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const autoCheckedRef = useRef<string | null>(null)
  const signPrefetchRef = useRef<Promise<ClaimSignResult> | null>(null)
  const mounted = useClientMounted()

  const wrongNetwork =
    mounted && !isEmbeddedAccount && wagmiConnected && chainId !== REQUIRED_CHAIN_ID

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

  const fetchClaimSignature = useCallback(async (recipient: string): Promise<ClaimSignResult> => {
    const signRes = await fetch('/api/airdrop/claim-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipient }),
      signal: AbortSignal.timeout(30_000),
    })
    const signed = (await signRes.json().catch(() => ({}))) as Record<string, unknown>
    return {
      ok: signRes.ok,
      signed,
      error: typeof signed.error === 'string' ? signed.error : undefined,
      status: signRes.status,
    }
  }, [])

  // Prefetch claim signature as soon as claimable is known.
  useEffect(() => {
    if (!canClaim || !result?.walletAddress) {
      signPrefetchRef.current = null
      return
    }
    if (!signPrefetchRef.current) {
      signPrefetchRef.current = fetchClaimSignature(result.walletAddress)
    }
  }, [canClaim, result?.walletAddress, fetchClaimSignature])

  async function handleSwitchNetwork() {
    setSwitchLoading(true)
    setError(null)
    try {
      const ok = await switchToRequiredChain(config)
      if (!ok) {
        setError(`Could not switch to ${REQUIRED_CHAIN_NAME}. Open your wallet app and select Celo, then try again.`)
        return
      }
      setMessage(`On ${REQUIRED_CHAIN_NAME}. Tap Claim to confirm the transaction in your wallet.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network switch failed')
    } finally {
      setSwitchLoading(false)
    }
  }

  async function handleClaim() {
    if (!canClaim || !result?.walletAddress) return

    setClaimLoading(true)
    setClaimPhase('Opening wallet…')
    setError(null)
    setMessage(null)
    try {
      let gaslessClient:
        | { sendTransaction: (params: { to: Address; value?: bigint; data?: `0x${string}` }) => Promise<`0x${string}`> }
        | undefined

      if (isEmbeddedAccount) {
        if (!hasActiveSigningSession) {
          setError(
            'Unlock your wallet passkey in Smart account settings first, or connect MetaMask with CELO to pay gas for this claim.'
          )
          return
        }
        setClaimPhase('Preparing sponsored transaction…')
        const gasless = await getGaslessClient()
        if (!gasless) {
          setError(
            'Could not start sponsored gas. Unlock your wallet again, or connect MetaMask with CELO on the correct network.'
          )
          return
        }
        gaslessClient = gasless
      }

      const externalWallet = !isEmbeddedAccount && wagmiConnected
      if (externalWallet) {
        const onChain = getAccount(config).chainId === REQUIRED_CHAIN_ID
        if (!onChain) {
          if (!signPrefetchRef.current) {
            signPrefetchRef.current = fetchClaimSignature(result.walletAddress)
          }
          setClaimPhase('Switch to Celo in your wallet…')
          const switched = await switchToRequiredChain(config)
          if (!switched) {
            signPrefetchRef.current = null
            setError(
              `Switch to ${REQUIRED_CHAIN_NAME} in your wallet app, return to Safari, then try Claim again.`
            )
            return
          }
        } else if (needsWalletConnectSettle(config)) {
          setClaimPhase('Preparing connection…')
          if (!signPrefetchRef.current) {
            signPrefetchRef.current = fetchClaimSignature(result.walletAddress)
          }
          await waitForWalletConnectChainReady(config, { skipVisibilityWait: true })
        }
      }

      setClaimPhase('Preparing claim…')
      const signResult = await (signPrefetchRef.current ?? fetchClaimSignature(result.walletAddress))
      signPrefetchRef.current = null

      if (!signResult.ok) {
        setError(signResult.error || `Claim signing failed (${signResult.status ?? 'unknown'})`)
        return
      }
      const signed = signResult.signed as {
        recipient: Address
        amount: string
        category: number
        nonce: string
        expiry: number
        v: number
        r: `0x${string}`
        s: `0x${string}`
      }

      if (externalWallet) {
        setClaimPhase('Approving claim')
      } else if (gaslessClient) {
        setClaimPhase('Submitting sponsored claim…')
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
          preferConnectedWallet: externalWallet,
          skipSwitch: true,
          skipSettle: true,
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
      setClaimPhase(null)
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
            className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-xs break-all outline-none focus:border-brand-green sm:text-sm"
            placeholder="Paste 0x…"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <Button
            type="submit"
            disabled={checkDisabled}
            className="w-full bg-brand-green text-black hover:bg-brand-green/90 sm:w-auto"
          >
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
          <div className="space-y-2 text-sm">
            <p className="min-w-0">
              <span className="text-muted-foreground">Address: </span>
              <span
                className="font-mono text-xs break-all text-foreground sm:text-sm"
                title={result.walletAddress}
              >
                {result.walletAddress}
              </span>
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
              <Button asChild className="w-full bg-brand-green text-black hover:bg-brand-green/90">
                <Link href={`/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`}>
                  Sign in to claim
                </Link>
              </Button>
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
                <p className="mt-2 text-xs text-yellow-200 break-words">
                  Signed in as{' '}
                  <span className="font-mono" title={connectedClaimAddress}>
                    {formatAddress(connectedClaimAddress)}
                  </span>
                  . Use the wallet that matches{' '}
                  <span className="font-mono" title={checkedAddress}>
                    {formatAddress(checkedAddress)}
                  </span>
                  .
                </p>
              ) : (
                <p className="mt-2 text-xs text-yellow-200">Waiting for your wallet to finish loading…</p>
              )}
            </div>
          )}

          {walletMatches && (
            <div className="mt-4 flex flex-col gap-3">
              {shouldShowMobileWalletConnectHint(wagmiConnected) && !isEmbeddedAccount && (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                  On this phone browser, use{' '}
                  <Link href={`/login?callbackUrl=${encodeURIComponent(loginCallbackUrl)}`} className="underline">
                    WalletConnect
                  </Link>{' '}
                  — otherwise the claim transaction will not appear.
                </p>
              )}
              {wrongNetwork && (
                <p className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
                  Your wallet is on Ethereum (chain {chainId}). Switch to {REQUIRED_CHAIN_NAME} before claiming.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => void handleClaim()}
                disabled={!canClaim || claimLoading || needsEmbeddedUnlock}
                className="min-h-11 w-full shrink-0 bg-brand-green px-4 text-black hover:bg-brand-green/90 sm:w-auto sm:min-w-[10rem]"
              >
                {claimLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />
                    <span className="truncate">{claimPhase ?? 'Confirm in wallet'}</span>
                  </>
                ) : result.claimed ? (
                  'Already claimed'
                ) : !hasClaimable ? (
                  'Nothing to claim'
                ) : wrongNetwork ? (
                  `Claim on ${REQUIRED_CHAIN_NAME}`
                ) : (
                  `Claim ${result.amountCdcu} cDCU`
                )}
              </Button>
              {wrongNetwork ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-gray-600 text-gray-200"
                  onClick={() => void handleSwitchNetwork()}
                  disabled={switchLoading || claimLoading}
                >
                  {switchLoading ? 'Switching…' : 'Switch only'}
                </Button>
              ) : null}
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
              {claimLoading && claimPhase ? (
                <p className="w-full text-xs text-muted-foreground" role="status">
                  {claimPhase}
                </p>
              ) : !wrongNetwork && !isEmbeddedAccount && wagmiConnected && hasClaimable && !result.claimed ? (
                <p className="w-full text-xs text-muted-foreground">
                  Approve the transaction in your wallet (Rainbow, Zerion, or MetaMask). Keep Safari open. You need a
                  small amount of CELO for gas.
                </p>
              ) : wrongNetwork && hasClaimable && !result.claimed ? (
                <p className="w-full text-xs text-muted-foreground">
                  One tap: we switch you to Celo, then open the claim transaction in your wallet.
                </p>
              ) : null}
              </div>
            </div>
          )}
        </section>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-brand-green">{message}</p>}
    </>
  )
}
