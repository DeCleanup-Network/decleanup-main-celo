'use client'

import { useState, useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConfig } from 'wagmi'
import { lockedSignMessage } from '@/lib/blockchain/wallet-write-mutex'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, Loader2, Shield, ArrowLeft, MapPin, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import {
    isVerifier,
    getCleanupCounter,
    getCleanupDetailsFresh,
    verifyCleanup,
    rejectCleanup,
    grantVerifierRole
} from '@/lib/blockchain/contracts'
import { getIPFSUrl } from '@/lib/blockchain/ipfs'
import type { Address } from 'viem'
import { REQUIRED_BLOCK_EXPLORER_URL } from '@/lib/blockchain/wagmi'
import { ImpactReportDetails } from '@/components/verifier/ImpactReportDetails'
import {
    fetchHypercertRequestsByStatus,
    approveHypercertRequest,
    rejectHypercertRequest,
} from '@/lib/blockchain/hypercerts/requests'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'
import { buildVerifierContext } from '@/lib/blockchain/hypercerts/aggregation'
import { extractImpactSummaryFromMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { AlertModal } from '@/components/ui/alert-modal'
import { TransactionActionBlock, TransactionWaitNotice } from '@/components/ui/transaction-wait-notice'
import { DeCleanupPageHero } from '@/components/layout/DeCleanupPageHero'
import { VerifierMlScoreBlock } from '@/components/verifier/VerifierMlScoreBlock'
import { OptionalSubmissionVideo } from '@/components/verifier/OptionalSubmissionVideo'
import { TrashAthleteVerifierSection } from '@/components/verifier/TrashAthleteVerifierSection'
import { isAdminOnChain } from '@/lib/verifier/admin-check'
import { filterExcludedSubmissionIds } from '@/lib/submission/excluded-ids'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'

const BLOCK_EXPLORER_URL = REQUIRED_BLOCK_EXPLORER_URL || 'https://celo-sepolia.blockscout.com'

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
    // Additional fields
    hasImpactForm?: boolean
    hasRecyclables?: boolean
    recyclablesPhotoHash?: string
    recyclablesReceiptHash?: string
    impactFormDataHash?: string
    approver?: string
}

interface VerifierApplicationRow {
    id: string
    address: string
    appliedAt: number
    status: 'PENDING' | 'PENDING_ONCHAIN' | 'APPROVED' | 'REJECTED'
    notes?: string
}

const VERIFIER_AUTH_MESSAGE = 'I am requesting access to the DeCleanup Verifier Dashboard. This signature proves I control this wallet address.'
const VERIFIED_VERIFIER_KEY = 'decleanup_verified_verifier'

export default function VerifierPage() {
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const { address, isConnected } = useAccount()
    const config = useConfig()
    const [loading, setLoading] = useState(true)
    const [isVerifierUser, setIsVerifierUser] = useState(false)
    const [isAdminUser, setIsAdminUser] = useState(false)
    const [needsSignature, setNeedsSignature] = useState(false)
    const [cleanups, setCleanups] = useState<CleanupSubmission[]>([])
    const [processingId, setProcessingId] = useState<bigint | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [hypercertRequests, setHypercertRequests] = useState<HypercertRequest[]>([])
    const [trashAthleteChallenges, setTrashAthleteChallenges] = useState<TrashAthleteChallenge[]>([])
    const [verifierContext, setVerifierContext] = useState<any>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)
    const [verifierApplications, setVerifierApplications] = useState<VerifierApplicationRow[]>([])
    const [loadingVerifierApplications, setLoadingVerifierApplications] = useState(false)
    const [processingVerifierAppId, setProcessingVerifierAppId] = useState<string | null>(null)
    const [actionModal, setActionModal] = useState<{ variant: 'success' | 'error'; title: string; message: string | ReactNode } | null>(null)
    const [grantTxInputByAppId, setGrantTxInputByAppId] = useState<Record<string, string>>({})
    const addressRef = useRef<string | undefined>(undefined)
    addressRef.current = address
    const isAdminUserRef = useRef(false)
    isAdminUserRef.current = isAdminUser
    const isVerifierUserRef = useRef(false)
    isVerifierUserRef.current = isVerifierUser
    /** Stale list reads after reject/approve: keep terminal status until the next fetch matches the server. */
    const verifierTerminalPatchRef = useRef<Map<string, VerifierApplicationRow>>(new Map())

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (!isVerifierUser) {
            setHypercertRequests([])
            setVerifierContext(null)
        }
    }, [isVerifierUser])

    useEffect(() => {
        if (!address) {
            setLoading(false)
            setIsVerifierUser(false)
            setIsAdminUser(false)
            setNeedsSignature(false)
            setVerifierApplications([])
            setCleanups([])
            setHypercertRequests([])
            setVerifierContext(null)
            setError(null)
            return
        }

        const wallet = address as Address
        const walletLc = wallet.toLowerCase()
        let cancelled = false

        async function bootstrapVerifierAccess() {
            setLoading(true)
            setError(null)
            setIsVerifierUser(false)
            setIsAdminUser(false)
            setVerifierApplications([])

            try {
                const ok = await isVerifier(wallet)
                if (cancelled || addressRef.current?.toLowerCase() !== walletLc) return

                if (!ok) {
                    try {
                        const raw = localStorage.getItem(VERIFIED_VERIFIER_KEY)
                        if (raw) {
                            const { verifiedAddress } = JSON.parse(raw) as { verifiedAddress?: string }
                            if (verifiedAddress?.toLowerCase() !== walletLc) {
                                localStorage.removeItem(VERIFIED_VERIFIER_KEY)
                            }
                        }
                    } catch {
                        /* ignore */
                    }
                    setNeedsSignature(false)
                    setLoading(false)
                    router.replace('/')
                    return
                }

                const stored = localStorage.getItem(VERIFIED_VERIFIER_KEY)
                if (stored) {
                    try {
                        const { verifiedAddress, timestamp } = JSON.parse(stored) as {
                            verifiedAddress?: string
                            timestamp?: number
                        }
                        if (verifiedAddress?.toLowerCase() !== walletLc) {
                            localStorage.removeItem(VERIFIED_VERIFIER_KEY)
                        } else if (
                            typeof timestamp === 'number' &&
                            Date.now() - timestamp < 24 * 60 * 60 * 1000
                        ) {
                            await verifyAgainstContract(wallet)
                            return
                        }
                    } catch (e) {
                        console.error('Error reading verifier session:', e)
                    }
                }

                setNeedsSignature(true)
                setLoading(false)
            } catch (e) {
                if (cancelled) return
                console.error('Verifier access bootstrap failed:', e)
                setError(e instanceof Error ? e.message : 'Failed to verify wallet')
                setIsVerifierUser(false)
                setIsAdminUser(false)
                setNeedsSignature(true)
                setLoading(false)
            }
        }

        void bootstrapVerifierAccess()
        return () => {
            cancelled = true
        }
    }, [address, router])

    const verifyAgainstContract = async (addr: Address) => {
        setLoading(true)
        setError(null)
        try {
            const status = await isVerifier(addr)
            if (addressRef.current?.toLowerCase() !== addr.toLowerCase()) return

            setIsVerifierUser(status)
            if (status) {
                const adminStatus = await isAdminOnChain(addr)
                if (addressRef.current?.toLowerCase() !== addr.toLowerCase()) return

                isVerifierUserRef.current = true
                setIsAdminUser(adminStatus)
                isAdminUserRef.current = adminStatus
                localStorage.setItem(VERIFIED_VERIFIER_KEY, JSON.stringify({
                    verifiedAddress: addr,
                    timestamp: Date.now(),
                }))
                setNeedsSignature(false)
                void fetchCleanups()
                if (adminStatus) {
                    void fetchVerifierApplications()
                }
            } else {
                setError(`Address ${addr} is not authorized as a verifier.`)
                setIsVerifierUser(false)
                isVerifierUserRef.current = false
                setIsAdminUser(false)
                setNeedsSignature(false)
            }
        } catch (error) {
            console.error('Error verifying against contract:', error)
            setError(`Failed to verify: ${error instanceof Error ? error.message : 'Unknown error'}`)
            setIsVerifierUser(false)
            isVerifierUserRef.current = false
            setIsAdminUser(false)
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

        setError(null)
        setIsSigning(true)
        try {
            const signature = await lockedSignMessage(config, {
                message: VERIFIER_AUTH_MESSAGE,
                account: address,
            })

            if (!signature) {
                setError('Signature request was cancelled or rejected. Please try again.')
                return
            }

            setLoading(true)
            await verifyAgainstContract(address)
        } catch (error: unknown) {
            console.error('Error during signature:', error)
            const msg = error instanceof Error ? error.message : 'Failed to sign message. Please try again.'
            if (/rejected|denied|cancel/i.test(msg)) {
                setError('Signature request was cancelled. Open your wallet app and try again.')
            } else {
                setError(msg)
            }
        } finally {
            setIsSigning(false)
        }
    }

    const signMessageForWallet = async (params: { message: string }) => {
        if (!address) {
            throw new Error('Wallet not connected')
        }
        return lockedSignMessage(config, {
            message: params.message,
            account: address,
        })
    }

    const fetchCleanups = async () => {
        try {
            const count = await getCleanupCounter()
            const submissions: CleanupSubmission[] = []

            // Fetch in reverse order (newest first)
            // Submission IDs are 0-indexed, so we go from count-1 down to 0
            const countNum = Number(count)
            for (let i = countNum - 1; i >= 0; i--) {
                const id = BigInt(i)
                try {
                    const details = await getCleanupDetailsFresh(id)
                    // Only add if submission exists (has non-zero user address)
                    if (details.user && details.user !== '0x0000000000000000000000000000000000000000') {
                        submissions.push({
                            ...details
                        })
                    }
                } catch (err) {
                    console.warn(`Failed to fetch cleanup ${id}`, err)
                }
            }
            setCleanups(filterExcludedSubmissionIds(submissions, (s) => s.id))

            if (isVerifierUserRef.current) {
                try {
                    const pending = await fetchHypercertRequestsByStatus('PENDING')
                    console.log('📋 Pending Hypercert requests:', pending.length)
                    setHypercertRequests(pending)
                    setVerifierContext(buildVerifierContext(pending))
                } catch (reqError) {
                    console.error('Error loading Hypercert requests:', reqError)
                }
                try {
                    if (addressRef.current) {
                        const taRes = await fetch(
                            `/api/trash-athlete/challenges?status=PENDING&reviewer=${encodeURIComponent(addressRef.current)}`,
                            { cache: 'no-store' }
                        )
                        const taData = await taRes.json().catch(() => ({}))
                        if (taRes.ok && Array.isArray(taData.challenges)) {
                            setTrashAthleteChallenges(taData.challenges)
                        } else {
                            setTrashAthleteChallenges([])
                        }
                    }
                } catch (taError) {
                    console.error('Error loading Trash Athlete challenges:', taError)
                    setTrashAthleteChallenges([])
                }
            } else {
                setHypercertRequests([])
                setVerifierContext(null)
                setTrashAthleteChallenges([])
            }
        } catch (error) {
            console.error('Error fetching cleanups:', error)
        }
    }

    const fetchVerifierApplications = async () => {
        setLoadingVerifierApplications(true)
        try {
            const response = await fetch(`/api/verifier/applications?t=${Date.now()}`, { cache: 'no-store' })
            const payload = await response.json()
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to load verifier applications')
            }
            const baseApps = (payload.applications || []) as VerifierApplicationRow[]

            let mergedApps = baseApps
            const hasPending = baseApps.some((a) => a.status === 'PENDING' || a.status === 'PENDING_ONCHAIN')
            if (!hasPending && typeof window !== 'undefined') {
                const lastApplicant = localStorage.getItem('decleanup_last_verifier_applicant')?.trim()
                if (lastApplicant) {
                    const byAddressRes = await fetch(
                        `/api/verifier/applications?address=${encodeURIComponent(lastApplicant)}`,
                        { cache: 'no-store' }
                    )
                    const byAddressPayload = await byAddressRes.json().catch(() => ({}))
                    const app = byAddressPayload?.application as VerifierApplicationRow | null
                    const patch = app ? verifierTerminalPatchRef.current.get(app.id) : undefined
                    if (
                        byAddressRes.ok &&
                        app &&
                        (app.status === 'PENDING' || app.status === 'PENDING_ONCHAIN') &&
                        patch?.status !== 'REJECTED'
                    ) {
                        const exists = baseApps.some((a) => a.id === app.id)
                        if (!exists) {
                            mergedApps = [app, ...baseApps]
                        }
                    }
                }
            }

            const patched: VerifierApplicationRow[] = mergedApps.map((a) => {
                const patch = verifierTerminalPatchRef.current.get(a.id)
                if (!patch) return a
                if (
                    patch.status === 'REJECTED' &&
                    (a.status === 'PENDING' || a.status === 'PENDING_ONCHAIN')
                ) {
                    return {
                        ...a,
                        status: 'REJECTED' as const,
                        notes: patch.notes ?? a.notes,
                    }
                }
                if (patch.status === 'APPROVED' && a.status === 'PENDING_ONCHAIN') {
                    return { ...a, ...patch, status: 'APPROVED' as const }
                }
                if (a.status === patch.status) {
                    verifierTerminalPatchRef.current.delete(a.id)
                }
                return a
            })

            setVerifierApplications(patched)
        } catch (e) {
            console.error('Error loading verifier applications:', e)
        } finally {
            setLoadingVerifierApplications(false)
        }
    }

    useEffect(() => {
        if (!isAdminUser) return
        const intervalId = setInterval(() => {
            void fetchVerifierApplications()
        }, 10_000)
        return () => clearInterval(intervalId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAdminUser])

    const handleApproveVerifierApplication = async (application: VerifierApplicationRow) => {
        if (!address) return
        setProcessingVerifierAppId(application.id)
        setError(null)
        try {
            const initRes = await fetch('/api/verifier/review/init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId: application.id,
                    reviewedBy: address,
                }),
            })
            const initPayload = await initRes.json()
            if (!initRes.ok || !initPayload?.readyForGrant) {
                throw new Error(initPayload?.error || 'Failed to initialize approval')
            }
            setVerifierApplications((prev) =>
                prev.map((item) =>
                    item.id === application.id ? { ...item, status: 'PENDING_ONCHAIN' } : item
                )
            )

            const txHash = await grantVerifierRole(initPayload.applicantAddress as Address)

            const confirmRes = await fetch('/api/verifier/review/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId: application.id,
                    txHash,
                }),
            })
            const confirmPayload = await confirmRes.json()
            if (!confirmRes.ok || !confirmPayload?.success) {
                throw new Error(confirmPayload?.error || 'Failed to confirm approval')
            }
            const confirmed = confirmPayload?.application as VerifierApplicationRow | undefined
            if (confirmed?.id) {
                verifierTerminalPatchRef.current.set(confirmed.id, {
                    ...application,
                    ...confirmed,
                    status: 'APPROVED',
                })
            }
            setVerifierApplications((prev) =>
                prev.map((item) =>
                    item.id === application.id
                        ? {
                              ...item,
                              status: 'APPROVED',
                              ...(confirmed ? { notes: confirmed.notes } : {}),
                          }
                        : item
                )
            )

            await fetchVerifierApplications()
            setActionModal({
                variant: 'success',
                title: 'Verifier approved',
                message: (
                    <>
                        <p className="mb-3 text-gray-300">
                            Verifier role confirmed onchain and application marked approved.
                        </p>
                        <a
                            href={`${BLOCK_EXPLORER_URL}/tx/${txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1 break-all font-medium text-brand-green underline underline-offset-2"
                        >
                            View grantRole transaction
                        </a>
                    </>
                ),
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to approve verifier application'
            setError(message)
            setActionModal({ variant: 'error', title: 'Approve failed', message })
        } finally {
            setProcessingVerifierAppId(null)
        }
    }

    const handleRejectVerifierApplication = async (application: VerifierApplicationRow) => {
        if (!address) return
        setProcessingVerifierAppId(application.id)
        setError(null)
        try {
            const response = await fetch('/api/verifier/review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId: application.id,
                    decision: 'REJECT',
                    reviewedBy: address,
                }),
            })
            const payload = await response.json()
            if (!response.ok || !payload?.success) {
                throw new Error(payload?.error || 'Failed to reject verifier application')
            }
            const updated = payload.application as VerifierApplicationRow | undefined
            if (updated?.id) {
                verifierTerminalPatchRef.current.set(updated.id, {
                    ...application,
                    ...updated,
                    status: 'REJECTED',
                })
            }
            setVerifierApplications((prev) =>
                prev.map((item) =>
                    item.id === application.id
                        ? {
                              ...item,
                              status: 'REJECTED',
                              notes: updated?.notes ?? item.notes,
                          }
                        : item
                )
            )

            await fetchVerifierApplications()
            setActionModal({
                variant: 'success',
                title: 'Application rejected',
                message: 'Verifier application rejected successfully.',
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to reject verifier application'
            setError(message)
            setActionModal({ variant: 'error', title: 'Reject failed', message })
        } finally {
            setProcessingVerifierAppId(null)
        }
    }

    const handleConfirmGrantFromTxHash = async (application: VerifierApplicationRow) => {
        const raw = (grantTxInputByAppId[application.id] || '').trim()
        if (!/^0x[a-fA-F0-9]{64}$/.test(raw)) {
            setActionModal({
                variant: 'error',
                title: 'Invalid transaction',
                message: 'Paste a full 0x… transaction hash from the successful grantRole call.',
            })
            return
        }
        setProcessingVerifierAppId(application.id)
        setError(null)
        try {
            const confirmRes = await fetch('/api/verifier/review/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    applicationId: application.id,
                    txHash: raw,
                }),
            })
            const confirmPayload = await confirmRes.json()
            if (!confirmRes.ok || !confirmPayload?.success) {
                throw new Error(confirmPayload?.error || 'Failed to confirm approval')
            }
            const confirmed = confirmPayload?.application as VerifierApplicationRow | undefined
            if (confirmed?.id) {
                verifierTerminalPatchRef.current.set(confirmed.id, {
                    ...application,
                    ...confirmed,
                    status: 'APPROVED',
                })
            }
            setVerifierApplications((prev) =>
                prev.map((item) =>
                    item.id === application.id
                        ? {
                              ...item,
                              status: 'APPROVED',
                              ...(confirmed ? { notes: confirmed.notes } : {}),
                          }
                        : item
                )
            )
            setGrantTxInputByAppId((prev) => {
                const next = { ...prev }
                delete next[application.id]
                return next
            })
            await fetchVerifierApplications()
            setActionModal({
                variant: 'success',
                title: 'Onchain approval recorded',
                message: 'The grant transaction was confirmed and the application is marked approved.',
            })
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to confirm grant transaction'
            setError(message)
            setActionModal({ variant: 'error', title: 'Confirm failed', message })
        } finally {
            setProcessingVerifierAppId(null)
        }
    }

    const handleVerify = async (id: bigint) => {
        setProcessingId(id)
        setError(null)
        try {
            // Level arg is inert on Celo: verifyCleanup() calls Submission.approveSubmission(id),
            // which ignores level. The user's Impact Product level is set when they mint/upgrade.
            console.log('Starting verification for submission:', id.toString())
            const txHash = await verifyCleanup(id, 1)
            console.log('Verification successful, transaction hash:', txHash)
            if (address) {
                setCleanups((prev) =>
                    prev.map((c) =>
                        c.id === id
                            ? {
                                  ...c,
                                  verified: true,
                                  rejected: false,
                                  level: 1,
                                  approver: address,
                              }
                            : c
                    )
                )
            }
            void fetchCleanups()
            
            const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
            const message = (
                <>
                    <p className="mb-3 text-gray-300">Cleanup verified successfully.</p>
                    <p className="mb-3 font-mono text-xs text-gray-400 break-all">
                        {txHash.slice(0, 10)}…{txHash.slice(-8)}
                    </p>
                    <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 break-all font-medium text-brand-green underline underline-offset-2"
                    >
                        View transaction on explorer
                    </a>
                </>
            )
            setActionModal({ variant: 'success', title: 'Cleanup verified', message })
            setTimeout(() => {
                void fetchCleanups()
            }, 2500)
        } catch (error: any) {
            console.error('Error verifying cleanup:', error)
            const errorMessage = error?.message || 'Failed to verify cleanup. Please check the console for details.'
            setError(errorMessage)
            
            // If error contains a transaction hash, provide a link
            const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{64}/i)
            if (txHashMatch) {
                const txHash = txHashMatch[0]
                const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
                setActionModal({ variant: 'error', title: 'Verify failed', message: `Failed to verify cleanup: ${errorMessage}\n\nTransaction may still be pending. Check: ${txUrl}` })
            } else {
                setActionModal({ variant: 'error', title: 'Verify failed', message: `Failed to verify cleanup: ${errorMessage}` })
            }
        } finally {
            setProcessingId(null)
        }
    }

    const handleReject = async (id: bigint) => {
        setProcessingId(id)
        setError(null)
        try {
            console.log('Starting rejection for submission:', id.toString())
            const txHash = await rejectCleanup(id)
            console.log('Rejection successful, transaction hash:', txHash)
            setCleanups((prev) =>
                prev.map((c) =>
                    c.id === id ? { ...c, verified: false, rejected: true } : c
                )
            )
            void fetchCleanups()

            const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
            const message = (
                <>
                    <p className="mb-3 text-gray-300">Cleanup rejected successfully.</p>
                    <p className="mb-3 font-mono text-xs text-gray-400 break-all">
                        {txHash.slice(0, 10)}…{txHash.slice(-8)}
                    </p>
                    <a
                        href={txUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1 break-all font-medium text-brand-green underline underline-offset-2"
                    >
                        View transaction on explorer
                    </a>
                </>
            )
            setActionModal({ variant: 'success', title: 'Cleanup rejected', message })
            setTimeout(() => {
                void fetchCleanups()
            }, 2500)
        } catch (error: any) {
            console.error('Error rejecting cleanup:', error)
            const errorMessage = error?.message || 'Failed to reject cleanup. Please check the console for details.'
            setError(errorMessage)
            
            // If error contains a transaction hash, provide a link
            const txHashMatch = errorMessage.match(/0x[a-fA-F0-9]{64}/i)
            if (txHashMatch) {
                const txHash = txHashMatch[0]
                const txUrl = `${BLOCK_EXPLORER_URL}/tx/${txHash}`
                setActionModal({ variant: 'error', title: 'Reject failed', message: `Failed to reject cleanup: ${errorMessage}\n\nTransaction may still be pending. Check: ${txUrl}` })
            } else {
                setActionModal({ variant: 'error', title: 'Reject failed', message: `Failed to reject cleanup: ${errorMessage}` })
            }
        } finally {
            setProcessingId(null)
        }
    }

    const handleApproveHypercert = async (requestId: string) => {
        if (!address || !isVerifierUser) return

        setProcessingRequestId(requestId)
        setError(null)
        try {
            console.log('Approving Hypercert request:', requestId)
            
            // Approve the request
            const result = await approveHypercertRequest({
                requestId,
                verifierAddress: address,
                signMessageAsync: signMessageForWallet,
            })
            
            if (!result) {
                throw new Error('Failed to approve request')
            }
            
            console.log('✅ Hypercert request approved:', result.request.id)
            
            const publishNote = result.publishWarning
              ? `\n\nPublish note: ${result.publishWarning}`
              : result.request.atUri
                ? `\n\nLive on Hyperscan.`
                : ''
            
            setActionModal({
                variant: 'success',
                title: 'Hypercert approved',
                message: `Hypercert request approved.${publishNote}\n\nRequest ID: ${requestId}`,
            })
            
            // Refresh the data
            fetchCleanups()
        } catch (error: any) {
            console.error('Error approving Hypercert request:', error)
            const errorMessage = error?.message || 'Unknown error'
            setError(`Failed to approve Hypercert request: ${errorMessage}`)
            setActionModal({ variant: 'error', title: 'Approve failed', message: `Failed to approve Hypercert request:\n\n${errorMessage}` })
        } finally {
            setProcessingRequestId(null)
        }
    }

    const handleRejectHypercert = async (requestId: string) => {
        if (!address || !isVerifierUser) return

        const reason = prompt('Enter rejection reason (optional):')
        
        setProcessingRequestId(requestId)
        setError(null)
        try {
            console.log('Rejecting Hypercert request:', requestId)
            
            // Reject the request
            const rejectedRequest = await rejectHypercertRequest({
                requestId,
                verifierAddress: address,
                reason: reason || undefined,
                signMessageAsync: signMessageForWallet,
            })
            
            if (!rejectedRequest) {
                throw new Error('Failed to reject request')
            }
            
            console.log('❌ Hypercert request rejected:', rejectedRequest.id)
            
            setActionModal({
                variant: 'success',
                title: 'Hypercert rejected',
                message: `Hypercert request rejected.\n\nRequest ID: ${requestId}\n${reason ? `Reason: ${reason}` : ''}`,
            })
            
            // Refresh the data
            fetchCleanups()
        } catch (error: any) {
            console.error('Error rejecting Hypercert request:', error)
            const errorMessage = error?.message || 'Unknown error'
            setError(`Failed to reject Hypercert request: ${errorMessage}`)
            setActionModal({ variant: 'error', title: 'Reject failed', message: `Failed to reject Hypercert request:\n\n${errorMessage}` })
        } finally {
            setProcessingRequestId(null)
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
                            <span className="font-heading text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-border bg-card p-6 text-center">
                        <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
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
                            <span className="font-heading text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-6 text-center">
                        <Shield className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                        <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
                            Sign in to verify
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            Sign a message to prove you control this wallet. Only approved verifier addresses can open the cabinet.
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
                        <TransactionActionBlock pending={isSigning || loading}>
                        <Button
                            onClick={handleSignIn}
                            disabled={isSigning || loading}
                            className="gap-2"
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
                        </TransactionActionBlock>
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
                            <span className="font-heading text-sm tracking-wider">BACK</span>
                        </Button>
                    </Link>
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
                        <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
                        <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
                            Verifier access only
                        </h2>
                        <p className="mb-4 text-sm text-muted-foreground">
                            This wallet is not on the verifier list. Apply from Home if you want to review cleanups.
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
                        <Link href="/">
                            <Button variant="outline" className="border-border">
                                Back to Home
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const pendingCleanups = cleanups.filter(c => !c.verified && !c.rejected)
    const verifiedCleanups = cleanups.filter(c => c.verified)
    const rejectedCleanups = cleanups.filter(c => c.rejected)

    const verifierActionPending =
      processingId !== null || processingRequestId !== null || processingVerifierAppId !== null

    return (
        <div className="min-h-screen bg-background px-4 py-6 sm:py-8">
            <div className="mx-auto max-w-[1200px]">
                <DeCleanupPageHero
                    programWord="VERIFIER"
                    pageTagline="Dashboard"
                    description={
                        <>
                            Review and verify cleanup submissions. Flow:{' '}
                            <span className="text-muted-foreground/90">
                                user submits onchain → server runs AI (YOLO) on photos → you confirm with Verify / Reject
                                onchain.
                            </span>
                        </>
                    }
                    trailing={
                        <Link href="/">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-border bg-card font-heading tracking-wider text-foreground hover:bg-muted"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Home
                            </Button>
                        </Link>
                    }
                />

                {verifierActionPending ? (
                  <div className="mb-4">
                    <TransactionWaitNotice active />
                  </div>
                ) : null}

                {/* Stats */}
                <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="rounded-lg border border-border bg-card p-4">
                        <div className="text-sm text-muted-foreground">Total Cleanups</div>
                        <div className="mt-1 font-heading text-2xl text-foreground">{cleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                        <div className="text-sm text-gray-400">Pending Cleanups</div>
                        <div className="mt-1 font-heading text-2xl text-yellow-400">{pendingCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                        <div className="text-sm text-gray-400">Verified Cleanups</div>
                        <div className="mt-1 font-heading text-2xl text-green-400">{verifiedCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
                        <div className="text-sm text-gray-400">Rejected Cleanups</div>
                        <div className="mt-1 font-heading text-2xl text-red-400">{rejectedCleanups.length}</div>
                    </div>
                    <div className="rounded-lg border border-brand-green/50 bg-brand-green/10 p-4">
                        <div className="text-sm text-gray-400">Your Earnings</div>
                        <div className="mt-1 font-heading text-2xl text-brand-green">
                            {address ? (
                                verifiedCleanups.filter(c => c.approver?.toLowerCase() === address.toLowerCase()).length
                            ) : 0} DCU
                        </div>
                        <div className="mt-1 text-xs text-gray-500">1 DCU per verification</div>
                    </div>
                </div>

                {isAdminUser ? (
                  <div className="mb-8">
                      <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
                          Verifier Applications
                      </h2>
                      {loadingVerifierApplications ? (
                          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                              Loading verifier applications...
                          </div>
                      ) : verifierApplications.filter((a) => a.status === 'PENDING' || a.status === 'PENDING_ONCHAIN').length === 0 ? (
                          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
                              No pending verifier applications.
                          </div>
                      ) : (
                          <div className="space-y-3">
                              {verifierApplications
                                  .filter((a) => a.status === 'PENDING' || a.status === 'PENDING_ONCHAIN')
                                  .map((app) => (
                                      <div key={app.id} className="rounded-lg border border-border bg-card p-4">
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                              <div className="min-w-0 flex-1 space-y-2">
                                                  <p className="font-mono text-xs text-gray-400 break-all">{app.address}</p>
                                                  <p className="text-xs text-muted-foreground">
                                                      Applied: {new Date(app.appliedAt).toLocaleString()}
                                                  </p>
                                                  <p className="text-xs text-muted-foreground">Status: {app.status}</p>
                                                  <Link
                                                      href={`/impact/${app.address}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="inline-flex max-w-full items-center gap-1 break-all text-xs font-medium text-brand-green underline underline-offset-2"
                                                  >
                                                      Impact portfolio
                                                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                                                  </Link>
                                              </div>
                                              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                                                  {app.status === 'PENDING' ? (
                                                      <div className="flex flex-wrap gap-2">
                                                          <Button
                                                              onClick={() => void handleRejectVerifierApplication(app)}
                                                              disabled={processingVerifierAppId === app.id}
                                                              className="bg-red-600 text-white hover:bg-red-700"
                                                              size="sm"
                                                          >
                                                              {processingVerifierAppId === app.id ? (
                                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                              ) : (
                                                                  'Reject'
                                                              )}
                                                          </Button>
                                                          <Button
                                                              onClick={() => void handleApproveVerifierApplication(app)}
                                                              disabled={processingVerifierAppId === app.id}
                                                              className="bg-green-600 text-white hover:bg-green-700"
                                                              size="sm"
                                                          >
                                                              {processingVerifierAppId === app.id ? (
                                                                  <Loader2 className="h-4 w-4 animate-spin" />
                                                              ) : (
                                                                  'Approve'
                                                              )}
                                                          </Button>
                                                      </div>
                                                  ) : (
                                                      <div className="flex w-full max-w-md flex-col gap-2 sm:items-end">
                                                          <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-400 sm:text-right">
                                                              Waiting for onchain confirmation
                                                          </span>
                                                          <p className="text-xs text-muted-foreground sm:text-right">
                                                              If grantRole was sent from another wallet or device, paste the
                                                              transaction hash here to sync the dashboard.
                                                          </p>
                                                          <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
                                                              <input
                                                                  type="text"
                                                                  placeholder="0x… transaction hash"
                                                                  value={grantTxInputByAppId[app.id] || ''}
                                                                  onChange={(e) =>
                                                                      setGrantTxInputByAppId((prev) => ({
                                                                          ...prev,
                                                                          [app.id]: e.target.value,
                                                                      }))
                                                                  }
                                                                  className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground"
                                                              />
                                                              <Button
                                                                  type="button"
                                                                  onClick={() => void handleConfirmGrantFromTxHash(app)}
                                                                  disabled={processingVerifierAppId === app.id}
                                                                  className="shrink-0"
                                                                  size="sm"
                                                              >
                                                                  {processingVerifierAppId === app.id ? (
                                                                      <Loader2 className="h-4 w-4 animate-spin" />
                                                                  ) : (
                                                                      'Confirm tx'
                                                                  )}
                                                              </Button>
                                                          </div>
                                                      </div>
                                                  )}
                                              </div>
                                          </div>
                                      </div>
                                  ))}
                          </div>
                      )}
                  </div>
                ) : null}

                {/* Hypercert queue + impact stats: verifiers (same as review API) */}
                {isVerifierUser && verifierContext && (
                  <div className="mb-6 rounded-xl border border-brand-green/20 bg-card p-6">
                    <div className="mb-4">
                      <h3 className="font-heading text-xl uppercase tracking-wide text-foreground">
                        Hypercert Impact Context
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Live context for verifier-side Hypercert review activity.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                      <div className="rounded-lg border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Requests</p>
                        <p className="mt-1 font-heading text-2xl text-foreground">{verifierContext.totalRequests}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Cleanups</p>
                        <p className="mt-1 font-heading text-2xl text-brand-green">{verifierContext.totalCleanups}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Reports</p>
                        <p className="mt-1 font-heading text-2xl text-brand-yellow">{verifierContext.totalReports}</p>
                      </div>
                      <div className="rounded-lg border border-border bg-background/60 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending / Approved</p>
                        <p className="mt-1 font-heading text-2xl text-foreground">
                          {verifierContext.status.PENDING}/{verifierContext.status.APPROVED}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {isVerifierUser && address && (
                  <TrashAthleteVerifierSection
                    challenges={trashAthleteChallenges}
                    reviewerAddress={address as Address}
                    signMessage={async (message) =>
                      (await signMessageForWallet({ message })) as `0x${string}`
                    }
                    onChanged={() => {
                      void fetchCleanups()
                    }}
                    onNotify={({ variant, title, message }) =>
                      setActionModal({ variant, title, message })
                    }
                  />
                )}

                {isVerifierUser && (
                <div className="mb-8">
                    <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
                        Pending Hypercert Requests
                    </h2>
                    {hypercertRequests.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No pending Hypercert requests to review.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {hypercertRequests.map((request) => (
                                <div key={request.id} className="rounded-lg border border-border bg-card overflow-hidden">
                                    <div className="bg-gray-900 p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-heading text-lg text-foreground">HYPERCERT REQUEST</span>
                                            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">
                                                Pending
                                            </span>
                                        </div>
                                        <p className="font-mono text-xs text-gray-400">ID: {request.id}</p>
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-3">
                                            <p className="mb-2 text-xs text-gray-400">Requester:</p>
                                            <p className="font-mono text-xs text-gray-300 break-all">
                                                {request.requester}
                                            </p>
                                        </div>
                                        
                                        <div className="mb-3 rounded-lg border border-border bg-background p-3">
                                            <p className="mb-2 text-xs font-semibold text-foreground">
                                                Impact Summary
                                            </p>
                                            <div className="space-y-1 text-xs">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Cleanups:</span>
                                                    <span className="font-bold text-foreground">
                                                        {extractImpactSummaryFromMetadata(request.metadata)?.totalCleanups || 0}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-400">Reports:</span>
                                                    <span className="font-bold text-foreground">
                                                        {extractImpactSummaryFromMetadata(request.metadata)?.totalReports || 0}
                                                    </span>
                                                </div>
                                            </div>
                                            {request.metadata?.branding?.title && (
                                                <div className="mt-2 border-t border-border pt-2">
                                                    <p className="text-xs text-gray-400">Title:</p>
                                                    <p className="text-xs text-foreground">
                                                        {request.metadata.branding.title}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <p className="mb-3 text-xs text-gray-400">
                                            Submitted: {new Date(request.submittedAt).toLocaleString()}
                                        </p>
                                        
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleRejectHypercert(request.id)}
                                                disabled={processingRequestId === request.id}
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                                size="sm"
                                            >
                                                {processingRequestId === request.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Reject'
                                                )}
                                            </Button>
                                            <Button
                                                onClick={() => handleApproveHypercert(request.id)}
                                                disabled={processingRequestId === request.id}
                                                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                                size="sm"
                                            >
                                                {processingRequestId === request.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    'Approve'
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                )}

                {/* Pending Cleanups */}
                <div className="mb-8">
                    <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
                        Pending Verification
                    </h2>
                    {pendingCleanups.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No pending cleanups to verify.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {pendingCleanups.map(cleanup => (
                                <div key={cleanup.id.toString()} className="min-w-0 rounded-lg border border-border bg-card overflow-hidden">
                                    <div className="grid grid-cols-2 gap-1 bg-gray-900">
                                        {cleanup.beforePhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.beforePhotoHash)} 
                                                alt="Before" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EBefore%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                Before
                                            </div>
                                        )}
                                        {cleanup.afterPhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.afterPhotoHash)} 
                                                alt="After" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EAfter%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                After
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">ID: {cleanup.id.toString()}</span>
                                            <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-500">Pending</span>
                                        </div>
                                        <p className="mb-2 min-w-0 font-mono text-[11px] leading-snug text-gray-400 break-all">
                                            User: {cleanup.user}
                                        </p>
                                        {/* Additional info badges */}
                                        <div className="mb-3 flex flex-wrap gap-1">
                                            {cleanup.hasImpactForm && (
                                                <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
                                                    Impact Report
                                                </span>
                                            )}
                                            {cleanup.hasRecyclables && (
                                                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                                                    Recyclables
                                                </span>
                                            )}
                                        </div>

                                        <VerifierMlScoreBlock cleanupId={cleanup.id.toString()} />
                                        <OptionalSubmissionVideo submissionId={cleanup.id.toString()} />
                                        
                                        {/* Impact Report Details */}
                                        {cleanup.hasImpactForm && cleanup.impactFormDataHash && (
                                            <div className="mb-3">
                                                <ImpactReportDetails 
                                                    impactReportHash={cleanup.impactFormDataHash}
                                                    cleanupId={cleanup.id}
                                                />
                                            </div>
                                        )}
                                        {address && cleanup.user.toLowerCase() === address.toLowerCase() && (
                                            <p className="mb-3 text-xs text-red-400">
                                                You cannot verify your own submission.
                                            </p>
                                        )}
                                        
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleVerify(cleanup.id)}
                                                disabled={
                                                    processingId === cleanup.id ||
                                                    (address ? cleanup.user.toLowerCase() === address.toLowerCase() : false)
                                                }
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
                    <h2 className="mb-4 font-heading text-2xl uppercase tracking-wide text-foreground">
                        Verified Cleanups
                    </h2>
                    {verifiedCleanups.length === 0 ? (
                        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                            No verified cleanups yet.
                        </div>
                    ) : (
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                            {verifiedCleanups.map(cleanup => (
                                <div key={cleanup.id.toString()} className="min-w-0 rounded-lg border border-border bg-card overflow-hidden opacity-75">
                                    <div className="grid grid-cols-2 gap-1 bg-gray-900">
                                        {cleanup.beforePhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.beforePhotoHash)} 
                                                alt="Before" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EBefore%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                Before
                                            </div>
                                        )}
                                        {cleanup.afterPhotoHash ? (
                                            <img 
                                                src={getIPFSUrl(cleanup.afterPhotoHash)} 
                                                alt="After" 
                                                className="h-32 w-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect width="100" height="100" fill="%23333"/%3E%3Ctext x="50" y="50" text-anchor="middle" fill="%23999" font-size="12"%3EAfter%3C/text%3E%3C/svg%3E'
                                                }}
                                            />
                                        ) : (
                                            <div className="flex h-32 w-full items-center justify-center bg-gray-800 text-xs text-gray-500">
                                                After
                                            </div>
                                        )}
                                    </div>
                                    <div className="p-4">
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className="font-mono text-xs text-gray-400">ID: {cleanup.id.toString()}</span>
                                            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-500">Verified</span>
                                        </div>
                                        <p className="min-w-0 font-mono text-[11px] leading-snug text-gray-400 break-all">
                                            User: {cleanup.user}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {actionModal && (
                <AlertModal
                    isOpen
                    onClose={() => {
                        setActionModal(null)
                        router.refresh()
                    }}
                    title={actionModal.title}
                    message={actionModal.message}
                    variant={actionModal.variant}
                />
            )}
        </div>
    )
}
