'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2, Shield, ArrowLeft, MapPin, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import {
    isVerifier,
    getCleanupCounter,
    getCleanupDetails,
    verifyCleanup,
    rejectCleanup
} from '@/lib/blockchain/contracts'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import type { Address } from 'viem'

interface CleanupSubmission {
    id: bigint
    user: string
    beforePhotoHash: string
    afterPhotoHash: string
    timestamp: bigint
    latitude: bigint
    longitude: bigint
    verified: boolean
    claimed: boolean
    rejected: boolean
    level: number
}

const VERIFIER_AUTH_MESSAGE = 'I am requesting access to the DeCleanup Verifier Dashboard. This signature proves I control this wallet address.'
const VERIFIED_VERIFIER_KEY = 'decleanup_verified_verifier'

export default function VerifierPage() {
    const [mounted, setMounted] = useState(false)
    const { address, isConnected } = useAccount()
    const { signMessageAsync, isPending: isSigning } = useSignMessage()
    const [loading, setLoading] = useState(true)
    const [isVerifierUser, setIsVerifierUser] = useState(false)
    const [needsSignature, setNeedsSignature] = useState(false)
    const [cleanups, setCleanups] = useState<CleanupSubmission[]>([])
    const [processingId, setProcessingId] = useState<bigint | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        setMounted(true)
        if (address) {
            checkStoredVerification()
        } else {
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [address])

    const checkStoredVerification = () => {
        if (!address) {
            setLoading(false)
            return
        }

        // Only access localStorage on client side
        if (typeof window === 'undefined') {
            setNeedsSignature(true)
            setLoading(false)
            return
        }

        try {
            const stored = localStorage.getItem(VERIFIED_VERIFIER_KEY)
            if (stored) {
                const { verifiedAddress, timestamp } = JSON.parse(stored)
                // Check if stored address matches current address and is recent (within 24 hours)
                if (verifiedAddress?.toLowerCase() === address.toLowerCase() && 
                    Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                    // Verify against contract
                    verifyAgainstContract(address)
                    return
                }
            }
        } catch (error) {
            console.error('Error checking stored verification:', error)
        }

        // No stored verification or expired - require signature
        setNeedsSignature(true)
        setLoading(false)
    }

    const verifyAgainstContract = async (addr: Address) => {
        setLoading(true)
        setError(null)
        try {
            const status = await isVerifier(addr)
            setIsVerifierUser(status)
            if (status) {
                // Store verification
                localStorage.setItem(VERIFIED_VERIFIER_KEY, JSON.stringify({
                    verifiedAddress: addr,
                    timestamp: Date.now(),
                }))
                setNeedsSignature(false)
                fetchCleanups()
            } else {
                setError(`Address ${addr} is not authorized as a verifier.`)
                setIsVerifierUser(false)
                setNeedsSignature(true)
            }
        } catch (error) {
            console.error('Error verifying against contract:', error)
            setError(`Failed to verify: ${error instanceof Error ? error.message : 'Unknown error'}`)
            setIsVerifierUser(false)
            setNeedsSignature(true)
        } finally {
            setLoading(false)
        }
    }

    const handleSignIn = async () => {
        if (!address) {
            setError('Please connect your wallet first')
            return
        }

        if (!signMessageAsync) {
            setError('Signature functionality not available. Please ensure your wallet supports message signing.')
            return
        }

        setError(null)
        try {
            const signature = await signMessageAsync({ message: VERIFIER_AUTH_MESSAGE })
            
            if (!signature) {
                setError('Signature request was cancelled or rejected. Please try again.')
                return
            }

            // Now verify against contract
            setLoading(true)
            await verifyAgainstContract(address)
        } catch (error: any) {
            console.error('Error during signature:', error)
            setError(error?.message || 'Failed to sign message. Please try again.')
        }
    }

    const fetchCleanups = async () => {
        try {
            const count = await getCleanupCounter()
            const submissions: CleanupSubmission[] = []

            // Fetch in reverse order (newest first)
            for (let i = Number(count); i >= 1; i--) {
                const id = BigInt(i)
                try {
                    const details = await getCleanupDetails(id)
                    submissions.push({
                        ...details
                      })
                      
                } catch (err) {
                    console.warn(`Failed to fetch cleanup ${id}`, err)
                }
            }
            setCleanups(submissions)
        } catch (error) {
            console.error('Error fetching cleanups:', error)
        }
    }

    const handleVerify = async (id: bigint) => {
        setProcessingId(id)
        try {
            // Default level 1 for now, could add UI to select level
            await verifyCleanup(id, 1)
            alert('Cleanup verified successfully!')
            fetchCleanups()
        } catch (error) {
            console.error('Error verifying cleanup:', error)
            alert('Failed to verify cleanup.')
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (id: bigint) => {
        setProcessingId(id)
        try {
            await rejectCleanup(id)
            alert('Cleanup rejected successfully!')
            fetchCleanups()
        } catch (error) {
            console.error('Error rejecting cleanup:', error)
            alert('Failed to reject cleanup.')
        } finally {
            setProcessingId(null)
        }
    }

    if (!mounted) {
        return <div className="min-h-screen bg-background" />
    }

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-border bg-card p-6 text-center">
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Verifier Login
                        </h2>
                        <p className="mb-6 text-sm text-muted-foreground">
                            Connect your wallet to access the verifier dashboard. Only whitelisted verifier addresses can access this page.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
                    </div>
                </div>
            </div>
        )
    }

    if (needsSignature && !isVerifierUser) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
                        <Shield className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Verifier Authentication Required
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Please sign a message to verify you control this wallet address. Only whitelisted verifier addresses can access this dashboard.
                        </p>
                        {error && (
                            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}
                        <div className="mb-6 space-y-2 text-left">
                            <p className="font-mono text-sm text-gray-500 break-all">
                                <span className="text-gray-400">Your address:</span> {address}
                            </p>
                        </div>
                        <Button
                            onClick={handleSignIn}
                            disabled={isSigning || loading}
                            className="gap-2 bg-brand-green text-black hover:bg-brand-green/90"
                        >
                            {isSigning || loading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {isSigning ? 'Signing...' : 'Verifying...'}
                                </>
                            ) : (
                                <>
                                    <Shield className="h-4 w-4" />
                                    Sign Message to Continue
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    if (!isVerifierUser && !needsSignature) {
        return (
            <div className="min-h-screen bg-background px-4 py-8">
                <div className="container mx-auto max-w-4xl">
                    <Link href="/">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="mb-6 gap-2 text-gray-400 hover:text-white"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span className="font-bebas text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
                        <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                        <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                            Access Denied
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            This address is not authorized as a verifier. Only whitelisted verifier addresses can access this dashboard.
                        </p>
                        {error && (
                            <div className="mb-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
                                {error}
                            </div>
                        )}
                        <div className="mb-6 space-y-2 text-left">
                            <p className="font-mono text-sm text-gray-500 break-all">
                                <span className="text-gray-400">Your address:</span> {address}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const pendingCleanups = cleanups.filter(c => !c.verified && !c.rejected)
    const verifiedCleanups = cleanups.filter(c => c.verified)
    const rejectedCleanups = cleanups.filter(c => c.rejected)

    return (
        <div className="min-h-screen bg-background px-4 py-6 sm:py-8">
            <div className="container mx-auto max-w-6xl">
                <Link href="/">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mb-6 gap-2 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        <span className="font-bebas text-sm tracking-wider">BACK</span>
                    </Button>
                </Link>

                <div className="mb-8">
                    <h1 className="mb-2 font-bebas text-4xl uppercase tracking-wide text-foreground sm:text-5xl">
                        Verifier Dashboard
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Review and verify cleanup submissions.
                    </p>
                </div>

                {/* Stats */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-sm text-muted-foreground">Total Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-foreground">{cleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                        <div className="text-sm text-gray-400">Pending Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-yellow-400">{pendingCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                        <div className="text-sm text-gray-400">Verified Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-green-400">{verifiedCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                        <div className="text-sm text-gray-400">Rejected Cleanups</div>
                        <div className="mt-1 font-bebas text-2xl text-red-400">{rejectedCleanups.length}</div>
                    </div>
                </div>

                {/* Pending Cleanups */}
                <div className="mb-8">
                    <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                        Pending Verification
                    </h2>
                    {pendingCleanups.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No pending cleanups to verify.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {pendingCleanups.map(cleanup => (
                                <div key={cleanup.id.toString()} className="rounded-lg border border-border bg-card overflow-hidden">
                                    <div className="grid grid-cols-2 gap-1">
                                        <img src={getIPFSUrl(cleanup.beforePhotoHash)} alt="Before" className="h-32 w-full object-cover" />
                                        <img src={getIPFSUrl(cleanup.afterPhotoHash)} alt="After" className="h-32 w-full object-cover" />
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">ID: {cleanup.id.toString()}</span>
                                            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Pending</span>
                                        </div>
                                        <p className="mb-4 font-mono text-xs text-gray-400 truncate">
                                            User: {cleanup.user}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleVerify(cleanup.id)}
                                                disabled={processingId === cleanup.id}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                                size="sm"
                                            >
                                                {processingId === cleanup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
                                            </Button>
                                            <Button
                                                onClick={() => handleReject(cleanup.id)}
                                                disabled={processingId === cleanup.id}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                                size="sm"
                                            >
                                                {processingId === cleanup.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Verified Cleanups */}
                <div className="mb-8">
                    <h2 className="mb-4 font-bebas text-2xl uppercase tracking-wide text-foreground">
                        Verified Cleanups
                    </h2>
                    {verifiedCleanups.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No verified cleanups yet.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {verifiedCleanups.map(cleanup => (
                                <div key={cleanup.id.toString()} className="rounded-lg border border-border bg-card overflow-hidden opacity-75">
                                    <div className="grid grid-cols-2 gap-1">
                                        <img src={getIPFSUrl(cleanup.beforePhotoHash)} alt="Before" className="h-32 w-full object-cover" />
                                        <img src={getIPFSUrl(cleanup.afterPhotoHash)} alt="After" className="h-32 w-full object-cover" />
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">ID: {cleanup.id.toString()}</span>
                                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-500">Verified</span>
                                        </div>
                                        <p className="font-mono text-xs text-gray-400 truncate">
                                            User: {cleanup.user}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
