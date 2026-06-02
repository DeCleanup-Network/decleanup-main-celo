'use client'

import { useState, useEffect, useLayoutEffect, useMemo, useRef, Suspense } from 'react'
import { useSwitchChain } from 'wagmi'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import {
  SignUnlockModal,
  type SignUnlockModalMode,
} from '@/components/aa/SignUnlockModal'
import { AccountReadyBanner } from '@/components/aa/AccountReadyBanner'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FeeDisplay } from '@/components/ui/fee-display'
import { BackButton } from '@/components/layout/BackButton'
import { Camera, Upload, ArrowRight, ArrowLeft, Check, Loader2, ExternalLink, X, Clock, AlertCircle, Users, CheckCircle, Award } from 'lucide-react'
import { uploadToIPFS, uploadJSONToIPFS } from '@/lib/blockchain/ipfs'
import { submitCleanup, getSubmissionFee, attachRecyclablesToSubmission, getUserLevel, isAtomicContractTxEnabled, type GaslessClient } from '@/lib/blockchain/contracts'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { useWallet } from '@/providers/WalletProvider'
import { isPaymasterConfigured } from '@/lib/blockchain/smart-account'
import { getCleanupDetails } from '@/lib/blockchain/contracts'
import { isImpactClaimOutstanding, markCleanupAsClaimed } from '@/lib/blockchain/verification'
import { clearPendingCleanupDataForIdentities, resetSubmissionCounting } from '@/lib/utils/cleanup-data'
import { notifyVerifierTelegramOfSubmission } from '@/lib/client/notify-verifier-telegram'
import { resolveEnsToAddress } from '@/lib/utils/ens'
import { AlertModal, type AlertModalVariant } from '@/components/ui/alert-modal'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import type { Address } from 'viem'
import {
  CONTRACT_ADDRESSES,
  MAX_IMPACT_PRODUCT_LEVEL,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from '@/lib/blockchain/chain-constants'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { normalizeImageFileForUpload } from '@/lib/utils/heic-convert'
import type { HypercertRightsPresetId } from '@/lib/blockchain/hypercerts/rights-presets'
import { HYPERCERT_RIGHTS_PRESETS } from '@/lib/blockchain/hypercerts/rights-presets'

type Step = 'photos' | 'enhanced' | 'recyclables' | 'review'

/** Shown when GPS fails or before first capture — covers phone OS + browser site permissions. */
const LOCATION_PERMISSION_HINT =
  'Enable location in phone Settings and allow this site in your browser (site settings > Location).'

const NATIVE_SYMBOL = 'ETH'
const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'CeloScan (Sepolia)'
  : 'CeloScan'
const describeChain = (id?: number) => {
  switch (id) {
    case 1:
      return 'Ethereum Mainnet'
    case 11155111:
      return 'Ethereum Sepolia'
    case 42220:
      return 'Celo Mainnet'
    case 11142220:
      return 'Celo Sepolia'
    default:
      return 'Unknown Network'
  }
}

function cleanupFailureHints(errorMessage: string): string {
  const lower = errorMessage.toLowerCase()
  const isChainId =
    lower.includes('invalid id') ||
    lower.includes('invalid chain') ||
    lower.includes('chain id') ||
    lower.includes('does not match the target chain')

  if (isChainId) {
    return (
      `Please check:\n` +
      `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
      `- Refresh the page, then try submit again\n` +
      `- If using MetaMask, switch network in the wallet app`
    )
  }

  const isIpfs =
    lower.includes('ipfs') ||
    lower.includes('pinata') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid credentials')

  if (isIpfs) {
    return (
      `Please check:\n` +
      `- Pinata credentials on the server (PINATA_JWT) - open GET /api/ipfs/upload for a diagnostic\n` +
      `- Your connection, then try again\n` +
      `- Photo size and format (JPEG / PNG / HEIC)`
    )
  }

  const isUploadOrBrowserNetwork =
    lower.includes('upload before photo') ||
    lower.includes('upload after photo') ||
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower.includes('networkerror') ||
    lower.includes('could not reach the upload server') ||
    lower.includes('network error: please check your internet')

  if (isUploadOrBrowserNetwork) {
    return (
      `Photo upload uses this site’s server (not your wallet’s chain). Try:\n` +
      `- Retry on Wi‑Fi; turn off VPN / iCloud Private Relay / strict content blockers\n` +
      `- Use a smaller photo (under ~8 MB) or export JPEG instead of HEIC\n` +
      `- Safari: Settings → Safari → turn off “Prevent Cross-Site Tracking” for a test, or try Chrome\n` +
      `- For the onchain step you still need ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in MetaMask`
    )
  }

  return (
    `Please check:\n` +
    `- Your wallet is connected\n` +
    `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
    `- You have enough CELO for gas when not using sponsored submit\n` +
    `- The contract address is correct`
  )
}

type MlScorePayload = {
  score?: { verdict?: string; score?: number; delta?: number }
  mlVerificationDisabled?: boolean
}

function parseMlScore(payload: MlScorePayload | null): {
  verdict: string
  score: number
  delta: number
} | null {
  const s = payload?.score
  if (s == null || typeof s.score !== 'number' || typeof s.delta !== 'number') return null
  const verdict = typeof s.verdict === 'string' && s.verdict ? s.verdict : 'pending'
  return { verdict, score: s.score, delta: s.delta }
}

/** Whether a comma-separated textarea already contains this label (trimmed, case-insensitive). */
function commaSeparatedHasItem(current: string, item: string): boolean {
  const normalizedItem = item.trim()
  if (!normalizedItem) return false
  const lower = normalizedItem.toLowerCase()
  return current
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .some((p) => p.toLowerCase() === lower)
}

/** Append a preset to a comma-separated value; no-op if that label is already listed. */
function appendCommaSeparatedUnique(current: string, item: string): string {
  const normalizedItem = item.trim()
  if (!normalizedItem) return current
  if (commaSeparatedHasItem(current, normalizedItem)) return current
  const parts = current
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length > 0 ? `${parts.join(', ')}, ${normalizedItem}` : normalizedItem
}

function userFacingMlSummary(
  payload: MlScorePayload | null,
  mode: 'ok' | 'http_error' | 'exception'
): string {
  if (mode === 'http_error' || mode === 'exception') {
    return 'We could not finish the automatic photo check right now. Your submission is still onchain and human verifiers will review it.'
  }
  const s = payload?.score
  if (s == null || typeof s.score !== 'number' || typeof s.delta !== 'number') {
    return 'AI screening completed. Human verifiers still make the final decision on your cleanup.'
  }
  const verdictLine =
    s.verdict === 'approved'
      ? 'Your before/after photos look consistent with a real cleanup in our automated check.'
      : s.verdict === 'rejected'
        ? 'Our automated check flagged this pair for extra human review. This does not cancel your submission.'
        : 'Automated screening will be combined with human review for a final decision.'
  const deltaLabel = s.delta > 0 ? `+${s.delta}` : String(s.delta)
  return `${verdictLine} Model score: ${s.score} (change in detected items: ${deltaLabel}). Queued for human verifiers with this AI note attached.`
}

/** Keep only numeric input with optional single decimal separator. */
function sanitizeDecimalInput(value: string): string {
  const normalized = value.replace(',', '.')
  let out = ''
  let hasDot = false
  for (const ch of normalized) {
    if (ch >= '0' && ch <= '9') {
      out += ch
      continue
    }
    if (ch === '.' && !hasDot) {
      out += ch
      hasDot = true
    }
  }
  return out
}

function CleanupContent() {
  const {
    address,
    isConnected,
    canTransact,
    aaEnabled,
    walletPhase,
    walletReady,
    walletBootstrapping,
    isEmbeddedAccount,
    embeddedSponsoredSubmit,
  } = useAppWalletAddress()
  const [signGate, setSignGate] = useState<{
    mode: SignUnlockModalMode
    purpose: string
  } | null>(null)
  const pendingRecyclablesRef = useRef(false)
  const chainId = useResolvedChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
  const {
    client: gaslessClient,
    submissionOwnerAddress,
    error: gaslessError,
    expectsSponsoredGas,
  } = useSmartAccountClient()
  const { getGaslessClient } = useWallet()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [referrerAddress, setReferrerAddress] = useState<Address | null>(null)
  const [step, setStep] = useState<Step>('photos')
  const [beforePhoto, setBeforePhoto] = useState<File | null>(null)
  const [afterPhoto, setAfterPhoto] = useState<File | null>(null)
  const [beforePhotoAllowed, setBeforePhotoAllowed] = useState(false)
  const [afterPhotoAllowed, setAfterPhotoAllowed] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [manualLocationMode, setManualLocationMode] = useState(false)
  const [manualCoordsInput, setManualCoordsInput] = useState('')
  const [hostName, setHostName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cleanupId, setCleanupId] = useState<bigint | null>(null)
  const [hasImpactForm, setHasImpactForm] = useState(false)
  const [recyclablesPhoto, setRecyclablesPhoto] = useState<File | null>(null)
  const [recyclablesReceipt, setRecyclablesReceipt] = useState<File | null>(null)
  const [recyclablesAmount, setRecyclablesAmount] = useState('')
  const [recyclablesUnit, setRecyclablesUnit] = useState<'kg' | 'g' | 'lb' | 'bag'>('kg')
  const [pendingCleanup, setPendingCleanup] = useState<{
    id: bigint
    verified: boolean
    claimed: boolean
  } | null>(null)
  const [checkingPending, setCheckingPending] = useState(true)
  const [clearingPending, setClearingPending] = useState(false)
  const [feeInfo, setFeeInfo] = useState<{ fee: bigint; enabled: boolean } | null>(null)
  const [resolvingContributorIndex, setResolvingContributorIndex] = useState<number | null>(null)
  const [alertModal, setAlertModal] = useState<{
    title?: string
    message: string
    variant?: AlertModalVariant
    closeOnBackdropClick?: boolean
  } | null>(null)
  const [mlVerificationLoading, setMlVerificationLoading] = useState(false)
  const [mlVerificationSummary, setMlVerificationSummary] = useState<string | null>(null)
  const [mlVerificationStats, setMlVerificationStats] = useState<{
    verdict: string
    score: number
    delta: number
  } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ title?: string; message: string; onConfirm: () => void; confirmLabel?: string } | null>(null)
  const [impactProductLevel, setImpactProductLevel] = useState<number | null>(null)
  const [checkingImpactLevel, setCheckingImpactLevel] = useState(false)

  // Fix hydration error by only rendering after mount
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setHostName(window.location.hostname)
    }
  }, [])

  // Sticky app header (~4.5–5.5rem): scroll each step so the title + intro sit below it, not mid-form.
  useLayoutEffect(() => {
    if (step !== 'enhanced' && step !== 'recyclables' && step !== 'review') return
    const el = document.getElementById(`cleanup-flow-step-${step}`)
    el?.scrollIntoView({ behavior: 'instant', block: 'start' })
  }, [step])

  useEffect(() => {
    if (!mounted || !address) {
      setImpactProductLevel(null)
      return
    }
    if (!submissionOwnerAddress) {
      return
    }
    let cancelled = false
    const owner = submissionOwnerAddress
    setCheckingImpactLevel(true)
    void getUserLevel(owner as Address)
      .then((lvl) => {
        if (!cancelled) setImpactProductLevel(lvl)
      })
      .catch(() => {
        if (!cancelled) setImpactProductLevel(0)
      })
      .finally(() => {
        if (!cancelled) setCheckingImpactLevel(false)
      })
    return () => {
      cancelled = true
    }
  }, [mounted, address, submissionOwnerAddress])

  // Read referrer from URL params and persist it
  // IMPORTANT: Only allow referral if user hasn't submitted yet (one-time chance)
  const [showReferralNotification, setShowReferralNotification] = useState(false)

  useEffect(() => {
    if (!mounted || !address) return
    if (!submissionOwnerAddress) return

    const loadReferrer = async () => {
      try {
        // First, check if user has already submitted - if yes, they can't be referred again
        const { getUserSubmissions } = await import('@/lib/blockchain/contracts')
        const owner = submissionOwnerAddress
        const submissions = await getUserSubmissions(owner)
        const hasSubmitted = submissions.length > 0

        if (hasSubmitted) {
          // User has already submitted - ignore referral links (one-time chance used)
          console.log('[Cleanup] User has already submitted - referral links are ignored')
          setReferrerAddress(null)
          setShowReferralNotification(false)
          
          // Clear any pending referral
          if (typeof window !== 'undefined') {
            localStorage.removeItem('referrer_pending')
            const referrerKey = `referrer_${address.toLowerCase()}`
            localStorage.removeItem(referrerKey)
          }
          return
        }

        // User hasn't submitted yet - check for referral link
        let ref: string | null = null
        if (searchParams) {
          ref = searchParams.get('ref')
        }

        if (!ref && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search)
          ref = urlParams.get('ref')
        }

        if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
          const referrerAddr = ref as Address
          console.log('[Cleanup] Referral link in URL for new user, saving:', referrerAddr)
          setReferrerAddress(referrerAddr)
          setShowReferralNotification(true)

          // Persist referrer in localStorage so it's available when user submits.
          // Scope only to this address; drop the unscoped `referrer_pending` so it can't leak
          // to a different wallet later in the same browser.
          if (typeof window !== 'undefined') {
            const referrerKey = `referrer_${address.toLowerCase()}`
            localStorage.setItem(referrerKey, referrerAddr)
            localStorage.removeItem('referrer_pending')
          }
        } else if (typeof window !== 'undefined') {
          // If no ref in URL, check localStorage for saved referrer scoped to THIS wallet only.
          const referrerKey = `referrer_${address.toLowerCase()}`
          const savedReferrer = localStorage.getItem(referrerKey)
          if (savedReferrer && /^0x[a-fA-F0-9]{40}$/.test(savedReferrer)) {
            console.log('[Cleanup] Found saved referrer from previous visit:', savedReferrer)
            setReferrerAddress(savedReferrer as Address)
            setShowReferralNotification(true)
          } else {
            // This wallet has no scoped referrer. Clear any stale unscoped pending key so it
            // doesn't follow the user across wallet switches.
            setReferrerAddress(null)
            setShowReferralNotification(false)
            localStorage.removeItem('referrer_pending')
          }
        }
      } catch (error) {
        console.error('[Cleanup] Error loading referrer:', error)
      }
    }

    loadReferrer()
  }, [mounted, searchParams, address, submissionOwnerAddress])

  // Impact Report form data
  const [enhancedData, setEnhancedData] = useState({
    locationType: '',
    area: '',
    areaUnit: 'sqm' as 'sqm' | 'sqft',
    weight: '',
    weightUnit: 'kg' as 'kg' | 'lbs',
    bags: '',
    hours: '',
    minutes: '',
    wasteTypes: [] as string[],
    contributors: [] as string[], // Array of contributor addresses
    scopeOfWork: '', // Auto-generated
    rightsAssignment: '' as '' | HypercertRightsPresetId,
    environmentalChallenges: '',
    preventionIdeas: '',
    additionalNotes: '',
  })

  // Preset options
  const locationTypeOptions = [
    'Beach',
    'Park',
    'Waterway',
    'Forest',
    'Urban',
    'Rural',
    'Industrial',
    'Other',
  ]

  const wasteTypeOptions = [
    'Plastic',
    'Glass',
    'Metal',
    'Paper',
    'Organic',
    'Hazardous',
    'Electronics',
    'Textiles',
    'Other',
  ]

  const environmentalChallengePresets = [
    'Heavy pollution',
    'Lack of waste bins',
    'Illegal dumping',
    'Storm damage',
    'Wildlife impact',
    'Water contamination',
    'Soil contamination',
    'Air quality issues',
  ]

  const preventionPresets = [
    'Install more waste bins',
    'Increase public awareness',
    'Regular cleanup schedules',
    'Stricter enforcement',
    'Community involvement',
    'Better waste management',
    'Educational programs',
    'Recycling facilities',
  ]

  // Auto-generate scope of work
  useEffect(() => {
    if (enhancedData.locationType && enhancedData.wasteTypes.length > 0) {
      const scope = `Cleanup at ${enhancedData.locationType} location, removing ${enhancedData.wasteTypes.join(', ')} waste types`
      setEnhancedData(prev => ({ ...prev, scopeOfWork: scope }))
    } else {
      setEnhancedData(prev => ({ ...prev, scopeOfWork: '' }))
    }
  }, [enhancedData.locationType, enhancedData.wasteTypes])

  useEffect(() => {
    // Get location on mount
    if (!location) {
      getLocation()
    }

  }, [isConnected, address])

  // Fetch submission fee info
  useEffect(() => {
    async function fetchFeeInfo() {
      try {
        const info = await getSubmissionFee()
        setFeeInfo(info)
      } catch (error) {
        console.error('Error fetching submission fee:', error)
      }
    }
    fetchFeeInfo()
  }, [])

  // Check for pending cleanup submissions
  useEffect(() => {
    if (!isConnected || !address) {
      setCheckingPending(false)
      return
    }
    if (!submissionOwnerAddress) {
      return
    }

    const submissionOwner = submissionOwnerAddress

    async function checkPendingCleanup() {
      try {
        if (!address) {
          setPendingCleanup(null)
          setCheckingPending(false)
          return
        }

        const ownerOnChain = submissionOwner.toLowerCase()
        const identityVariants = [...new Set([ownerOnChain, address.toLowerCase()])]

        const clearAllPendingKeys = () => {
          for (const low of identityVariants) {
            localStorage.removeItem(`pending_cleanup_id_${low}`)
            localStorage.removeItem(`pending_cleanup_location_${low}`)
          }
        }

        if (typeof window !== 'undefined') {
          // Prefer smart-account key first (gasless), then EOA (legacy)
          let pendingCleanupId: string | null = null
          let pendingKeyUsed: string | null = null
          for (const low of identityVariants) {
            const pendingKey = `pending_cleanup_id_${low}`
            const id = localStorage.getItem(pendingKey)
            if (id) {
              pendingCleanupId = id
              pendingKeyUsed = pendingKey
              break
            }
          }

          if (pendingCleanupId) {
            try {
              const status = await getCleanupDetails(BigInt(pendingCleanupId))
              console.log('Cleanup status found:', status)

              // Onchain `user` is the submitter (Safe when using paymaster, EOA otherwise)
              if (status.user.toLowerCase() !== ownerOnChain) {
                console.log('Cleanup belongs to different user, clearing localStorage')
                clearAllPendingKeys()
                setPendingCleanup(null)
                return
              }

              // Migrate legacy EOA-scoped key to canonical submission-owner key
              if (pendingKeyUsed && pendingKeyUsed !== `pending_cleanup_id_${ownerOnChain}`) {
                localStorage.setItem(`pending_cleanup_id_${ownerOnChain}`, pendingCleanupId)
                localStorage.removeItem(pendingKeyUsed)
                const legacyLoc = `pending_cleanup_location_${pendingKeyUsed.replace('pending_cleanup_id_', '')}`
                const canonicalLoc = `pending_cleanup_location_${ownerOnChain}`
                const loc = localStorage.getItem(legacyLoc)
                if (loc) {
                  localStorage.setItem(canonicalLoc, loc)
                  localStorage.removeItem(legacyLoc)
                }
              }

              // Check if cleanup is rejected - if so, clear localStorage and allow new submission
              if (status.rejected) {
                console.log('Cleanup is rejected, clearing localStorage to allow new submission')
                clearAllPendingKeys()
                setPendingCleanup(null)
                return
              }

              // Set pending cleanup state based on status
              // If verified but not claimed, keep it in state so user can see claim button
              if (status.verified && !status.claimed) {
                // On-chain: NFT userLevel must stay behind verified cleanup count until each level is minted.
                // If localStorage is stale, still clear so user can submit a new cleanup.
                const outstanding = await isImpactClaimOutstanding(status.user as Address)
                if (!outstanding) {
                  console.log('[Cleanup] Impact level already caught up on-chain; clearing stale pending claim')
                  markCleanupAsClaimed(status.user as Address, BigInt(pendingCleanupId))
                  clearAllPendingKeys()
                  setPendingCleanup(null)
                  return
                }
                // Verified but not claimed - keep in localStorage and state for claim button
                setPendingCleanup({
                  id: BigInt(pendingCleanupId),
                  verified: status.verified,
                  claimed: status.claimed,
                })
                // Keep localStorage so claim button appears
              } else if (!status.verified && !status.rejected) {
                // Pending verification - keep in state
                setPendingCleanup({
                  id: BigInt(pendingCleanupId),
                  verified: status.verified,
                  claimed: status.claimed,
                })
              } else if (status.claimed || status.rejected) {
                // Already claimed or rejected - clear localStorage
                console.log('Cleanup is claimed or rejected, clearing localStorage')
                clearAllPendingKeys()
                setPendingCleanup(null)
              }
            } catch (error: any) {
              console.error('Error checking pending cleanup status:', error)
              const errorMessage = error?.message || String(error)
              // Always clear localStorage on error - cleanup doesn't exist or RPC issue
              console.log('Clearing localStorage - cleanup not found or error:', errorMessage)
              clearAllPendingKeys()
              setPendingCleanup(null)
            }
          } else {
            // Also check old global key for backward compatibility, then clear it
            const oldPendingId = localStorage.getItem('pending_cleanup_id')
            if (oldPendingId) {
              console.log('Found old global pending cleanup, clearing...')
              localStorage.removeItem('pending_cleanup_id')
              localStorage.removeItem('pending_cleanup_location')
            }
            setPendingCleanup(null)
          }
        }
      } catch (error) {
        console.error('Error checking pending cleanup:', error)
        setPendingCleanup(null)
      } finally {
        setCheckingPending(false)
      }
    }

    checkPendingCleanup()
    // Poll for status updates every 10 seconds
    const interval = setInterval(checkPendingCleanup, 10000)
    return () => clearInterval(interval)
  }, [isConnected, address, submissionOwnerAddress])

  // Detect if we're on mobile
  const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  // Removed Base Build host check - not needed for Celo deployment
  const isBaseBuildHost = false

  const handlePhotoSelect = (type: 'before' | 'after' | 'recyclables' | 'recyclablesReceipt') => {
    const input = document.createElement('input')
    input.type = 'file'
    // Use generic image/* to allow all image types
    // Do NOT set capture attribute - this forces camera on some devices
    // By omitting it, mobile browsers will offer "Camera" or "Photo Library" options
    input.accept = 'image/*'

    input.onchange = (e) => {
      void (async () => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) return
        if (file.size > 10 * 1024 * 1024) {
          setAlertModal({ message: 'Image size must be less than 10 MB', variant: 'warning' })
          return
        }
        let ready = file
        try {
          ready = await normalizeImageFileForUpload(file)
        } catch (err) {
          console.warn('Browser HEIC conversion failed, passing raw file to server:', err)
          ready = file
        }
        if (ready.size > 10 * 1024 * 1024) {
          setAlertModal({ message: 'Image size must be less than 10 MB after conversion', variant: 'warning' })
          return
        }
        if (type === 'before') {
          setBeforePhoto(ready)
        } else if (type === 'after') {
          setAfterPhoto(ready)
        } else if (type === 'recyclables') {
          setRecyclablesPhoto(ready)
        } else if (type === 'recyclablesReceipt') {
          setRecyclablesReceipt(ready)
        }
      })()
    }
    input.click()
  }

  const getLocation = () => {
    if (typeof window === 'undefined') {
      return
    }

    // Browsers only expose geolocation on HTTPS or localhost (secure context).
    if (!window.isSecureContext) {
      setLocationError(
        'Location is blocked on plain HTTP (browser security). Use manual coordinates below, or serve the site over HTTPS.'
      )
      setManualLocationMode(true)
      return
    }

    if (!navigator.geolocation) {
      const message =
        'Geolocation is not supported in this browser. Please enter coordinates manually below.'
      setLocationError(message)
      setManualLocationMode(true)
      console.warn(message)
      return
    }

    setIsGettingLocation(true)
    setLocationError(null)
    setManualLocationMode(false)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        }
        setLocation(locationData)
        setIsGettingLocation(false)
        setLocationError(null)
        setManualLocationMode(false)
        console.log('Location obtained:', locationData)

        // Store location in localStorage as backup
        if (typeof window !== 'undefined') {
          localStorage.setItem('last_cleanup_location', JSON.stringify(locationData))
        }
      },
      (error) => {
        setIsGettingLocation(false)
        const policyBlocked =
          error.message?.includes('permissions policy') ||
          error.message?.includes('Permissions policy')
        if (policyBlocked) {
          console.warn(
            'Geolocation blocked by Permissions-Policy. Use manual coordinates below, or restart the dev server if CSP was recently updated.'
          )
        } else {
          console.error('Error getting location:', error)
        }
        setManualLocationMode(true)

        // Try to use last known location as fallback
        if (typeof window !== 'undefined') {
          const lastLocation = localStorage.getItem('last_cleanup_location')
          if (lastLocation) {
            try {
              const parsed = JSON.parse(lastLocation)
              setLocation(parsed)
              console.log('Using last known location:', parsed)
              setAlertModal({
                message: `Using last known location. ${LOCATION_PERMISSION_HINT}`,
                variant: 'info',
              })
              return
            } catch (e) {
              console.error('Error parsing last location:', e)
            }
          }
        }

        let errorMessage = 'Unable to get location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += ` ${LOCATION_PERMISSION_HINT}`
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += ' Location may be off in Settings or indoors. Try outdoors or enter coordinates manually.'
            break
          case error.TIMEOUT:
            errorMessage += ' Location request timed out. Please try again.'
            break
          default:
            errorMessage += ` ${error.message}`
        }
        setLocationError(errorMessage.trim())
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    )
  }

  const handleManualLocationApply = () => {
    // Accepts pasted Google Maps coords in various shapes:
    //   "37.7749, -122.4194"  •  "37.7749 -122.4194"  •  "37.7749,-122.4194"  •  whitespace/parens noise
    const cleaned = manualCoordsInput
      .replace(/[()°]/g, ' ')
      .replace(/[,;]/g, ' ')
      .trim()
    const parts = cleaned.split(/\s+/).filter(Boolean)
    if (parts.length < 2) {
      setAlertModal({
        message: 'Paste both latitude and longitude separated by a comma or space (e.g. 37.7749, -122.4194).',
        variant: 'warning',
      })
      return
    }
    const lat = parseFloat(parts[0])
    const lng = parseFloat(parts[1])

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setAlertModal({ message: 'Please enter valid latitude and longitude values.', variant: 'warning' })
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setAlertModal({ message: 'Latitude must be between -90 and 90, and longitude between -180 and 180.', variant: 'warning' })
      return
    }

    const manualLocation = { lat, lng }
    setLocation(manualLocation)
    setLocationError(null)
    if (typeof window !== 'undefined') {
      localStorage.setItem('last_cleanup_location', JSON.stringify(manualLocation))
    }
  }

  const handlePhotosNext = () => {
    if (!beforePhoto) {
      setAlertModal({ message: 'Please upload a before photo', variant: 'warning' })
      return
    }
    if (!afterPhoto) {
      setAlertModal({ message: 'Please upload an after photo', variant: 'warning' })
      return
    }
    if (!location) {
      setAlertModal({
        message: `Please capture or enter your location. ${LOCATION_PERMISSION_HINT}`,
        variant: 'warning',
      })
      getLocation()
      return
    }
    // Go to impact report form
    setStep('enhanced')
  }

  const handleSkipEnhanced = () => {
    // Ensure hasImpactForm is false when skipping
    setHasImpactForm(false)
    // Go to recyclables step (don't submit yet)
    setStep('recyclables')
    console.log('Skipped impact report, navigating to recyclables step')
  }

  // Check if impact form is valid
  // If user started filling any field (except notes), ALL fields become required (except notes)
  // If no fields are started, user can skip
  // Memoize validation to avoid recalculating on every render
  const validation = useMemo(() => {
    // Helper to check if a string field has a meaningful value
    const hasValue = (value: string | null | undefined) => {
      if (value === null || value === undefined) return false
      return typeof value === 'string' && value.trim() !== ''
    }
    
    // Helper to check if a number field has a meaningful value
    // For validation: must be > 0 (or >= 0 if allowZero)
    // For "started filling": must have a non-empty value (0 counts as "started" if explicitly entered)
    const hasNumberValue = (value: string | null | undefined, allowZero: boolean = false) => {
      if (!value || typeof value !== 'string') return false
      const trimmed = value.trim()
      if (trimmed === '') return false
      const num = Number(trimmed)
      if (isNaN(num)) return false
      return allowZero ? num >= 0 : num > 0
    }
    
    // Helper to check if a number field has been touched/started (even if 0)
    const hasNumberStarted = (value: string | null | undefined) => {
      if (!value || typeof value !== 'string') return false
      const trimmed = value.trim()
      if (trimmed === '') return false
      const num = Number(trimmed)
      return !isNaN(num) && num >= 0
    }
    
    // Auto-fill minutes with "0" if empty for validation purposes
    const minutesValue = enhancedData.minutes && enhancedData.minutes.trim() !== '' 
      ? enhancedData.minutes 
      : '0'
    
    // Check each field for validation (must be filled and valid)
    const hasLocationType = hasValue(enhancedData.locationType)
    const hasWasteTypes = Array.isArray(enhancedData.wasteTypes) && enhancedData.wasteTypes.length > 0
    const hasArea = hasNumberValue(enhancedData.area, false)
    const hasWeight = hasNumberValue(enhancedData.weight, false)
    const hasBags = hasNumberValue(enhancedData.bags, false)
    const hasHours = hasNumberValue(enhancedData.hours, true) // Hours can be 0 for validation
    const hasMinutes = hasNumberValue(minutesValue, true) // Minutes auto-filled to 0 if empty
    const hasRightsAssignment = hasValue(enhancedData.rightsAssignment)
    const hasEnvironmentalChallenges = hasValue(enhancedData.environmentalChallenges)
    const hasPreventionIdeas = hasValue(enhancedData.preventionIdeas)
    
    // Check if user has started filling any field (except notes)
    // For hours/minutes, use hasNumberStarted so 0 counts as "started" if user entered it
    const hasStartedFilling = hasLocationType || 
                              hasWasteTypes || 
                              hasArea || 
                              hasWeight || 
                              hasBags || 
                              hasNumberStarted(enhancedData.hours) || 
                              hasNumberStarted(enhancedData.minutes) || 
                              hasRightsAssignment || 
                              hasEnvironmentalChallenges || 
                              hasPreventionIdeas
    
    // If user started filling, ALL fields are required (except notes)
    // If user hasn't started, form is valid (can skip)
    const isValid = !hasStartedFilling || (
      hasLocationType && 
      hasWasteTypes && 
      hasArea && 
      hasWeight && 
      hasBags && 
      hasHours && 
      hasMinutes && 
      hasRightsAssignment && 
      hasEnvironmentalChallenges && 
      hasPreventionIdeas
    )
    
    return { 
      isValid, 
      hasStartedFilling,
      // Include field-level validation for debugging
      fields: {
        hasLocationType,
        hasWasteTypes,
        hasArea,
        hasWeight,
        hasBags,
        hasHours,
        hasMinutes,
        hasRightsAssignment,
        hasEnvironmentalChallenges,
        hasPreventionIdeas,
      }
    }
  }, [enhancedData])

  // Log validation changes only when state actually changes (not on every render)
  const prevValidationRef = useRef<{ isValid: boolean; hasStartedFilling: boolean } | null>(null)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const prev = prevValidationRef.current
      const hasChanged = !prev || 
        prev.isValid !== validation.isValid || 
        prev.hasStartedFilling !== validation.hasStartedFilling
      
      if (hasChanged) {
        console.log('[Impact Form Validation]', {
          hasStartedFilling: validation.hasStartedFilling,
          isValid: validation.isValid,
          isDisabled: validation.hasStartedFilling && !validation.isValid,
          fields: validation.fields,
          formData: {
            locationType: enhancedData.locationType || '(empty)',
            wasteTypes: enhancedData.wasteTypes?.length || 0,
            area: enhancedData.area || '(empty)',
            weight: enhancedData.weight || '(empty)',
            bags: enhancedData.bags || '(empty)',
            hours: enhancedData.hours || '(empty)',
            minutes: enhancedData.minutes || '(empty)',
            rightsAssignment: enhancedData.rightsAssignment || '(empty)',
            environmentalChallenges: enhancedData.environmentalChallenges || '(empty)',
            preventionIdeas: enhancedData.preventionIdeas || '(empty)',
          }
        })
        prevValidationRef.current = {
          isValid: validation.isValid,
          hasStartedFilling: validation.hasStartedFilling
        }
      }
    }
  }, [validation, enhancedData])

  const handleEnhancedNext = () => {
    if (chainId !== undefined && chainId !== REQUIRED_CHAIN_ID) {
      setAlertModal({
        title: 'Wrong network',
        message:
          `Switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) before continuing.\n\n` +
          `MetaMask (especially on Safari) may not auto-switch: open the wallet, choose the network menu, pick Celo Mainnet or add it manually (RPC: ${REQUIRED_RPC_URL}).`,
        variant: 'warning',
      })
      return
    }
    // Auto-fill minutes with "0" if empty (validation already handles this, but ensure state is updated)
    const finalData = {
      ...enhancedData,
      minutes: enhancedData.minutes && enhancedData.minutes.trim() !== '' ? enhancedData.minutes : '0'
    }
    
    // Update state if minutes was empty
    if (finalData.minutes !== enhancedData.minutes) {
      setEnhancedData(finalData)
    }
    
    // Validation already accounts for auto-filled minutes, so use existing validation
    // If user started filling but form is incomplete, don't proceed
    if (validation.hasStartedFilling && !validation.isValid) {
      const missingFields = Object.entries(validation.fields)
        .filter(([_, isValid]) => !isValid)
        .map(([field]) => field)
      
      console.warn('[Impact Form] Form is incomplete. Missing fields:', missingFields)
      console.log('[Impact Form] Full validation state:', {
        validation,
        formData: finalData,
        missingFields
      })
      
      // Show user-friendly error
      setAlertModal({ message: `Please fill all required fields. Missing: ${missingFields.join(', ')}`, variant: 'warning' })
      return
    }
    
    // If user filled the form (or skipped it), proceed
    setHasImpactForm(validation.hasStartedFilling && validation.isValid)
    // Go to recyclables step
    setStep('recyclables')
  }

  const handleSkipRecyclables = async () => {
    await submitCleanupFlow(false)
  }

  const handleSubmitRecyclables = async () => {
    const amount = Number(recyclablesAmount)
    if (!recyclablesAmount || Number.isNaN(amount) || amount <= 0) {
      setAlertModal({
        message: 'Please enter recyclables amount using numbers only (for example: 2.5).',
        variant: 'warning',
      })
      return
    }
    await submitCleanupFlow(true)
  }

  const submitCleanupFlow = async (hasRecyclables: boolean = false) => {
    if (!isConnected || !address) {
      setAlertModal({
        message: aaEnabled
          ? 'Sign in and set up your wallet in Account settings first.'
          : 'Please connect your wallet first',
        variant: 'warning',
      })
      return
    }
    if (embeddedSponsoredSubmit && isPaymasterConfigured() && !canTransact) {
      pendingRecyclablesRef.current = hasRecyclables
      setSignGate({
        mode: walletPhase === 'pending-password' ? 'set-password' : 'unlock',
        purpose: 'submit this cleanup',
      })
      return
    }
    if (!canTransact) {
      setAlertModal({
        title: aaEnabled ? 'Unlock wallet' : 'Connect wallet',
        message: aaEnabled
          ? 'Unlock your smart wallet (wallet passkey or Face ID) before submitting.'
          : 'Connect your wallet before submitting a cleanup.',
        variant: 'warning',
      })
      return
    }

    // Check if contracts are deployed
    if (!CONTRACT_ADDRESSES.VERIFICATION) {
      setAlertModal({ message: 'Contracts not deployed yet. Please deploy contracts first and set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local', variant: 'error' })
      return
    }

    if (!beforePhoto || !afterPhoto) {
      setAlertModal({ message: 'Please upload both before and after photos', variant: 'warning' })
      return
    }

    if (!location) {
      setAlertModal({
        message: `Location is required. ${LOCATION_PERMISSION_HINT}`,
        variant: 'warning',
      })
      getLocation()
      return
    }

    if (chainId !== undefined && chainId !== REQUIRED_CHAIN_ID) {
      setAlertModal({
        title: 'Wrong network',
        message:
          `You’re on Chain ID ${chainId}. Switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) before submitting.\n\n` +
          `Photo upload does not require the right chain, but we ask you to switch first so the onchain transaction succeeds right after.\n\n` +
          `MetaMask on Safari: open MetaMask → network dropdown → Celo Mainnet (add network if needed: RPC ${REQUIRED_RPC_URL}, symbol CELO).`,
        variant: 'error',
      })
      return
    }

    let resolvedGasless = (gaslessClient as GaslessClient | null) ?? null
    if (embeddedSponsoredSubmit && isPaymasterConfigured() && canTransact && !resolvedGasless) {
      resolvedGasless = (await getGaslessClient()) as GaslessClient | null
    }
    if (embeddedSponsoredSubmit && isPaymasterConfigured() && !resolvedGasless) {
      setAlertModal({
        title: 'Gasless wallet unavailable',
        message:
          gaslessError?.message ||
          'Unlock your wallet in Account settings, wait a few seconds, then try submit again.',
        variant: 'warning',
      })
      return
    }

    setIsSubmitting(true)
    setMlVerificationLoading(false)
    setMlVerificationSummary(null)
    setMlVerificationStats(null)
    /** Use live validation at submit time — avoids stale `hasImpactForm` state skipping the IPFS hash. */
    const impactFormEligible = validation.hasStartedFilling && validation.isValid
    try {
      // Upload photos to IPFS
      console.log('Uploading photos to IPFS...')
      const [beforeHash, afterHash] = await Promise.all([
        uploadToIPFS(beforePhoto).catch((error) => {
          console.error('Error uploading before photo:', error)
          throw new Error(`Failed to upload before photo: ${error.message}`)
        }),
        uploadToIPFS(afterPhoto).catch((error) => {
          console.error('Error uploading after photo:', error)
          throw new Error(`Failed to upload after photo: ${error.message}`)
        }),
      ])

      console.log('Photos uploaded:', { beforeHash: beforeHash.hash, afterHash: afterHash.hash })
      console.log('Location:', { lat: location.lat, lng: location.lng })

      // Upload recyclables photos to IPFS if provided
      let recyclablesPhotoHash: string | null = null
      let recyclablesReceiptHash: string | null = null
      if (hasRecyclables && recyclablesPhoto) {
        try {
          console.log('Uploading recyclables photo to IPFS...')
          const recyclablesPhotoResult = await uploadToIPFS(recyclablesPhoto)
          recyclablesPhotoHash = recyclablesPhotoResult.hash
          console.log('Recyclables photo uploaded to IPFS:', recyclablesPhotoHash)

          if (recyclablesReceipt) {
            console.log('Uploading recyclables receipt to IPFS...')
            const recyclablesReceiptResult = await uploadToIPFS(recyclablesReceipt)
            recyclablesReceiptHash = recyclablesReceiptResult.hash
            console.log('Recyclables receipt uploaded to IPFS:', recyclablesReceiptHash)
          }
        } catch (error) {
          console.error('Error uploading recyclables photos to IPFS:', error)
          // Don't fail the submission if IPFS upload fails, just log it
        }
      }

      // Upload enhanced impact report data to IPFS when the impact step was completed (not skipped)
      let impactFormDataHash: string | null = null
      if (impactFormEligible) {
        try {
          console.log('Uploading enhanced impact report data to IPFS...')
          const impactData = {
            locationType: enhancedData.locationType,
            area: enhancedData.area,
            areaUnit: enhancedData.areaUnit,
            weight: enhancedData.weight,
            weightUnit: enhancedData.weightUnit,
            bags: enhancedData.bags,
            hours: enhancedData.hours,
            minutes: enhancedData.minutes,
            wasteTypes: enhancedData.wasteTypes,
            contributors: enhancedData.contributors,
            scopeOfWork: enhancedData.scopeOfWork,
            rightsAssignment: enhancedData.rightsAssignment,
            environmentalChallenges: enhancedData.environmentalChallenges,
            preventionIdeas: enhancedData.preventionIdeas,
            additionalNotes: enhancedData.additionalNotes,
            // Image usage permissions
            beforePhotoAllowed: beforePhotoAllowed,
            afterPhotoAllowed: afterPhotoAllowed,
            timestamp: new Date().toISOString(),
            userAddress: address,
          }
          const impactDataResult = await uploadJSONToIPFS(impactData, `impact-report-${Date.now()}`)
          impactFormDataHash = impactDataResult.hash
          console.log('Impact report data uploaded to IPFS:', impactFormDataHash)

          // Store the hash in localStorage with cleanup ID (will be set after submission)
          // We'll associate this hash with the cleanup onchain below
        } catch (error) {
          console.error('Error uploading impact report data to IPFS:', error)
          throw new Error(
            `Impact report upload failed: ${error instanceof Error ? error.message : String(error)}. Retry. Without this hash onchain you will not earn impact report DCU.`
          )
        }
      }

      if (impactFormEligible && !impactFormDataHash) {
        throw new Error(
          'Impact report has no IPFS hash. Submitting without it loses impact report DCU on claim.'
        )
      }

      // Check if submission fee is required
      const feeInfo = await getSubmissionFee()
      const feeValue = feeInfo.enabled && feeInfo.fee > 0 ? feeInfo.fee : undefined

      if (feeInfo.enabled && feeInfo.fee > 0) {
        console.log('Submission fee required:', feeInfo.fee.toString(), 'wei')
      }

      // Chain switching is handled by ensureWalletOnRequiredChain() in submitCleanup()
      // No need to duplicate the logic here - it will handle switching and show errors if needed

      // Submit to contract
      console.log('Submitting to contract...')
      console.log('Contract address:', CONTRACT_ADDRESSES.VERIFICATION)
      console.log('Current chain ID:', chainId)
      console.log('Gasless status:', {
        paymasterConfigured: isPaymasterConfigured(),
        expectsSponsoredGas,
        hasGaslessClient: !!resolvedGasless,
        gaslessError: gaslessError?.message || null,
      })
      console.log('Submission data:', {
        beforeHash: beforeHash.hash,
        afterHash: afterHash.hash,
        lat: location.lat,
        lng: location.lng,
        impactFormEligible,
        feeValue: feeValue?.toString() || '0',
      })

      try {
        // Embedded (social/email) path needs SC + paymaster; MetaMask / WalletConnect in the modal pay their own gas (EOA).
        // Pass chainId from hook to avoid false chain detection issues
        const submitOpts = resolvedGasless ? { gaslessClient: resolvedGasless } : undefined
        const combinedRecyclablesSubmit =
          isAtomicContractTxEnabled() && hasRecyclables && !!recyclablesPhotoHash

        const cleanupId = await submitCleanup(
          beforeHash.hash,
          afterHash.hash,
          location.lat,
          location.lng,
          referrerAddress,
          impactFormEligible,
          impactFormDataHash || '',
          feeValue,
          combinedRecyclablesSubmit
            ? {
                ...submitOpts,
                recyclablesPhotoHash: recyclablesPhotoHash!,
                recyclablesReceiptHash: recyclablesReceiptHash || '',
              }
            : submitOpts
        )
        

        console.log('✅ Cleanup submitted with ID:', cleanupId.toString())
        console.log('✅ Referrer address used in submission:', referrerAddress || 'none (no referrer)')
        if (referrerAddress && referrerAddress !== '0x0000000000000000000000000000000000000000') {
          console.log('✅ Referral reward will be distributed when cleanup is verified and user claims their first Impact Product level!')
        }

        const saveRecyclablesMeta = () => {
          void fetch('/api/impact/cleanup-meta', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              submissionId: cleanupId.toString(),
              amount: Number(recyclablesAmount),
              unit: recyclablesUnit,
            }),
          }).catch((err) =>
            console.warn('[cleanup-meta] Failed to save recyclables amount for feed:', err)
          )
        }

        // Attach recyclables to submission if provided (legacy two-tx path)
        // Only attach if we have a recyclables photo hash (IPFS upload succeeded)
        if (hasRecyclables && recyclablesPhotoHash && address && !combinedRecyclablesSubmit) {
          try {
            console.log('📝 Attaching recyclables to submission onchain...')
            console.log('Submission ID:', cleanupId.toString())
            console.log('Recyclables photo hash:', recyclablesPhotoHash)
            console.log('Recyclables receipt hash:', recyclablesReceiptHash || '(none)')
            
            // Call attachRecyclablesToSubmission to attach recyclables to the submission
            const recyclablesTxHash = await attachRecyclablesToSubmission(
              cleanupId,
              recyclablesPhotoHash,
              recyclablesReceiptHash || '',
              gaslessClient ? { gaslessClient: gaslessClient as GaslessClient } : undefined
            )
            
            console.log('✅ Recyclables attached successfully! Transaction hash:', recyclablesTxHash)
            console.log('✅ Recyclables will be rewarded when cleanup is verified')

            saveRecyclablesMeta()
          } catch (recyclablesError: any) {
            console.error('Error attaching recyclables (non-fatal):', recyclablesError)
            // Don't fail the entire submission if recyclables attachment fails
            // Show a warning but continue with the submission
            const errorMsg = recyclablesError?.message || recyclablesError?.shortMessage || 'Unknown error'
            console.warn('⚠️ Recyclables attachment failed:', errorMsg)
            // Only show alert if it's not a network/RPC error (those are expected sometimes)
            if (!errorMsg.includes('Internal JSON-RPC error') && !errorMsg.includes('network')) {
              setAlertModal({
                title: 'Recyclables attachment failed',
                message:
                  `Your cleanup was submitted, but recyclables couldn't be attached.\n\nSubmission ID: ${cleanupId.toString()}\n\nYou can try again later or contact support.\n\nError: ${errorMsg}`,
                variant: 'warning',
              })
            }
          }
        } else if (combinedRecyclablesSubmit) {
          console.log('✅ Recyclables included in createSubmissionWithRecyclables (single tx)')
          saveRecyclablesMeta()
        } else if (hasRecyclables && !recyclablesPhotoHash) {
          console.warn('⚠️ Recyclables were selected but IPFS upload failed - recyclables not attached to submission')
        }

        setCleanupId(cleanupId)

        notifyVerifierTelegramOfSubmission({
          submissionId: cleanupId.toString(),
        })
        
        // Store cleanup ID in localStorage for verification checking (scoped to onchain submitter: Safe or EOA)
        if (typeof window !== 'undefined' && address && submissionOwnerAddress) {
          const storageOwner = submissionOwnerAddress.toLowerCase()
          const pendingKey = `pending_cleanup_id_${storageOwner}`
          const locationKey = `pending_cleanup_location_${storageOwner}`
          localStorage.setItem(pendingKey, cleanupId.toString())
          localStorage.setItem(locationKey, JSON.stringify(location))

          // Clear referrer from localStorage after successful submission
          // The referrer is now stored onchain, so we don't need to keep it locally
          const referrerKey = `referrer_${address.toLowerCase()}`
          localStorage.removeItem(referrerKey)

          // Also clear old global keys if they exist
          localStorage.removeItem('pending_cleanup_id')
          localStorage.removeItem('pending_cleanup_location')
        }

        // Immediately update pendingCleanup state to lock the submit button
        // This ensures the UI reflects the pending status right away
        if (address) {
          console.log('[Cleanup] Setting pendingCleanup state after submission:', {
            cleanupId: cleanupId.toString(),
            verified: false,
            claimed: false,
          })
          setPendingCleanup({
            id: cleanupId,
            verified: false,
            claimed: false,
          })
          // Verify state was set
          console.log('[Cleanup] Pending cleanup state should now lock submit button')
        }

        setIsSubmitting(false)
        setStep('review')

        const mlPublicOff = process.env.NEXT_PUBLIC_ML_VERIFICATION_ENABLED === 'false'

        if (!mlPublicOff) {
          setMlVerificationLoading(true)
          setMlVerificationSummary(null)
        }

        if (mlPublicOff) {
          setMlVerificationSummary(
            'Automated photo checks are off for now. Human verifiers will still review your submission.',
          )
          setMlVerificationStats(null)
          setMlVerificationLoading(false)
        } else {
          void (async () => {
            try {
              console.log('[ML Verification] Triggering AI verification for cleanup:', cleanupId.toString())
              const mlVerificationResponse = await fetch('/api/ml-verification/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  submissionId: cleanupId.toString(),
                  beforeImageCid: beforeHash.hash.replace(/^ipfs:\/\//, ''),
                  afterImageCid: afterHash.hash.replace(/^ipfs:\/\//, ''),
                  gps: { latitude: location.lat, longitude: location.lng },
                  timestamp: Date.now(),
                }),
              })
              if (mlVerificationResponse.ok) {
                const mlData = (await mlVerificationResponse.json()) as MlScorePayload & {
                  mlVerificationDisabled?: boolean
                }
                console.log('[ML Verification] Result:', mlData)
                if (mlData.mlVerificationDisabled) {
                  setMlVerificationSummary(
                    'Automated photo checks are off. Human verifiers will still review your submission.',
                  )
                  setMlVerificationStats(null)
                } else {
                  setMlVerificationSummary(userFacingMlSummary(mlData, 'ok'))
                  setMlVerificationStats(parseMlScore(mlData))
                }
              } else {
                const errText = await mlVerificationResponse.text()
                console.warn('[ML Verification] API returned:', mlVerificationResponse.status, errText)
                setMlVerificationSummary(userFacingMlSummary(null, 'http_error'))
                setMlVerificationStats(null)
              }
            } catch (mlError) {
              console.warn('[ML Verification] AI verification error (non-critical):', mlError)
              setMlVerificationSummary(userFacingMlSummary(null, 'exception'))
              setMlVerificationStats(null)
            } finally {
              setMlVerificationLoading(false)
            }
          })()
        }
      } catch (submitError: any) {
        console.error('Error submitting cleanup:', submitError)
        const errorMessage = submitError?.message || submitError?.shortMessage || String(submitError) || 'Unknown error'
        const errorName = submitError?.name || ''
        const errorDetails = submitError?.details || ''

        if (chainId !== undefined && chainId !== REQUIRED_CHAIN_ID) {
          setAlertModal({
            title: 'Wrong network',
            message:
              `Your wallet is on Chain ID ${chainId} (${describeChain(chainId)}). This app needs ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
              `MetaMask on Safari often won’t switch from the site alone: open MetaMask → network menu → choose or add Celo Mainnet (RPC: ${REQUIRED_RPC_URL}, symbol CELO).\n\n` +
              `Other error from this attempt: ${errorMessage}`,
            variant: 'error',
          })
          setIsSubmitting(false)
          return
        }

        // Wrong chain / Sepolia confusion (narrow — avoid matching every "Celo" substring)
        const isCeloError =
          errorMessage.includes('Celo Sepolia') ||
          (REQUIRED_CHAIN_ID === 42220 &&
            (errorMessage.includes('11142220') || errorMessage.includes('sepolia')))

        // Check if it's truly a "chain not configured" error (not just a switch error)
        const isChainNotConfigured =
          errorDetails?.includes('Chain not configured') ||
          errorMessage.includes('Chain not configured') ||
          errorMessage.includes('chain not configured') ||
          errorMessage.includes('Unrecognized chain') ||
          submitError?.code === 4902 // MetaMask error code for chain not configured

        // Check if it's a switch chain error (could be configured but switch failed)
        const isSwitchError =
          errorName === 'SwitchChainError' ||
          errorMessage.includes('switch chain') ||
          errorMessage.includes('SwitchChainError')

        if (isCeloError) {
          setAlertModal({
            title: 'Wrong network',
            message:
              `This build targets ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}), but the error suggests a testnet or wrong RPC.\n\n` +
              `Please switch to ${REQUIRED_CHAIN_NAME}:\n\n` +
              `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
              `2. Click the network dropdown at the top\n` +
              `3. Select "${REQUIRED_CHAIN_NAME}" from the list\n` +
              `4. If ${REQUIRED_CHAIN_NAME} is not in the list, add it:\n` +
              `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
              `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
              `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
              `   • Currency Symbol: CELO\n` +
              `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
              `5. Once on ${REQUIRED_CHAIN_NAME}, try submitting again.\n\n` +
              `Details: ${errorMessage}`,
            variant: 'error',
          })
          setIsSubmitting(false)
          return
        }

        if (isChainNotConfigured) {
          setAlertModal({
            title: 'Network not configured',
            message:
              `Please add ${REQUIRED_CHAIN_NAME} to your wallet:\n\n` +
              `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
              `2. Go to Settings → Networks → Add Network\n` +
              `3. Click "Add a network manually"\n` +
              `4. Enter these details:\n` +
              `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
              `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
              `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
              `   • Currency Symbol: CELO\n` +
              `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
              `5. Click "Save" and switch to ${REQUIRED_CHAIN_NAME}\n` +
              `${REQUIRED_CHAIN_IS_TESTNET ? `6. Get testnet CELO from: https://faucet.celo.org/\n` : ''}` +
              `${REQUIRED_CHAIN_IS_TESTNET ? `7. Then try submitting again.` : `6. Then try submitting again.`}`,
            variant: 'error',
          })
        } else if (isSwitchError) {
          setAlertModal({
            title: 'Switch network failed',
            message:
              `Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet:\n\n` +
              `1. Open your wallet extension/app\n` +
              `2. Click the network dropdown (top of wallet)\n` +
              `3. Select "${REQUIRED_CHAIN_NAME}" from the list\n` +
              `4. If ${REQUIRED_CHAIN_NAME} is not in the list, you may need to add it:\n` +
              `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
              `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
              `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
            `   • Currency Symbol: CELO\n` +
            `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
            `5. Once on ${REQUIRED_CHAIN_NAME}, try submitting again.\n\n` +
            `Current error: ${errorMessage}`,
            variant: 'error',
          })
        } else {
          setAlertModal({
            title: 'Submission failed',
            message: `${errorMessage}\n\n${cleanupFailureHints(errorMessage)}`,
            variant: 'error',
          })
        }

        setIsSubmitting(false)
        return
      }
    } catch (error) {
      console.error('Error in cleanup submission flow:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const errorName = error instanceof Error ? error.name : ''
      const errorDetails = (error as any)?.details || ''
      const errorCode = (error as any)?.code

      // Check if it's truly a "chain not configured" error (not just a switch error)
      const isChainNotConfigured =
        errorDetails?.includes('Chain not configured') ||
        errorMessage.includes('Chain not configured') ||
        errorMessage.includes('chain not configured') ||
        errorMessage.includes('Unrecognized chain') ||
        errorCode === 4902 // MetaMask error code for chain not configured

      // Check if it's a switch chain error (could be configured but switch failed)
      const isSwitchError =
        errorName === 'SwitchChainError' ||
        errorMessage.includes('switch chain') ||
        errorMessage.includes('SwitchChainError')

      if (isChainNotConfigured) {
        setAlertModal({
          title: 'Network not configured',
          message:
            `Please add ${REQUIRED_CHAIN_NAME} to your wallet:\n\n` +
            `1. Open your wallet (MetaMask, Coinbase Wallet, etc.)\n` +
            `2. Go to Settings → Networks → Add Network\n` +
            `3. Click "Add a network manually"\n` +
            `4. Enter these details:\n` +
            `   • Network Name: ${REQUIRED_CHAIN_NAME}\n` +
            `   • RPC URL: ${REQUIRED_RPC_URL}\n` +
            `   • Chain ID: ${REQUIRED_CHAIN_ID}\n` +
            `   • Currency Symbol: CELO\n` +
            `   • Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
            `5. Click "Save" and switch to ${REQUIRED_CHAIN_NAME}\n` +
            `${REQUIRED_CHAIN_IS_TESTNET ? `6. Get testnet CELO from: https://faucet.celo.org/\n` : ''}` +
            `${REQUIRED_CHAIN_IS_TESTNET ? `7. Then try submitting again.` : `6. Then try submitting again.`}`,
          variant: 'error',
        })
      } else if (isSwitchError) {
        setAlertModal({
          title: 'Switch network failed',
          message:
            `Please manually switch to ${REQUIRED_CHAIN_NAME} in your wallet.\n\n` +
            `1. Open your wallet extension/app\n` +
            `2. Click the network dropdown (top of wallet)\n` +
            `3. Select "${REQUIRED_CHAIN_NAME}" from the list\n` +
            `4. If not in the list, add it (Network Name, RPC URL, Chain ID ${REQUIRED_CHAIN_ID}, Currency CELO).\n\n` +
            `Current error: ${errorMessage}`,
          variant: 'error',
        })
      } else {
        setAlertModal({
          title: 'Submission failed',
          message: `${errorMessage}\n\n${cleanupFailureHints(errorMessage)}`,
          variant: 'error',
        })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if submission is disabled due to pending cleanup or wrong network
  const isWrongNetwork = chainId !== REQUIRED_CHAIN_ID
  // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
  const hasPendingCleanup = pendingCleanup !== null && pendingCleanup !== undefined
  const canClaimPendingLevel =
    hasPendingCleanup && !!pendingCleanup?.verified && !pendingCleanup?.claimed
  /** Blocks starting a new onchain submission — not photo pickers (IPFS upload is off-chain). */
  const isNewSubmissionBlocked =
    !walletReady ||
    (hasPendingCleanup && !pendingCleanup.verified) ||
    canClaimPendingLevel

  const isSubmitFlowDisabled =
    isNewSubmissionBlocked || isWrongNetwork || isSwitchingChain

  const isPhotoUploadDisabled = !walletReady && walletBootstrapping

  const claimLevelButtonClasses =
    'w-full gap-2 bg-brand-yellow py-4 font-bebas text-lg tracking-wider text-black hover:bg-[#e6e600] sm:py-5 sm:text-xl'
  const uploadDisabledHint = !walletReady
    ? 'Your account is still setting up'
    : canClaimPendingLevel
      ? 'Verified: claim your level below'
      : isWrongNetwork
        ? `Switch to ${REQUIRED_CHAIN_NAME} (chain ${REQUIRED_CHAIN_ID})`
        : 'Submission on cooldown'

  // Debug logging
  if (hasPendingCleanup) {
    console.log('[Cleanup] Submission disabled check:', {
      hasPendingCleanup,
      pendingCleanupId: pendingCleanup.id.toString(),
      verified: pendingCleanup.verified,
      canClaimPendingLevel,
      isSubmitFlowDisabled,
    })
  }

  // Referral Notification Component (defined early so it's always in scope)
  const ReferralNotification = () => {
    if (!showReferralNotification || !referrerAddress) return null

    return (
      <div className="mb-6 rounded-lg border-2 border-brand-green bg-brand-green/10 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <Users className="h-5 w-5 text-brand-green" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">Invited by a friend</h3>
            <p className="text-sm text-gray-300">
              You were referred to DeCleanup Rewards. Submit a cleanup to start.
            </p>
          </div>
          <button
            onClick={() => setShowReferralNotification(false)}
            className="flex-shrink-0 text-gray-400 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md">
          <BackButton href="/" label="Go Back" />
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">
            {aaEnabled ? 'Sign in required' : 'Connect Your Wallet'}
          </h2>
          <p className="mb-6 text-gray-400">
            {aaEnabled
              ? 'Sign in and set up your wallet in Account settings to submit a cleanup.'
              : 'Please connect your wallet to submit a cleanup.'}
          </p>
          {aaEnabled ? (
            <div className="mb-6 flex flex-col gap-3">
              <Link
                href="/login"
                className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-brand-green px-4 py-2 text-sm font-medium !text-black hover:bg-brand-green/90"
              >
                Log in
              </Link>
              <Link
                href="/wallet"
                className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-600 px-4 py-2 text-sm text-gray-200 hover:bg-white/[0.06]"
              >
                Account settings
              </Link>
            </div>
          ) : null}
          <BackButton href="/" label="Go Back" />
        </div>
      </div>
    )
  }

  if (checkingImpactLevel || impactProductLevel === null) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md">
          <BackButton href="/" label="Go Back" />
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  if (impactProductLevel >= MAX_IMPACT_PRODUCT_LEVEL) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md space-y-6">
          <BackButton href="/" label="Go Back" />
          <div className="rounded-lg border border-muted-foreground/40 bg-muted/20 p-6 space-y-3">
            <h2 className="text-xl font-bebas tracking-wide text-foreground">SUBMISSION CLOSED</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You&apos;ve reached Impact Product level {MAX_IMPACT_PRODUCT_LEVEL}. New submissions are closed. See your{' '}
              <Link
                href={
                  submissionOwnerAddress &&
                  submissionOwnerAddress.toLowerCase() !== address?.toLowerCase()
                    ? `/impact/${submissionOwnerAddress}?signer=${address as string}`
                    : `/impact/${(submissionOwnerAddress ?? address) as string}`
                }
                className="text-brand-green underline"
              >
                Impact Portfolio
              </Link>
              .
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Cooldown/Wrong Network banner component
  const CooldownBanner = () => {
    if (checkingPending) return null

    // Show wrong network warning first (higher priority)
    if (isWrongNetwork) {
      return (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-red-400">Wrong Network</h3>
              <p className="mb-3 text-sm text-gray-300">
                You&apos;re on Chain ID {chainId} ({describeChain(chainId)}). Switch to{' '}
                <strong className="text-white">
                  {REQUIRED_CHAIN_NAME} ({REQUIRED_CHAIN_ID})
                </strong>
                . In MetaMask: Networks, pick Celo Mainnet. If missing, add RPC {REQUIRED_RPC_URL}, symbol CELO.
              </p>
              <Button
                onClick={async () => {
                  try {
                    await switchChain({ chainId: REQUIRED_CHAIN_ID })
                  } catch (error: any) {
                    setAlertModal({
                      title: 'Switch in MetaMask',
                      message:
                        `Could not switch in the browser. In MetaMask: Networks, select Celo Mainnet (Chain ID ${REQUIRED_CHAIN_ID}). On Safari, try MetaMask's in-app browser.`,
                      variant: 'warning',
                    })
                  }
                }}
                disabled={isSwitchingChain}
                size="sm"
                className=""
              >
                {isSwitchingChain ? 'Switching...' : `Switch to ${REQUIRED_CHAIN_NAME}`}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Verified, ready to claim; mirror dashboard primary action
    if (pendingCleanup && pendingCleanup.verified && !pendingCleanup.claimed) {
      return (
        <div className="mb-6 rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 p-4">
          <div className="flex items-start gap-3">
            <Award className="h-5 w-5 flex-shrink-0 text-brand-yellow mt-0.5" />
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-semibold text-brand-yellow">Ready to claim</h3>
              <p className="text-sm text-gray-200">
                Cleanup #{pendingCleanup.id.toString()} is verified. On home, tap{' '}
                <span className="font-semibold text-brand-yellow">CLAIM LEVEL</span> to mint your Impact Product.
              </p>
              <Button asChild className={claimLevelButtonClasses}>
                <Link href="/" className="inline-flex items-center justify-center">
                  <Award className="h-5 w-5" />
                  CLAIM LEVEL
                </Link>
              </Button>
              <Link
                href="/profile"
                className="inline-flex items-center gap-1 text-xs text-brand-yellow/90 hover:text-brand-yellow underline"
              >
                Or open profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      )
    }

    // Show cooldown warning if pending cleanup
    if (pendingCleanup && !pendingCleanup.verified) {
      const handleClearAndResubmit = async () => {
        if (!address) return

        const clearPendingKeys = () =>
          clearPendingCleanupDataForIdentities(address, submissionOwnerAddress ?? undefined)

        setClearingPending(true)
        try {
          // First, check if cleanup actually exists onchain
          try {
            const status = await getCleanupDetails(pendingCleanup.id)
            console.log('Cleanup status onchain:', status)

            // If cleanup exists and is verified, just clear localStorage
            if (status.verified) {
              clearPendingKeys()
              setPendingCleanup(null)
              setClearingPending(false)
              setAlertModal({
                message: 'Cleanup is already verified! Clearing local data. You can now claim it from your profile.',
                variant: 'success',
              })
              return
            }

            // If cleanup exists but not verified, ask for confirmation via modal
            setConfirmModal({
              title: 'Clear pending cleanup?',
              message:
                `Cleanup #${pendingCleanup.id.toString()} is onchain and pending verification.\n\nClear local data only? It stays onchain. You can submit a new cleanup.\n\nThe old entry remains in the verifier dashboard.`,
              onConfirm: () => {
                setConfirmModal(null)
                clearPendingKeys()
                setPendingCleanup(null)
                setClearingPending(false)
                setAlertModal({
                  message: 'Pending cleanup data cleared! You can now submit a new cleanup.',
                  variant: 'success',
                })
              },
            })
            setClearingPending(false)
            return
          } catch (error: any) {
            // Cleanup doesn't exist onchain - safe to clear
            console.log('Cleanup does not exist onchain, clearing localStorage:', error?.message)
          }

          // Clear localStorage
          clearPendingKeys()
          setPendingCleanup(null)
          setAlertModal({
            message: 'Pending cleanup data cleared! You can now submit a new cleanup.',
            variant: 'success',
          })
        } catch (error) {
          console.error('Error clearing cleanup data:', error)
          setAlertModal({
            message: 'Failed to clear cleanup data. Please try refreshing the page.',
            variant: 'error',
          })
        } finally {
          setClearingPending(false)
        }
      }

      return (
        <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-yellow-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="mb-1 text-sm font-semibold text-yellow-400">
                Submission on Cooldown
              </h3>
              <p className="text-sm text-gray-300">
                Cleanup #{pendingCleanup.id.toString()} is pending verification. Wait until it is verified before
                submitting again.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 underline"
                >
                  Check status in your profile
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleClearAndResubmit}
                    disabled={clearingPending}
                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50"
                  >
                    {clearingPending ? 'Clearing...' : 'Clear & Resubmit (if glitched)'}
                  </button>
                  <button
                    onClick={() => {
                      if (!address) return
                      setConfirmModal({
                        title: 'Reset submission counting?',
                        message:
                          'This will clear all pending cleanup data and allow you to submit again immediately.',
                        confirmLabel: 'Reset',
                        onConfirm: () => {
                          setConfirmModal(null)
                          resetSubmissionCounting(address, submissionOwnerAddress ?? undefined)
                          setPendingCleanup(null)
                          setAlertModal({
                            message: 'Submission counting reset! You can now submit a new cleanup.',
                            variant: 'success',
                          })
                        },
                      })
                    }}
                    disabled={clearingPending}
                    className="inline-flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 underline disabled:opacity-50"
                  >
                    Reset Submission Counting
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  const modalLayer = (
    <>
      {signGate && (
        <SignUnlockModal
          open
          mode={signGate.mode}
          purpose={signGate.purpose}
          onClose={() => setSignGate(null)}
          onSuccess={() => {
            const recyclables = pendingRecyclablesRef.current
            setSignGate(null)
            void submitCleanupFlow(recyclables)
          }}
        />
      )}
      {alertModal && (
        <AlertModal
          isOpen
          onClose={() => setAlertModal(null)}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          closeOnBackdropClick={alertModal.closeOnBackdropClick ?? true}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          isOpen
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          confirmLabel={confirmModal.confirmLabel}
        />
      )}
    </>
  )

  // Step 1: Photos (Before + After) + Location
  if (step === 'photos') {
    return (
      <>
        <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton href="/" />
          </div>

          <ReferralNotification />
          <CooldownBanner />
          {aaEnabled && walletPhase === 'pending-password' && (
            <div className="mb-4">
              <AccountReadyBanner />
            </div>
          )}

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Submit Cleanup Photos
            </h1>
            <p className="text-sm text-gray-400">
              Before/after photos with location. JPEG, JPG, or HEIC, max 10 MB each.
            </p>
          </div>

          <div className="mb-6 space-y-6">
            {/* Before Photo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Before Photo *
              </label>
              {beforePhoto ? (
                <div className="relative mb-2">
                  <img
                    src={URL.createObjectURL(beforePhoto)}
                    alt="Before cleanup"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setBeforePhoto(null)}
                    disabled={isPhotoUploadDisabled}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePhotoSelect('before')}
                  disabled={isPhotoUploadDisabled}
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
                >
                  <Upload className={`mb-2 h-10 w-10 ${isPhotoUploadDisabled ? 'text-gray-600' : 'text-gray-500'}`} />
                  <p className={`text-sm ${isPhotoUploadDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                    {isPhotoUploadDisabled ? uploadDisabledHint : isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
                  </p>
                  {isMobile && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <Camera className="h-4 w-4" />
                      <span>Camera or Gallery</span>
                    </div>
                  )}
                </button>
              )}
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={beforePhotoAllowed}
                  onChange={(e) => setBeforePhotoAllowed(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-800"
                />
                Allow before photo on website and social
              </label>
            </div>

            {/* After Photo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                After Photo *
              </label>
              {afterPhoto ? (
                <div className="relative mb-2">
                  <img
                    src={URL.createObjectURL(afterPhoto)}
                    alt="After cleanup"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setAfterPhoto(null)}
                    disabled={isPhotoUploadDisabled}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handlePhotoSelect('after')}
                  disabled={isPhotoUploadDisabled}
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
                >
                  <Upload className={`mb-2 h-10 w-10 ${isPhotoUploadDisabled ? 'text-gray-600' : 'text-gray-500'}`} />
                  <p className={`text-sm ${isPhotoUploadDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                    {isPhotoUploadDisabled ? uploadDisabledHint : isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
                  </p>
                  {isMobile && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <Camera className="h-4 w-4" />
                      <span>Camera or Gallery</span>
                    </div>
                  )}
                </button>
              )}
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={afterPhotoAllowed}
                  onChange={(e) => setAfterPhotoAllowed(e.target.checked)}
                  className="rounded border-gray-700 bg-gray-800"
                />
                Allow after photo on website and social
              </label>
            </div>

            {/* Location Status */}
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Location *
              </label>
              <p className="mb-3 text-xs leading-relaxed text-gray-500">{LOCATION_PERMISSION_HINT}</p>
              {isGettingLocation ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Getting location...
                </div>
              ) : location ? (
                <div className="flex items-center gap-2 text-sm text-brand-green">
                  <Check className="h-4 w-4" />
                  Location captured: {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm text-gray-400">Location not captured</span>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <button
                      onClick={getLocation}
                      className="text-sm text-brand-green hover:text-[#4a9a26]"
                    >
                      Get Location
                    </button>
                    <button
                      onClick={() => setManualLocationMode(true)}
                      className="text-xs text-gray-400 underline-offset-2 hover:text-gray-200"
                    >
                      Enter manually
                    </button>
                  </div>
                </div>
              )}
              {locationError && (
                <div className="mt-3 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
                  {locationError}
                </div>
              )}
              {manualLocationMode && (
                <div className="mt-3 space-y-3 rounded-lg border border-gray-800 bg-gray-950 p-3">
                  <p className="text-xs text-gray-400">
                    Paste lat, lng from Google Maps (right-click the spot). Saved for this session.
                  </p>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={manualCoordsInput}
                    onChange={(e) => setManualCoordsInput(e.target.value)}
                    placeholder="37.7749, -122.4194"
                    className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleManualLocationApply}
                    className="w-full bg-brand-green text-black hover:bg-[#4a9a26]"
                  >
                    Save Manual Location
                  </Button>
                </div>
              )}
            </div>
          </div>

          {canClaimPendingLevel ? (
            <Button asChild className={claimLevelButtonClasses}>
              <Link href="/" className="inline-flex items-center justify-center">
                <Award className="h-5 w-5" />
                CLAIM LEVEL
              </Link>
            </Button>
          ) : (
            <Button
              onClick={handlePhotosNext}
              disabled={!beforePhoto || !afterPhoto || !location || isSubmitting || isGettingLocation || isSubmitFlowDisabled}
              className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
        {modalLayer}
      </>
    )
  }


  // Step 4: Impact Report (Optional)
  if (step === 'enhanced') {
    return (
      <>
        <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
        <div
          id="cleanup-flow-step-enhanced"
          className="mx-auto max-w-md scroll-mt-[5.5rem] sm:scroll-mt-[6.5rem]"
        >
          <div className="mb-6">
            <BackButton />
          </div>

          <CooldownBanner />
          {aaEnabled && walletPhase === 'pending-password' && (
            <div className="mb-4">
              <AccountReadyBanner />
            </div>
          )}

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Impact Report
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-yellow">
              +5 DCU bonus
            </p>
            <p className="text-sm text-gray-400">
              Optional cleanup details
            </p>
          </div>

          {/* Full form — page scrolls naturally so users can return to the heading after scrolling down */}
          <div
            className="mb-6 space-y-4 pr-1 sm:pr-2"
            onWheel={(e) => {
              // Close any open select dropdowns and blur number inputs when scrolling
              const activeElement = document.activeElement
              if (activeElement) {
                if (activeElement.tagName === 'SELECT' && activeElement instanceof HTMLElement) {
                  activeElement.blur()
                } else if (activeElement.tagName === 'INPUT' && activeElement instanceof HTMLInputElement && activeElement.type === 'number') {
                  activeElement.blur()
                }
              }
            }}
          >
            {/* Location Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Location Type *
              </label>
              <select
                value={enhancedData.locationType}
                onChange={(e) => setEnhancedData({ ...enhancedData, locationType: e.target.value })}
                onBlur={(e) => e.currentTarget.blur()}
                onWheel={(e) => {
                  // Prevent scroll from changing select value
                  if (document.activeElement === e.currentTarget) {
                    e.currentTarget.blur()
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent select from interfering with page scroll
                  if (e.button === 0) {
                    // Only handle left click
                    const select = e.currentTarget as HTMLSelectElement
                    setTimeout(() => {
                      if (document.activeElement !== select) {
                        select.blur()
                      }
                    }, 0)
                  }
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                required
              >
                <option value="">Select location type</option>
                {locationTypeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            {/* Area Cleaned */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Area Cleaned
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={enhancedData.area}
                  onChange={(e) => setEnhancedData({ ...enhancedData, area: e.target.value })}
                  onWheel={(e) => {
                    // Prevent scroll from changing input value
                    e.currentTarget.blur()
                  }}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="50"
                  min="0"
                  step="0.1"
                />
                <select
                  value={enhancedData.areaUnit}
                  onChange={(e) => setEnhancedData({ ...enhancedData, areaUnit: e.target.value as 'sqm' | 'sqft' })}
                  onBlur={(e) => e.currentTarget.blur()}
                  onWheel={(e) => {
                    // Prevent scroll from changing select value
                    if (document.activeElement === e.currentTarget) {
                      e.currentTarget.blur()
                    }
                  }}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                >
                  <option value="sqm">m²</option>
                  <option value="sqft">ft²</option>
                </select>
              </div>
            </div>

            {/* Weight Removed */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Weight Removed
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={enhancedData.weight}
                  onChange={(e) => setEnhancedData({ ...enhancedData, weight: e.target.value })}
                  onWheel={(e) => {
                    // Prevent scroll from changing input value
                    e.currentTarget.blur()
                  }}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="5"
                  min="0"
                  step="0.1"
                />
                <select
                  value={enhancedData.weightUnit}
                  onChange={(e) => setEnhancedData({ ...enhancedData, weightUnit: e.target.value as 'kg' | 'lbs' })}
                  onBlur={(e) => e.currentTarget.blur()}
                  onWheel={(e) => {
                    // Prevent scroll from changing select value
                    if (document.activeElement === e.currentTarget) {
                      e.currentTarget.blur()
                    }
                  }}
                  className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                >
                  <option value="kg">kg</option>
                  <option value="lbs">lbs</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-gray-500">1 standard trash bag ≈ 2kg</p>
            </div>

            {/* Bags Filled */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Bags Filled
              </label>
              <input
                type="number"
                value={enhancedData.bags}
                onChange={(e) => setEnhancedData({ ...enhancedData, bags: e.target.value })}
                onWheel={(e) => {
                  // Prevent scroll from changing input value
                  e.currentTarget.blur()
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="2"
                min="0"
              />
            </div>

            {/* Time Spent */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Time Spent
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={enhancedData.hours}
                  onChange={(e) => setEnhancedData({ ...enhancedData, hours: e.target.value })}
                  onWheel={(e) => {
                    // Prevent scroll from changing input value
                    e.currentTarget.blur()
                  }}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="1"
                  min="0"
                />
                <span className="flex items-center text-gray-400">hrs</span>
                <input
                  type="number"
                  value={enhancedData.minutes}
                  onChange={(e) => setEnhancedData({ ...enhancedData, minutes: e.target.value })}
                  onWheel={(e) => {
                    // Prevent scroll from changing input value
                    e.currentTarget.blur()
                  }}
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                  placeholder="30"
                  min="0"
                  max="59"
                />
                <span className="flex items-center text-gray-400">min</span>
              </div>
            </div>

            {/* Waste Types */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Waste Types (Select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {wasteTypeOptions.map((type) => (
                  <label key={type} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 p-2 hover:bg-white/[0.06] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enhancedData.wasteTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEnhancedData({ ...enhancedData, wasteTypes: [...enhancedData.wasteTypes, type] })
                        } else {
                          setEnhancedData({ ...enhancedData, wasteTypes: enhancedData.wasteTypes.filter(t => t !== type) })
                        }
                      }}
                      className="rounded border-gray-600"
                    />
                    <span className="text-sm text-white">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contributors */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Contributors
              </label>
              <div className="space-y-2">
                <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-400 break-all">
                  <span className="font-mono text-xs">{address || 'Your wallet address'}</span>
                  <span className="ml-2 text-gray-500">(You)</span>
                </div>
                {enhancedData.contributors.map((contributor, idx) => (
                  <div key={idx} className="flex flex-col gap-1">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={contributor}
                        onChange={(e) => {
                          const newContributors = [...enhancedData.contributors]
                          newContributors[idx] = e.target.value
                          setEnhancedData({ ...enhancedData, contributors: newContributors })
                        }}
                        onBlur={async () => {
                          const value = enhancedData.contributors[idx]?.trim()
                          if (!value || resolvingContributorIndex !== null) return
                          setResolvingContributorIndex(idx)
                          try {
                            const resolved = await resolveEnsToAddress(value)
                            if (resolved) {
                              const newContributors = [...enhancedData.contributors]
                              newContributors[idx] = resolved
                              setEnhancedData({ ...enhancedData, contributors: newContributors })
                            }
                          } finally {
                            setResolvingContributorIndex(null)
                          }
                        }}
                        placeholder="Address or ENS (e.g. vitalik.eth)"
                        className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 text-sm font-mono text-xs"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          const value = enhancedData.contributors[idx]?.trim()
                          if (!value) return
                          setResolvingContributorIndex(idx)
                          try {
                            const resolved = await resolveEnsToAddress(value)
                            if (resolved) {
                              const newContributors = [...enhancedData.contributors]
                              newContributors[idx] = resolved
                              setEnhancedData({ ...enhancedData, contributors: newContributors })
                            }
                          } finally {
                            setResolvingContributorIndex(null)
                          }
                        }}
                        disabled={resolvingContributorIndex !== null || !enhancedData.contributors[idx]?.trim()}
                        className="rounded-lg border border-brand-green/50 bg-brand-green/10 px-3 py-2 text-brand-green hover:bg-brand-green/20 disabled:opacity-50"
                        title="Resolve ENS to address"
                      >
                        {resolvingContributorIndex === idx ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Resolve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEnhancedData({ ...enhancedData, contributors: enhancedData.contributors.filter((_, i) => i !== idx) })}
                        className="rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-red-400 hover:bg-red-500/20"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEnhancedData({ ...enhancedData, contributors: [...enhancedData.contributors, ''] })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-white/[0.06]"
                >
                  <span className="text-lg">+</span>
                  Add Contributor
                </button>
                {enhancedData.contributors.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Attribution only (no DCU). Wallet or ENS (e.g. vitalik.eth).
                  </p>
                )}
              </div>
            </div>

            {/* Scope of Work (Auto-generated) */}
            {enhancedData.scopeOfWork && (
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">
                  Scope of Work (Auto-generated)
                </label>
                <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">
                  {enhancedData.scopeOfWork}
                </div>
              </div>
            )}

            {/* Hypercerts rights (required — 5 preset licenses) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Photo sharing license *
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Required for Hypercerts. Saved as hypercert.rights on your certificate.
              </p>
              <select
                value={enhancedData.rightsAssignment}
                onChange={(e) =>
                  setEnhancedData({
                    ...enhancedData,
                    rightsAssignment: e.target.value as HypercertRightsPresetId | '',
                  })
                }
                onBlur={(e) => e.currentTarget.blur()}
                onWheel={(e) => {
                  if (document.activeElement === e.currentTarget) {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
                required
              >
                <option value="">Choose one…</option>
                {HYPERCERT_RIGHTS_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Environmental Challenges */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Environmental Challenges
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {environmentalChallengePresets.map((preset) => {
                  const already = commaSeparatedHasItem(enhancedData.environmentalChallenges, preset)
                  return (
                  <button
                    key={preset}
                    type="button"
                    disabled={already}
                    aria-pressed={already}
                    title={already ? 'Already added' : `Add: ${preset}`}
                    onClick={() => {
                      setEnhancedData({
                        ...enhancedData,
                        environmentalChallenges: appendCommaSeparatedUnique(
                          enhancedData.environmentalChallenges,
                          preset
                        ),
                      })
                    }}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      already
                        ? 'cursor-not-allowed border-gray-600 bg-gray-800/60 text-gray-500'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {already ? '✓' : '+'} {preset}
                  </button>
                  )
                })}
              </div>
              <textarea
                value={enhancedData.environmentalChallenges}
                onChange={(e) => setEnhancedData({ ...enhancedData, environmentalChallenges: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="What issues did you observe?"
                rows={3}
              />
            </div>

            {/* Prevention Suggestions */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Prevention Suggestions
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {preventionPresets.map((preset) => {
                  const already = commaSeparatedHasItem(enhancedData.preventionIdeas, preset)
                  return (
                  <button
                    key={preset}
                    type="button"
                    disabled={already}
                    aria-pressed={already}
                    title={already ? 'Already added' : `Add: ${preset}`}
                    onClick={() => {
                      setEnhancedData({
                        ...enhancedData,
                        preventionIdeas: appendCommaSeparatedUnique(enhancedData.preventionIdeas, preset),
                      })
                    }}
                    className={`rounded-lg border px-2 py-1 text-xs ${
                      already
                        ? 'cursor-not-allowed border-gray-600 bg-gray-800/60 text-gray-500'
                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {already ? '✓' : '+'} {preset}
                  </button>
                  )
                })}
              </div>
              <textarea
                value={enhancedData.preventionIdeas}
                onChange={(e) => setEnhancedData({ ...enhancedData, preventionIdeas: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="How can we prevent this?"
                rows={3}
              />
            </div>

            {/* Additional Notes */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Additional Notes (Optional)
              </label>
              <textarea
                value={enhancedData.additionalNotes}
                onChange={(e) => setEnhancedData({ ...enhancedData, additionalNotes: e.target.value })}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500"
                placeholder="Any additional information..."
                rows={2}
              />
            </div>
          </div>

          {/* Fee Display */}
          {feeInfo && feeInfo.enabled && feeInfo.fee > 0 && (
            <FeeDisplay
              feeAmount={feeInfo.fee}
              feeSymbol="CELO"
              feeUSD="0.02"
              type="submission"
              refundable={true}
              className="mt-6"
            />
          )}

          {canClaimPendingLevel ? (
            <Button asChild className={claimLevelButtonClasses}>
              <Link href="/" className="inline-flex items-center justify-center">
                <Award className="h-5 w-5" />
                CLAIM LEVEL
              </Link>
            </Button>
          ) : (
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleSkipEnhanced}
                disabled={isSubmitting}
                className="flex-1 border-2 border-gray-700 bg-black text-white hover:bg-white/[0.06]"
              >
                Skip
              </Button>
              <Button
                onClick={() => {
                  console.log('[Submit Button Clicked]', {
                    isSubmitting,
                    validation,
                    disabled: isSubmitting || (validation.hasStartedFilling && !validation.isValid),
                    formData: enhancedData
                  })
                  handleEnhancedNext()
                }}
                disabled={isSubmitting || (validation.hasStartedFilling && !validation.isValid)}
                className="flex-1 gap-2 bg-brand-yellow text-black hover:bg-[#e6e600] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {validation.hasStartedFilling ? 'Submit' : 'Continue'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
        {modalLayer}
      </>
    )
  }

  // Step 5: Recyclables Report (Optional)
  if (step === 'recyclables') {
    return (
      <>
        <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
        <div
          id="cleanup-flow-step-recyclables"
          className="mx-auto max-w-md scroll-mt-[5.5rem] sm:scroll-mt-[6.5rem]"
        >
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setStep('enhanced')}
              className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <CooldownBanner />
          {aaEnabled && walletPhase === 'pending-password' && (
            <div className="mb-4">
              <AccountReadyBanner />
            </div>
          )}

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Recyclables Submission
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-green">
              +5 DCU bonus
            </p>
            <p className="text-sm text-gray-400">
              Optional recyclables proof
            </p>
          </div>

          <div className="mb-6 space-y-4">
            {/* Recyclables Amount */}
            <div className="rounded-lg border border-border bg-card/40 p-4">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Recyclables Amount
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Enter how much material was recycled.
              </p>
              <div className="flex gap-2">
                <input
                  inputMode="decimal"
                  value={recyclablesAmount}
                  onChange={(e) => setRecyclablesAmount(sanitizeDecimalInput(e.target.value))}
                  placeholder="e.g. 2.5"
                  disabled={isSubmitting || isSubmitFlowDisabled}
                  className="h-10 flex-1 rounded-md border border-gray-700 bg-black px-3 text-sm text-white placeholder:text-gray-500 focus:border-brand-green focus:outline-none disabled:opacity-50"
                  aria-label="Recyclables amount"
                />
                <select
                  value={recyclablesUnit}
                  onChange={(e) => setRecyclablesUnit(e.target.value as 'kg' | 'g' | 'lb' | 'bag')}
                  disabled={isSubmitting || isSubmitFlowDisabled}
                  className="h-10 rounded-md border border-gray-700 bg-black px-3 text-sm text-white focus:border-brand-green focus:outline-none disabled:opacity-50"
                  aria-label="Recyclables unit"
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="lb">lb</option>
                  <option value="bag">bag(s)</option>
                </select>
              </div>
              {recyclablesAmount && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Recorded amount: <span className="text-foreground">{recyclablesAmount} {recyclablesUnit}</span>
                </p>
              )}
            </div>

            {/* Recyclables Photo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Recyclables Photo *
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Photo of the recyclable materials you collected
              </p>
              {recyclablesPhoto ? (
                <div className="relative">
                  <img
                    src={URL.createObjectURL(recyclablesPhoto)}
                    alt="Recyclables"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setRecyclablesPhoto(null)}
                    disabled={isSubmitting || isSubmitFlowDisabled}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePhotoSelect('recyclables')}
                  disabled={isSubmitting || isSubmitFlowDisabled}
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 hover:border-gray-600"
                >
                  <Upload className="mb-2 h-10 w-10 text-gray-500" />
                  <p className="text-sm text-gray-400">
                    {isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
                  </p>
                </button>
              )}
            </div>

            {/* Recyclables Receipt (Optional) */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Recycling Receipt (Optional)
              </label>
              <p className="mb-2 text-xs text-gray-500">
                Receipt or proof from recycling center (if available)
              </p>
              {recyclablesReceipt ? (
                <div className="relative">
                  <img
                    src={URL.createObjectURL(recyclablesReceipt)}
                    alt="Receipt"
                    className="h-48 w-full rounded-lg object-cover"
                  />
                  <button
                    onClick={() => setRecyclablesReceipt(null)}
                    disabled={isSubmitting || isSubmitFlowDisabled}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePhotoSelect('recyclablesReceipt')}
                  disabled={isSubmitting || isSubmitFlowDisabled}
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 hover:border-gray-600"
                >
                  <Upload className="mb-2 h-10 w-10 text-gray-500" />
                  <p className="text-sm text-gray-400">
                    {isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload receipt'}
                  </p>
                </button>
              )}
            </div>
          </div>

          {/* Fee Display */}
          {feeInfo && feeInfo.enabled && feeInfo.fee > 0 && (
            <FeeDisplay
              feeAmount={feeInfo.fee}
              feeSymbol="CELO"
              feeUSD="0.02"
              type="submission"
              refundable={true}
              className="mt-6"
            />
          )}

          {canClaimPendingLevel ? (
            <Button asChild className={claimLevelButtonClasses}>
              <Link href="/" className="inline-flex items-center justify-center">
                <Award className="h-5 w-5" />
                CLAIM LEVEL
              </Link>
            </Button>
          ) : (
            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleSkipRecyclables}
                disabled={isSubmitting || isSubmitFlowDisabled}
                className="flex-1 border-2 border-gray-700 bg-black text-white hover:bg-white/[0.06]"
              >
                Skip
              </Button>
              <Button
                onClick={handleSubmitRecyclables}
                disabled={
                  isSubmitting ||
                  isSubmitFlowDisabled ||
                  !recyclablesPhoto ||
                  !recyclablesAmount ||
                  Number.isNaN(Number(recyclablesAmount)) ||
                  Number(recyclablesAmount) <= 0
                }
                className="flex-1 gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
        {modalLayer}
      </>
    )
  }

  // Step 6: Success/Review (single inline screen — no success AlertModal)
  if (step === 'review') {
    const mlStatsCompact =
      mlVerificationStats &&
      (() => {
        const confidence = Math.max(0, Math.min(100, Math.round(mlVerificationStats.score * 100)))
        const delta = mlVerificationStats.delta
        const wastePillClass =
          delta > 0
            ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30'
            : delta === 0
              ? 'bg-gray-500/20 text-gray-200 ring-1 ring-gray-400/30'
              : 'bg-red-500/20 text-red-200 ring-1 ring-red-500/30'
        const wastePillText =
          delta > 0 ? `+${delta} items` : delta === 0 ? 'No Δ items' : `${delta} items`
        return (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                mlVerificationStats.verdict === 'approved'
                  ? 'bg-emerald-500/25 text-emerald-300 ring-1 ring-emerald-500/40'
                  : mlVerificationStats.verdict === 'rejected'
                    ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-500/40'
                    : 'bg-yellow-500/20 text-yellow-200 ring-1 ring-yellow-500/35'
              }`}
            >
              {mlVerificationStats.verdict}
            </span>
            <span className="text-[10px] text-gray-400">AI confidence {confidence}%</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${wastePillClass}`}>{wastePillText}</span>
          </div>
        )
      })()

    return (
      <div className="min-h-screen bg-background px-4 py-6 pb-16">
        <div
          id="cleanup-flow-step-review"
          className="mx-auto max-w-sm scroll-mt-[5.5rem] sm:scroll-mt-[6.5rem] text-center"
        >
          <CheckCircle className="mx-auto mb-2 h-10 w-10 text-brand-green" aria-hidden />
          <h1 className="mb-1 font-bebas text-2xl uppercase tracking-wide text-white sm:text-3xl">
            Submission successful!
          </h1>
          {cleanupId && (
            <p className="mb-2 text-xs font-mono text-brand-green">Submission ID: {cleanupId.toString()}</p>
          )}
          <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
            Pending verification (often 2-12 hours). Claim rewards after approval.
          </p>

          <div className="mb-4 rounded-lg border border-cyan-500/40 bg-cyan-950/30 p-3 text-left">
            <p className="text-center text-[10px] font-semibold uppercase tracking-wider text-cyan-200/90">
              AI pre-screening
            </p>
            {mlVerificationLoading ? (
              <div className="mt-2 flex items-center justify-center gap-2 py-1">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin text-cyan-400" aria-hidden />
                <p className="text-center text-[11px] text-gray-400">Checking photos…</p>
              </div>
            ) : mlVerificationStats ? (
              <>
                {mlStatsCompact}
                <p className="mt-2 text-center text-[10px] text-cyan-100/55">
                  Human verifiers decide onchain; AI is guidance only.
                </p>
              </>
            ) : mlVerificationSummary ? (
              <p className="mt-2 text-[11px] leading-relaxed text-gray-400">{mlVerificationSummary}</p>
            ) : (
              <p className="mt-2 text-center text-[11px] text-gray-500">
                Waiting for automated check. Verifiers still review manually if this stays blank.
              </p>
            )}
          </div>

          {beforePhoto && afterPhoto && (
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="text-left">
                <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Before</p>
                <img
                  src={URL.createObjectURL(beforePhoto)}
                  alt="Before"
                  className="h-24 w-full rounded-md object-cover"
                />
              </div>
              <div className="text-left">
                <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">After</p>
                <img
                  src={URL.createObjectURL(afterPhoto)}
                  alt="After"
                  className="h-24 w-full rounded-md object-cover"
                />
              </div>
            </div>
          )}

          <div className="mb-4 rounded-lg border border-brand-green/40 bg-brand-green/10 p-3 text-left">
            <p className="mb-1.5 text-[11px] font-semibold text-brand-green">What&apos;s next?</p>
            <ul className="space-y-0.5 text-[10px] leading-snug text-muted-foreground">
              <li className="flex gap-1.5">
                <span className="text-brand-green">•</span>
                <span>Verifiers review your submission onchain.</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-brand-green">•</span>
                <span>Check your profile for status.</span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-brand-green">•</span>
                <span>
                  Questions?{' '}
                  <a
                    href="https://t.me/decentralizedcleanup"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                  >
                    Telegram
                  </a>
                </span>
              </li>
            </ul>
          </div>

          <Button
            onClick={() => router.push('/')}
            size="sm"
            className="w-full gap-1.5 bg-brand-green text-black hover:bg-[#4a9a26]"
          >
            Go to Home
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    )
  }

  // Fallback (shouldn't reach here)
  return (
    <>
      {alertModal && (
        <AlertModal
          isOpen={true}
          onClose={() => setAlertModal(null)}
          title={alertModal.title}
          message={alertModal.message}
          variant={alertModal.variant}
          closeOnBackdropClick={alertModal.closeOnBackdropClick ?? true}
        />
      )}
      {confirmModal && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          confirmLabel={confirmModal.confirmLabel}
        />
      )}
    </>
  )
}

export default function CleanupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-md">
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    }>
      <CleanupContent />
    </Suspense>
  )
}

