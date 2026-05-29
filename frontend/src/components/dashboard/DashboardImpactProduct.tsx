'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Award, ExternalLink, Wallet, Info, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_IS_TESTNET } from '@/lib/blockchain/chain-constants'
import { getImpactProductImagePath, getImpactProductAnimationPath } from '@/lib/utils/impact-product'
import { proxyIpfsHttpUrl } from '@/lib/utils/ipfs-gateway-proxy'
import { ImpactProductLevelHelp } from '@/components/dashboard/ImpactProductLevelHelp'
import { SectionHeading } from '@/components/dashboard/SectionHeading'
import { cn } from '@/lib/utils'

/** Replace typographic dashes in user-facing copy (metadata can contain U+2014). */
function stripLongDashes(s: string): string {
  return s.replace(/\u2014/g, '-').replace(/\u2013/g, '-')
}

function isDcuArtworkTrait(traitType: string): boolean {
  const t = traitType.trim().toLowerCase()
  if (!t) return false
  if (t === 'dcu' || t === '$dcu') return true
  if (t.includes('dcu') && (t.includes('artwork') || t.includes('token') || t.includes('display'))) return true
  return false
}

interface ImpactProductProps {
  level: number
  imageUrl: string
  animationUrl: string
  tokenId: bigint | null
  contractAddress: string
  metadataName: string | null
  metadataDescription: string | null
  metadataExternalUrl: string | null
  metadataAttributes: { trait_type: string; value: string }[]
  verifiedCleanupsCount?: number | null
  className?: string
}

export function DashboardImpactProduct({
  level,
  imageUrl,
  animationUrl,
  tokenId,
  contractAddress,
  metadataName,
  metadataDescription,
  metadataExternalUrl,
  metadataAttributes,
  verifiedCleanupsCount,
  className,
}: ImpactProductProps) {
  const [imageLoading, setImageLoading] = useState(true)
  const [addWalletMessage, setAddWalletMessage] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [copiedField, setCopiedField] = useState<'contract' | 'token' | null>(null)
  /** DOM `setTimeout` / `clearTimeout` use numeric handles (not Node `Timeout`). */
  const copyResetTimerRef = useRef<number | null>(null)

  const openDetails = useCallback(() => setDetailsOpen(true), [])
  const closeDetails = useCallback(() => setDetailsOpen(false), [])

  useEffect(() => {
    if (!detailsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDetails()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [detailsOpen, closeDetails])

  useEffect(() => {
    if (!detailsOpen) {
      setCopiedField(null)
      if (copyResetTimerRef.current) {
        window.clearTimeout(copyResetTimerRef.current)
        copyResetTimerRef.current = null
      }
    }
  }, [detailsOpen])

  const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
  const gateway = 'https://ipfs.io/ipfs/'

  const rawImage =
    imageUrl ||
    (level > 0 ? `${gateway}${imagesCID}/IP${level === 10 ? '10Placeholder' : level}.png` : null) ||
    getImpactProductImagePath(level)
  const rawAnimation =
    animationUrl ||
    (level === 10 ? `${gateway}${imagesCID}/IP10VIdeo.mp4` : null) ||
    (level === 10 ? getImpactProductAnimationPath() : null)
  const imageUrlToUse = proxyIpfsHttpUrl(rawImage)
  const animationUrlToUse = rawAnimation ? proxyIpfsHttpUrl(rawAnimation) : null

  useEffect(() => {
    if (imageUrlToUse) {
      setImageLoading(true)
    }
  }, [imageUrlToUse])

  const contractExplorerUrl =
    contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress)
      ? `${REQUIRED_BLOCK_EXPLORER_URL}/address/${contractAddress}`
      : null

  const traitsForDisplay = metadataAttributes.filter((row) => !isDcuArtworkTrait(row.trait_type))

  const cleanupMilestone =
    typeof verifiedCleanupsCount === 'number' && Number.isFinite(verifiedCleanupsCount)
      ? verifiedCleanupsCount
      : null

  const safeDescription = metadataDescription ? stripLongDashes(metadataDescription) : null

  async function copyToClipboard(text: string, field: 'contract' | 'token') {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      if (copyResetTimerRef.current) window.clearTimeout(copyResetTimerRef.current)
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedField(null)
        copyResetTimerRef.current = null
      }, 2000)
    } catch {
      setAddWalletMessage('Could not copy. Select the text below and copy manually.')
    }
  }

  async function handleAddNftToWallet() {
    setAddWalletMessage(null)
    if (!contractAddress || tokenId == null) {
      setAddWalletMessage('Mint your Impact Product first to get a token ID, then add it here.')
      return
    }
    const eth = typeof window !== 'undefined' ? (window as unknown as { ethereum?: { request?: (a: unknown) => Promise<unknown> } }).ethereum : undefined
    if (!eth?.request) {
      setAddWalletMessage('Open this app in a browser wallet (e.g. MetaMask) to use one-click import.')
      return
    }
    try {
      await eth.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC721',
          options: {
            address: contractAddress,
            tokenId: tokenId.toString(),
          },
        },
      })
      setAddWalletMessage('If your wallet supports it, the NFT import prompt should appear.')
    } catch (e) {
      setAddWalletMessage(
        e instanceof Error ? e.message : 'Wallet declined or does not support NFT import. Use the steps below.'
      )
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col rounded-2xl border border-border bg-card p-4 sm:p-6', className)}>
      <SectionHeading
        icon={Award}
        className="!flex-row items-center justify-between gap-2"
        aside={
          <div className="flex items-center gap-1">
            <ImpactProductLevelHelp />
            {level > 0 ? (
              <button
                type="button"
                onClick={openDetails}
                className="inline-flex rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50"
                aria-label="Impact Product details, contract, and metadata"
                aria-expanded={detailsOpen}
              >
                <Info className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        }
      >
        Your Impact Product level
      </SectionHeading>

      {level > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-1">
          <div className="relative aspect-[3/4] w-full max-h-[min(560px,100%)] min-h-[200px] max-w-md shrink-0 overflow-hidden rounded-xl border-2 border-brand-green/30 bg-gradient-to-br from-brand-green/5 to-black">
            {imageLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-brand-green/30 border-t-brand-green" />
              </div>
            )}
            <div className="absolute inset-0 p-3 sm:p-5">
              {level === 10 && animationUrlToUse ? (
                <video
                  src={animationUrlToUse}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-contain object-center"
                  onLoadedData={() => setImageLoading(false)}
                  onError={(e) => {
                    setImageLoading(false)
                    const target = e.target as HTMLVideoElement
                    if (imageUrlToUse && target.parentElement) {
                      const img = document.createElement('img')
                      img.src = imageUrlToUse
                      img.className = 'h-full w-full object-contain object-center'
                      img.alt = `Level ${level} Impact Product`
                      target.parentElement.replaceChild(img, target)
                    }
                  }}
                />
              ) : imageUrlToUse ? (
                <img
                  src={imageUrlToUse}
                  alt={`Level ${level} Impact Product`}
                  className="h-full w-full object-contain object-center"
                  loading="lazy"
                  onLoad={() => setImageLoading(false)}
                  onError={() => setImageLoading(false)}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Award className="h-24 w-24 text-gray-700" />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <div className="mb-6 rounded-full border-4 border-brand-green/30 bg-brand-green/10 p-8 sm:p-10">
            <Award className="h-16 w-16 text-brand-green/50 sm:h-20 sm:w-20" />
          </div>
          <h3 className="mb-3 font-bebas text-2xl tracking-wider text-muted-foreground sm:text-3xl">NOT YET MINTED</h3>
          <p className="max-w-xs text-sm text-muted-foreground sm:text-base">Submit your first cleanup to claim Level 1</p>
        </div>
      )}

      {detailsOpen && level > 0 ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="impact-product-details-title"
        >
          <button type="button" className="absolute inset-0 bg-black/80" aria-label="Close" onClick={closeDetails} />
          <div className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <h2 id="impact-product-details-title" className="font-bebas text-xl tracking-wider text-foreground">
                Impact Product details
              </h2>
              <button
                type="button"
                onClick={closeDetails}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 overflow-y-auto px-5 py-4 text-sm" style={{ maxHeight: 'min(70dvh, 560px)' }}>
              <p className="leading-relaxed text-muted-foreground">
                Impact Product is an asset tied to your account. It levels up when cleanups are verified and proves your
                participation in DeCleanup Network. Leveling it up gives you{' '}
                <span className="font-semibold text-foreground">10 DCU points</span> each time.
              </p>

              <div className="rounded-lg border border-brand-green/25 bg-brand-green/5 px-3 py-3">
                <p className="font-bebas text-sm tracking-wide text-brand-green">Your impact at this level</p>
                <p className="mt-1 text-sm text-foreground">
                  {cleanupMilestone != null ? (
                    <>
                      Level <span className="font-semibold text-brand-yellow">{level}</span> reflects{' '}
                      <span className="font-semibold text-brand-yellow">{cleanupMilestone}</span> verified{' '}
                      {cleanupMilestone === 1 ? 'cleanup' : 'cleanups'}. That is proven participation you can show anywhere.
                    </>
                  ) : (
                    <>
                      Level <span className="font-semibold text-brand-yellow">{level}</span> tracks verified cleanups on your
                      Impact Product path. Each step is real environmental work on the network.
                    </>
                  )}
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-bebas text-sm tracking-wider text-brand-green">Asset Info</h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Inspect the collection contract on explorer.
                </p>
                {contractExplorerUrl ? (
                  <a
                    href={contractExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                    title="Open contract in block explorer"
                  >
                    View contract
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <p className="text-xs text-muted-foreground">Contract address not configured.</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  <span className="font-sans text-muted-foreground">Token ID</span>{' '}
                  <span className="font-mono text-foreground">{tokenId != null ? tokenId.toString() : 'Not set'}</span>
                </p>
              </div>

              <div className="space-y-2 border-t border-border/60 pt-4">
                <h3 className="font-bebas text-sm tracking-wider text-brand-green">Metadata</h3>
                {metadataName ? (
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">Name:</span> {stripLongDashes(metadataName)}
                  </p>
                ) : null}
                {safeDescription ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{safeDescription}</p>
                ) : (
                  <p className="text-xs italic text-muted-foreground">No description in token metadata yet.</p>
                )}
                {metadataExternalUrl ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">External link:</span>{' '}
                    <a
                      href={metadataExternalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-medium text-brand-green underline underline-offset-2"
                    >
                      {stripLongDashes(metadataExternalUrl)}
                    </a>
                  </p>
                ) : null}
                {traitsForDisplay.length > 0 ? (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-3 py-2 font-sans font-medium text-muted-foreground">Trait</th>
                          <th className="px-3 py-2 font-sans font-medium text-muted-foreground">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {traitsForDisplay.map((row, i) => (
                          <tr key={`${i}-${row.trait_type}`} className="border-b border-border/60 last:border-0">
                            <td className="px-3 py-2 text-muted-foreground">{stripLongDashes(row.trait_type)}</td>
                            <td className="px-3 py-2 font-medium text-foreground">{stripLongDashes(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 border-t border-border/60 pt-4">
                <h3 className="font-bebas text-sm tracking-wider text-brand-green">Add to your wallet</h3>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Manual import (any wallet)
                  </p>
                  <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground marker:text-brand-green">
                    <li>
                      Open your wallet (browser extension or mobile app). Find{' '}
                      <span className="text-foreground">Import NFT</span>, <span className="text-foreground">Import collectible</span>, or{' '}
                      <span className="text-foreground">NFTs</span> / <span className="text-foreground">Add NFT</span> (wording depends on the app).
                    </li>
                    <li>
                      When asked for the <span className="text-foreground">contract address</span> (sometimes &quot;collection&quot; or &quot;contract&quot;), paste the
                      address below.
                    </li>
                    <li>
                      When asked for the <span className="text-foreground">token ID</span> (sometimes &quot;ID&quot; or &quot;identifier&quot;), enter the number below (same as Asset Info).
                    </li>
                    <li>
                      Confirm and save. The NFT should appear under NFTs / collectibles for this network (
                      {REQUIRED_CHAIN_IS_TESTNET ? 'Celo Sepolia' : 'Celo'}).
                    </li>
                  </ol>
                </div>

                {contractAddress && /^0x[a-fA-F0-9]{40}$/.test(contractAddress) ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                    <div>
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Contract</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 shrink-0 px-2 py-0 text-[10px] font-bebas uppercase text-brand-green hover:bg-brand-green/10"
                          onClick={() => void copyToClipboard(contractAddress, 'contract')}
                        >
                          {copiedField === 'contract' ? 'Copied' : 'Copy'}
                        </Button>
                      </div>
                      <p className="break-all font-mono text-[11px] text-foreground">{contractAddress}</p>
                    </div>
                    {tokenId != null ? (
                      <div>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Token ID</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 px-2 py-0 text-[10px] font-bebas uppercase text-brand-green hover:bg-brand-green/10"
                            onClick={() => void copyToClipboard(tokenId.toString(), 'token')}
                          >
                            {copiedField === 'token' ? 'Copied' : 'Copy'}
                          </Button>
                        </div>
                        <p className="font-mono text-[11px] text-foreground">{tokenId.toString()}</p>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Token ID appears after your Impact Product is minted.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Contract address is not configured in this build.</p>
                )}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Examples</p>
                  <ul className="list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-muted-foreground marker:text-brand-green">
                    <li>
                      <span className="text-foreground">MetaMask (mobile):</span> NFTs tab, then Import NFTs, then paste contract and ID.
                    </li>
                    <li>
                      <span className="text-foreground">MetaMask (extension):</span> Open the NFT / Portfolio area for this network, then use Import NFT if shown.
                    </li>
                    <li>
                      <span className="text-foreground">Rainbow / Coinbase Wallet:</span> NFTs or Collectibles → Add / Import, then paste the same contract and token ID.
                    </li>
                  </ul>
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Optional: some browsers can open a one-click import prompt (works only when the site talks to an injected wallet).
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-brand-green/40 font-bebas text-xs tracking-wider text-brand-green hover:bg-brand-green/10"
                  onClick={() => void handleAddNftToWallet()}
                  disabled={!contractAddress || tokenId == null}
                >
                  <Wallet className="mr-2 h-3.5 w-3.5" aria-hidden />
                  Try wallet import prompt
                </Button>
                {addWalletMessage ? <p className="text-xs text-muted-foreground">{addWalletMessage}</p> : null}
              </div>
            </div>
            <div className="border-t border-border px-5 py-3">
              <Button
                type="button"
                onClick={closeDetails}
                className="w-full bg-brand-green font-bebas uppercase tracking-wider text-black hover:bg-brand-green/90"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
