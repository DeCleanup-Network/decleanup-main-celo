'use client'

import { useState, useEffect } from 'react'
import { Award, ExternalLink, ChevronDown, Copy, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { REQUIRED_BLOCK_EXPLORER_URL, CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
import { useAccount } from 'wagmi'
import { getHypercertEligibility } from '@/lib/blockchain/contracts'
import { getLevelName, getImpactProductImagePath, getImpactProductAnimationPath, getImpactProductIPFSImageUrl, getImpactProductIPFSAnimationUrl, CONSTANT_TRAITS, LEVEL_PROGRESSION } from '@/lib/utils/impact-product'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'

interface ImpactProductProps {
    level: number
    imageUrl: string
    animationUrl: string
    dcuAttached: number
    impactValue: string | null
    tokenId: bigint | null
    contractAddress: string
}

export function DashboardImpactProduct({
    level,
    imageUrl,
    animationUrl,
    dcuAttached,
    impactValue,
    tokenId,
    contractAddress,
}: ImpactProductProps) {
    const { address } = useAccount()
    const [showManualImport, setShowManualImport] = useState(false)
    const [showMetadata, setShowMetadata] = useState(false)
    const [copying, setCopying] = useState<string | null>(null)
    const [hypercertsEarned, setHypercertsEarned] = useState<number>(0)
    const [loadingStats, setLoadingStats] = useState(false)

    // Level = number of cleanups completed (each level represents one verified cleanup)
    const cleanupsCompleted = level

    useEffect(() => {
        if (address && level > 0) {
            loadHypercertStats()
        }
    }, [address, level])

    const loadHypercertStats = async () => {
        if (!address) return
        setLoadingStats(true)
        try {
            const eligibility = await getHypercertEligibility(address)
            setHypercertsEarned(Number(eligibility.hypercertCount))
        } catch (error) {
            console.error('Error loading hypercert stats:', error)
        } finally {
            setLoadingStats(false)
        }
    }

    const levelName = getLevelName(level)
    // Use specific level number for Impact Value, not a range
    const impactValueToDisplay = impactValue || String(level)
    
    // Prefer IPFS URLs from metadata, then try IPFS with CID, fallback to local paths only if no CID
    const imagesCID = process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
    const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
    
    // Always use IPFS if we have a CID, even if imageUrl prop is empty
    const imageUrlToUse = imageUrl || (level > 0 ? `${gateway}${imagesCID}/IP${level === 10 ? '10Placeholder' : level}.png` : null) || getImpactProductImagePath(level)
    const animationUrlToUse = animationUrl || (level === 10 ? `${gateway}${imagesCID}/IP10VIdeo.mp4` : null) || (level === 10 ? getImpactProductAnimationPath() : null)

    const handleCopy = async (value: string, label: string) => {
        try {
            setCopying(label)
            await navigator.clipboard.writeText(value)
            setTimeout(() => setCopying(null), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
            alert(`${label}: ${value}`)
        }
    }

    const explorerUrl = tokenId && contractAddress
        ? `${REQUIRED_BLOCK_EXPLORER_URL}/token/${contractAddress}?a=${tokenId.toString()}`
        : null

    return (
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 flex flex-col">
            <div className="mb-4 flex items-center gap-2 flex-shrink-0">
                <Award className="h-5 w-5 text-brand-green" />
                <h2 className="font-bebas text-xl sm:text-2xl tracking-wider text-brand-green">
                    IMPACT PRODUCT
                </h2>
            </div>

            {level > 0 ? (
                <div className="space-y-4 flex flex-col">
                    {/* NFT Display */}
                    <div className="w-full overflow-hidden rounded-xl border-2 border-brand-green/30 bg-gradient-to-br from-brand-green/5 to-black flex-shrink-0 flex items-center justify-center p-4 sm:p-6 aspect-[3/4] max-h-[500px]">
                        {level === 10 && animationUrlToUse ? (
                            <video
                                src={animationUrlToUse}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="max-h-full max-w-full object-contain"
                                onError={(e) => {
                                    // Fallback to static image if animation fails
                                    const target = e.target as HTMLVideoElement
                                    if (imageUrlToUse && target.parentElement) {
                                        const img = document.createElement('img')
                                        img.src = imageUrlToUse
                                        img.className = 'max-h-full max-w-full object-contain'
                                        img.alt = `Level ${level} Impact Product`
                                        target.parentElement.replaceChild(img, target)
                                    }
                                }}
                            />
                        ) : imageUrlToUse ? (
                            <img
                                src={imageUrlToUse}
                                alt={`Level ${level} Impact Product`}
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center">
                                <Award className="h-24 w-24 text-gray-700" />
                            </div>
                        )}
                    </div>

                    {/* Stats Grid - Compact - All Same Design */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Level</p>
                            <p className="font-bebas text-lg text-brand-green leading-none">{level}</p>
                        </div>
                        <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">$cDCU</p>
                            <p className="font-bebas text-lg text-brand-green leading-none">{dcuAttached}</p>
                        </div>
                        <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Cleanups</p>
                            <p className="font-bebas text-lg text-brand-green leading-none">{cleanupsCompleted}</p>
                        </div>
                        <div className="rounded-lg border border-brand-green/30 bg-brand-green/5 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase mb-1">Hypercerts</p>
                            <p className="font-bebas text-lg text-brand-green leading-none">{loadingStats ? '...' : hypercertsEarned}</p>
                        </div>
                    </div>

                    {/* Metadata & Actions - Compact */}
                    <div className="flex gap-2">
                    <button
                        onClick={() => setShowMetadata(!showMetadata)}
                            className="flex-1 flex items-center justify-between rounded-lg border border-border bg-background/50 p-2.5 text-left transition-colors hover:bg-brand-green/10 hover:border-brand-green/50"
                    >
                            <span className="font-bebas text-xs tracking-wide text-muted-foreground">
                                METADATA
                        </span>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showMetadata ? 'rotate-180' : ''}`} />
                    </button>
                        {explorerUrl && (
                            <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full border-brand-green/30 font-bebas text-xs tracking-wider text-brand-green hover:bg-brand-green/10 hover:border-brand-green/50 h-auto py-2.5"
                                >
                                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                                    EXPLORER
                                </Button>
                            </a>
                        )}
                    </div>

                    {/* Metadata Panel */}
                    {showMetadata && (
                        <div className="space-y-3 border-t border-brand-green/20 pt-3 flex-shrink-0">
                            {/* Constant Traits */}
                            <div className="space-y-2">
                                <h4 className="font-bebas text-sm tracking-wide text-brand-green">CONSTANT TRAITS</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Type:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Impact:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.impact}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Category:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.category}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Rarity:</span>
                                        <span className="text-white">{CONSTANT_TRAITS.rarity}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Dynamic Traits */}
                            <div className="space-y-2">
                                <h4 className="font-bebas text-sm tracking-wide text-brand-green">DYNAMIC TRAITS</h4>
                                <div className="space-y-1.5 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Impact Value:</span>
                                        <span className="text-white">{impactValueToDisplay}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Level:</span>
                                        <span className="text-white">{levelName}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Cleanups Completed:</span>
                                        <span className="text-white">{cleanupsCompleted}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Hypercerts Earned:</span>
                                        <span className="text-white">{loadingStats ? '...' : hypercertsEarned}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Level Progression Table */}
                            <div className="space-y-2">
                                <h4 className="font-bebas text-sm tracking-wide text-brand-green">LEVEL PROGRESSION</h4>
                                <div className="rounded-lg border border-brand-green/20 bg-black/30 overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="border-b border-brand-green/20 bg-black/50">
                                                <th className="p-2 text-left text-gray-400 font-bebas">Cleanups</th>
                                                <th className="p-2 text-left text-gray-400 font-bebas">Impact Value</th>
                                                <th className="p-2 text-left text-gray-400 font-bebas">Level</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {LEVEL_PROGRESSION.map((row, idx) => (
                                                <tr key={idx} className="border-b border-brand-green/10 last:border-0">
                                                    <td className="p-2 text-white">{row.cleanups}</td>
                                                    <td className="p-2 text-white">{row.impactValue}</td>
                                                    <td className="p-2 text-brand-yellow">{row.level}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Manual Wallet Import */}
                    <div className="rounded-lg border border-border bg-background/50">
                        <button
                            onClick={() => setShowManualImport(!showManualImport)}
                            className="flex w-full items-center justify-between p-2.5 text-left transition-colors hover:bg-brand-green/10 hover:border-brand-green/50 rounded-lg"
                        >
                            <span className="font-bebas text-xs tracking-wide text-muted-foreground">
                                WALLET IMPORT
                            </span>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${showManualImport ? 'rotate-180' : ''}`} />
                        </button>

                        {showManualImport && (
                            <div className="space-y-2.5 border-t border-brand-green/20 p-2.5">
                                <div>
                                    <p className="mb-1 text-xs text-gray-500">Contract Address</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 overflow-hidden text-ellipsis rounded bg-gray-900 px-2 py-1 text-xs text-gray-300">
                                            {contractAddress}
                                        </code>
                                        <button
                                            onClick={() => handleCopy(contractAddress, 'Contract Address')}
                                            className="rounded p-1 hover:bg-gray-800"
                                            title="Copy contract address"
                                        >
                                            {copying === 'Contract Address' ? (
                                                <span className="text-xs text-brand-green">✓</span>
                                            ) : (
                                                <Copy className="h-4 w-4 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {tokenId && (
                                    <div>
                                        <p className="mb-1 text-xs text-gray-500">Collectible ID</p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 overflow-hidden text-ellipsis rounded bg-gray-900 px-2 py-1 text-xs text-gray-300">
                                                {tokenId.toString()}
                                            </code>
                                            <button
                                                onClick={() => handleCopy(tokenId.toString(), 'Collectible ID')}
                                                className="rounded p-1 hover:bg-gray-800"
                                                title="Copy collectible ID"
                                            >
                                                {copying === 'Collectible ID' ? (
                                                    <span className="text-xs text-brand-green">✓</span>
                                                ) : (
                                                    <Copy className="h-4 w-4 text-gray-400" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-2 rounded-lg border border-brand-green/10 bg-brand-green/5 p-2">
                                    <p className="mb-1 text-xs font-semibold text-brand-green">HOW TO IMPORT:</p>
                                    <ol className="space-y-1 text-[10px] text-gray-400 list-decimal list-inside">
                                        <li>Open your wallet (MetaMask, Trust Wallet, etc.)</li>
                                        <li>Go to NFT/Collectibles section</li>
                                        <li>Click "Import NFT" or "Add Custom Token"</li>
                                        <li>Paste the Contract Address above</li>
                                        <li>Enter the Collectible ID above</li>
                                        <li>Save and your Impact Product will appear!</li>
                                    </ol>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center py-8">
                    <div className="mb-6 rounded-full border-4 border-brand-green/30 bg-brand-green/10 p-8 sm:p-10">
                        <Award className="h-16 w-16 sm:h-20 sm:w-20 text-brand-green/50" />
                    </div>
                    <h3 className="mb-3 font-bebas text-2xl sm:text-3xl tracking-wider text-muted-foreground">
                        NOT YET MINTED
                    </h3>
                    <p className="text-sm sm:text-base text-muted-foreground max-w-xs">
                        Submit your first cleanup to claim Level 1
                    </p>
                </div>
            )}
        </div>
    )
}
