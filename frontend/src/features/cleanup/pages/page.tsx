'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FeeDisplay } from '@/components/ui/fee-display'
import { BackButton } from '@/components/layout/BackButton'
import { Camera, Upload, ArrowRight, ArrowLeft, Check, Loader2, ExternalLink, X, Clock, AlertCircle, Users, CheckCircle } from 'lucide-react'
import { uploadToIPFS, uploadJSONToIPFS } from '@/lib/blockchain/ipfs'
import { submitCleanup, getSubmissionFee, attachRecyclablesToSubmission } from '@/lib/blockchain/contracts'
import { getCleanupDetails } from '@/lib/blockchain/contracts'
import { clearPendingCleanupData, resetSubmissionCounting } from '@/lib/utils/cleanup-data'
import type { Address } from 'viem'
import { CONTRACT_ADDRESSES } from '@/lib/blockchain/wagmi'
import {
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_IS_TESTNET,
} from '@/lib/blockchain/wagmi'

type Step = 'photos' | 'enhanced' | 'recyclables' | 'review'

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
    case 44787:
      return 'Celo Alfajores'
    case 11142220:
      return 'Celo Sepolia'
      return 'VeChain (Carbon)'
    default:
      return 'Unknown Network'
  }
}

function CleanupContent() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain()
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
  const [manualLatInput, setManualLatInput] = useState('')
  const [manualLngInput, setManualLngInput] = useState('')
  const [hostName, setHostName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cleanupId, setCleanupId] = useState<bigint | null>(null)
  const [hasImpactForm, setHasImpactForm] = useState(false)
  const [recyclablesPhoto, setRecyclablesPhoto] = useState<File | null>(null)
  const [recyclablesReceipt, setRecyclablesReceipt] = useState<File | null>(null)
  const [pendingCleanup, setPendingCleanup] = useState<{
    id: bigint
    verified: boolean
    claimed: boolean
  } | null>(null)
  const [checkingPending, setCheckingPending] = useState(true)
  const [clearingPending, setClearingPending] = useState(false)
  const [feeInfo, setFeeInfo] = useState<{ fee: bigint; enabled: boolean } | null>(null)

  // Fix hydration error by only rendering after mount
  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      setHostName(window.location.hostname)
    }
  }, [])

  // Read referrer from URL params and persist it
  // IMPORTANT: Only allow referral if user hasn't submitted yet (one-time chance)
  const [showReferralNotification, setShowReferralNotification] = useState(false)

  useEffect(() => {
    if (!mounted || !address) return

    const loadReferrer = async () => {
      try {
        // First, check if user has already submitted - if yes, they can't be referred again
        const { getUserSubmissions } = await import('@/lib/blockchain/contracts')
        const submissions = await getUserSubmissions(address)
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
          
          // Persist referrer in localStorage so it's available when user submits
          if (typeof window !== 'undefined') {
            const referrerKey = `referrer_${address.toLowerCase()}`
            localStorage.setItem(referrerKey, referrerAddr)
            localStorage.setItem('referrer_pending', referrerAddr)
          }
        } else if (typeof window !== 'undefined') {
          // If no ref in URL, check localStorage for saved referrer (from previous visit)
          const referrerKey = `referrer_${address.toLowerCase()}`
          const savedReferrer = localStorage.getItem(referrerKey)
          if (savedReferrer && /^0x[a-fA-F0-9]{40}$/.test(savedReferrer)) {
            console.log('[Cleanup] Found saved referrer from previous visit:', savedReferrer)
            setReferrerAddress(savedReferrer as Address)
            setShowReferralNotification(true)
          } else {
            // Check pending referrer (for cases where address wasn't available)
            const referrerPending = localStorage.getItem('referrer_pending')
            if (referrerPending && /^0x[a-fA-F0-9]{40}$/.test(referrerPending)) {
              console.log('[Cleanup] Found pending referrer from previous visit:', referrerPending)
              setReferrerAddress(referrerPending as Address)
              // Save it scoped to address now that we have it
              localStorage.setItem(referrerKey, referrerPending)
              setShowReferralNotification(true)
            }
          }
        }
      } catch (error) {
        console.error('[Cleanup] Error loading referrer:', error)
      }
    }

    loadReferrer()
  }, [mounted, searchParams, address])

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
    rightsAssignment: '' as '' | 'attribution' | 'non-commercial' | 'no-derivatives' | 'share-alike' | 'all-rights-reserved',
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

    async function checkPendingCleanup() {
      try {
        if (!address) {
          setPendingCleanup(null)
          setCheckingPending(false)
          return
        }

        if (typeof window !== 'undefined') {
          // Check for pending cleanup ID scoped to this user's address
          const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
          const pendingCleanupId = localStorage.getItem(pendingKey)

          if (pendingCleanupId) {
            try {
              const status = await getCleanupDetails(BigInt(pendingCleanupId))
              console.log('Cleanup status found:', status)

              // Verify this cleanup belongs to the current user
              if (status.user.toLowerCase() !== address.toLowerCase()) {
                console.log('Cleanup belongs to different user, clearing localStorage')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setPendingCleanup(null)
                return
              }

              // Check if cleanup is rejected - if so, clear localStorage and allow new submission
              if (status.rejected) {
                console.log('Cleanup is rejected, clearing localStorage to allow new submission')
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setPendingCleanup(null)
                return
              }

              // Set pending cleanup state based on status
              // If verified but not claimed, keep it in state so user can see claim button
              if (status.verified && !status.claimed) {
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
                localStorage.removeItem(pendingKey)
                localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
                setPendingCleanup(null)
              }
            } catch (error: any) {
              console.error('Error checking pending cleanup status:', error)
              const errorMessage = error?.message || String(error)
              // Always clear localStorage on error - cleanup doesn't exist or RPC issue
              console.log('Clearing localStorage - cleanup not found or error:', errorMessage)
              localStorage.removeItem(pendingKey)
              localStorage.removeItem(`pending_cleanup_location_${address.toLowerCase()}`)
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
  }, [isConnected, address])

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
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        // Validate file size (10 MB max)
        if (file.size > 10 * 1024 * 1024) {
          alert('Image size must be less than 10 MB')
          return
        }
        if (type === 'before') {
          setBeforePhoto(file)
        } else if (type === 'after') {
          setAfterPhoto(file)
        } else if (type === 'recyclables') {
          setRecyclablesPhoto(file)
        } else if (type === 'recyclablesReceipt') {
          setRecyclablesReceipt(file)
        }
      }
    }
    input.click()
  }

  const getLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const message = 'Geolocation is not supported or allowed in this browser. Please enter coordinates manually below.'
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
        console.error('Error getting location:', error)
        setManualLocationMode(true)

        // Try to use last known location as fallback
        if (typeof window !== 'undefined') {
          const lastLocation = localStorage.getItem('last_cleanup_location')
          if (lastLocation) {
            try {
              const parsed = JSON.parse(lastLocation)
              setLocation(parsed)
              console.log('Using last known location:', parsed)
              alert('Using last known location. For accurate geotagging, please enable location services.')
              return
            } catch (e) {
              console.error('Error parsing last location:', e)
            }
          }
        }

        let errorMessage = 'Unable to get location.'
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += ' Please enable location permissions in your browser settings.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage += ' Location information is unavailable.'
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
    const lat = parseFloat(manualLatInput)
    const lng = parseFloat(manualLngInput)

    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      alert('Please enter valid latitude and longitude values.')
      return
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert('Latitude must be between -90 and 90, and longitude between -180 and 180.')
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
      alert('Please upload a before photo')
      return
    }
    if (!afterPhoto) {
      alert('Please upload an after photo')
      return
    }
    if (!location) {
      alert('Please capture or enter your location')
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
      alert(`Please fill all required fields. Missing: ${missingFields.join(', ')}`)
      return
    }
    
    // If user filled the form (or skipped it), proceed
    setHasImpactForm(validation.hasStartedFilling && validation.isValid)
    // Go to recyclables step
    setStep('recyclables')
  }

  const handleSkipRecyclables = async () => {
    // hasForm could be true or false depending on whether user filled the impact form
    await submitCleanupFlow(hasImpactForm, false)
  }

  const handleSubmitRecyclables = async () => {
    // hasForm could be true or false depending on whether user filled the impact form
    await submitCleanupFlow(hasImpactForm, true)
  }

  const submitCleanupFlow = async (hasForm: boolean, hasRecyclables: boolean = false) => {
    if (!isConnected || !address) {
      alert('Please connect your wallet first')
      return
    }

    // Check if contracts are deployed
    if (!CONTRACT_ADDRESSES.VERIFICATION) {
      alert('Contracts not deployed yet. Please deploy contracts first and set NEXT_PUBLIC_SUBMISSION_CONTRACT in .env.local')
      return
    }

    if (!beforePhoto || !afterPhoto) {
      alert('Please upload both before and after photos')
      return
    }

    if (!location) {
      alert('Location is required. Please enable location services and try again.')
      getLocation()
      return
    }

    setIsSubmitting(true)
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

      // Upload enhanced impact report data to IPFS if form was submitted
      let impactFormDataHash: string | null = null
      if (hasForm && enhancedData.locationType) {
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
          // Don't fail the submission if IPFS upload fails, just log it
        }
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
      console.log('Submission data:', {
        beforeHash: beforeHash.hash,
        afterHash: afterHash.hash,
        lat: location.lat,
        lng: location.lng,
        hasForm,
        feeValue: feeValue?.toString() || '0'
      })

      try {
        // Pass chainId from hook to avoid false chain detection issues
        const cleanupId = await submitCleanup(
          beforeHash.hash,
          afterHash.hash,
          location.lat,
          location.lng,
          referrerAddress,
          hasForm,
          impactFormDataHash || '',
          feeValue
        )
        

        console.log('✅ Cleanup submitted with ID:', cleanupId.toString())
        console.log('✅ Referrer address used in submission:', referrerAddress || 'none (no referrer)')
        if (referrerAddress && referrerAddress !== '0x0000000000000000000000000000000000000000') {
          console.log('✅ Referral reward will be distributed when cleanup is verified and user claims their first Impact Product level!')
        }

        // Attach recyclables to submission if provided
        // Only attach if we have a recyclables photo hash (IPFS upload succeeded)
        if (hasRecyclables && recyclablesPhotoHash && address) {
          try {
            console.log('📝 Attaching recyclables to submission on-chain...')
            console.log('Submission ID:', cleanupId.toString())
            console.log('Recyclables photo hash:', recyclablesPhotoHash)
            console.log('Recyclables receipt hash:', recyclablesReceiptHash || '(none)')
            
            // Call attachRecyclablesToSubmission to attach recyclables to the submission
            const recyclablesTxHash = await attachRecyclablesToSubmission(
              cleanupId,
              recyclablesPhotoHash,
              recyclablesReceiptHash || ''
            )
            
            console.log('✅ Recyclables attached successfully! Transaction hash:', recyclablesTxHash)
            console.log('✅ Recyclables will be rewarded when cleanup is verified')
          } catch (recyclablesError: any) {
            console.error('Error attaching recyclables (non-fatal):', recyclablesError)
            // Don't fail the entire submission if recyclables attachment fails
            // Show a warning but continue with the submission
            const errorMsg = recyclablesError?.message || recyclablesError?.shortMessage || 'Unknown error'
            console.warn('⚠️ Recyclables attachment failed:', errorMsg)
            // Only show alert if it's not a network/RPC error (those are expected sometimes)
            if (!errorMsg.includes('Internal JSON-RPC error') && !errorMsg.includes('network')) {
              alert(
                `⚠️ Warning: Cleanup submitted successfully, but failed to attach recyclables.\n\n` +
                `Submission ID: ${cleanupId.toString()}\n\n` +
                `You can try attaching recyclables later, or contact support if needed.\n\n` +
                `Error: ${errorMsg}`
              )
            }
          }
        } else if (hasRecyclables && !recyclablesPhotoHash) {
          console.warn('⚠️ Recyclables were selected but IPFS upload failed - recyclables not attached to submission')
        }

        setCleanupId(cleanupId)
        
        // Store cleanup ID in localStorage for verification checking (scoped to user address)
        if (typeof window !== 'undefined' && address) {
          const pendingKey = `pending_cleanup_id_${address.toLowerCase()}`
          const locationKey = `pending_cleanup_location_${address.toLowerCase()}`
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

        // Show success message and redirect to review step
        setIsSubmitting(false)
        setStep('review')
        
        // Show success alert
        alert(`✅ Cleanup submitted successfully!\n\nSubmission ID: ${cleanupId.toString()}\n\nYour cleanup is now pending verification. You'll be redirected to the home page.`)
        
        // Redirect to home after 3 seconds
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } catch (submitError: any) {
        console.error('Error submitting cleanup:', submitError)
        const errorMessage = submitError?.message || submitError?.shortMessage || String(submitError) || 'Unknown error'
        const errorName = submitError?.name || ''
        const errorDetails = submitError?.details || ''

        // CRITICAL: Check for Celo Sepolia - this is a common mistake!
        const isCeloError =
          errorMessage.includes('CELO') ||
          errorMessage.includes('Celo') ||
          errorMessage.includes('44787') ||
          errorMessage.includes('Celo Sepolia') ||
          chainId === 44787

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
          // Show very clear Celo error message
          alert(
            `❌ WRONG NETWORK: CELO SEPOLIA DETECTED!\n\n` +
            `You are currently on Celo Sepolia Testnet, but this app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}).\n\n` +
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
            `⚠️ Do NOT submit transactions on Celo - they will fail!`
          )
          setIsSubmitting(false)
          return
        }

        if (isChainNotConfigured) {
          // Show detailed instructions for adding the network
          alert(
            `❌ ${REQUIRED_CHAIN_NAME} is not configured in your wallet!\n\n` +
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
            `${REQUIRED_CHAIN_IS_TESTNET ? `7. Then try submitting again.` : `6. Then try submitting again.`}`
          )
        } else if (isSwitchError) {
          // Chain might be configured but switch failed - ask user to manually switch
          alert(
            `❌ Failed to switch to ${REQUIRED_CHAIN_NAME}!\n\n` +
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
            `Current error: ${errorMessage}`
          )
        } else {
          alert(
            `Failed to submit cleanup:\n\n${errorMessage}\n\n` +
            `Please check:\n` +
            `- Your wallet is connected\n` +
            `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
            `- You have enough ETH for gas\n` +
            `- The contract address is correct`
          )
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
        // Show detailed instructions for adding the network
        alert(
          `❌ ${REQUIRED_CHAIN_NAME} is not configured in your wallet!\n\n` +
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
          `${REQUIRED_CHAIN_IS_TESTNET ? `7. Then try submitting again.` : `6. Then try submitting again.`}`
        )
      } else if (isSwitchError) {
        // Chain might be configured but switch failed - ask user to manually switch
        alert(
          `❌ Failed to switch to ${REQUIRED_CHAIN_NAME}!\n\n` +
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
          `Current error: ${errorMessage}`
        )
      } else {
        alert(
          `Failed to submit cleanup:\n\n${errorMessage}\n\n` +
          `Please check:\n` +
          `- Your wallet is connected\n` +
          `- You're on ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID})\n` +
          `- You have enough CELO for gas\n` +
          `- The contract address is correct`
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if submission is disabled due to pending cleanup or wrong network
  const isWrongNetwork = chainId !== REQUIRED_CHAIN_ID
  // IMPORTANT: Check for null/undefined explicitly, not truthiness, because cleanup ID 0 is valid!
  const hasPendingCleanup = pendingCleanup !== null && pendingCleanup !== undefined
  const isSubmissionDisabled = (hasPendingCleanup && !pendingCleanup.verified) || isWrongNetwork || isSwitchingChain
  
  // Debug logging
  if (hasPendingCleanup) {
    console.log('[Cleanup] Submission disabled check:', {
      hasPendingCleanup,
      pendingCleanupId: pendingCleanup.id.toString(),
      verified: pendingCleanup.verified,
      isSubmissionDisabled,
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
            <h3 className="mb-1 text-sm font-bold uppercase text-brand-green">
              🎉 You Were Invited!
            </h3>
            <p className="text-sm text-gray-300">
              You've been referred to DeCleanup Rewards! When you submit your first cleanup, get it verified, and claim your first Impact Product level, both you and your referrer will earn <strong className="text-white">3 $cDCU</strong> each as referral rewards. You'll also receive <strong className="text-white">10 $cDCU</strong> for claiming your first level.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Submit a cleanup below to get started and claim your referral reward!
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
            Connect Your Wallet
          </h2>
          <p className="mb-6 text-gray-400">
            Please connect your wallet to submit a cleanup.
          </p>
          <BackButton href="/" label="Go Back" />
        </div>
      </div>
    )
  }

  // Cooldown/Wrong Network banner component
  const CooldownBanner = () => {
    if (checkingPending) return null

    // Show wrong network warning first (higher priority)
    if (isWrongNetwork) {
      const isVeChain = chainId === 11142220
      const isCelo = chainId === 44787
      return (
        <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
            <div className="flex-1">
              <h3 className="mb-1 font-semibold text-red-400">Wrong Network</h3>
              <p className="mb-3 text-sm text-gray-300">
                You're on Chain ID {chainId} ({describeChain(chainId)}).
                {isVeChain
                  ? ' VeChain browser extensions hijack window.ethereum and block Celo transactions. Please disable the VeChain extension (or use MetaMask/Coinbase Wallet) and switch to the required network.'
                  : ' Please switch to the required Celo network before submitting a cleanup.'}
              </p>
              <Button
                onClick={async () => {
                  try {
                    await switchChain({ chainId: REQUIRED_CHAIN_ID })
                  } catch (error: any) {
                    alert(`Please switch to ${REQUIRED_CHAIN_NAME} manually in MetaMask.`)
                  }
                }}
                disabled={isSwitchingChain}
                size="sm"
                className="bg-brand-green text-black hover:bg-brand-green/90"
              >
                {isSwitchingChain ? 'Switching...' : `Switch to ${REQUIRED_CHAIN_NAME}`}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    // Show cooldown warning if pending cleanup
    if (pendingCleanup && !pendingCleanup.verified) {
      const handleClearAndResubmit = async () => {
        if (!address) return

        setClearingPending(true)
        try {
          // First, check if cleanup actually exists onchain
          try {
            const status = await getCleanupDetails(pendingCleanup.id)
            console.log('Cleanup status onchain:', status)

            // If cleanup exists and is verified, just clear localStorage
            if (status.verified) {
              clearPendingCleanupData(address)
              setPendingCleanup(null)
              alert('Cleanup is already verified! Clearing local data. You can now claim it from your profile.')
              return
            }

            // If cleanup exists but not verified, ask for confirmation
            const confirmed = confirm(
              `Cleanup #${pendingCleanup.id.toString()} exists onchain and is pending verification.\n\n` +
              `Are you sure you want to clear it? This won't delete it from the blockchain, ` +
              `but will allow you to submit a new cleanup.\n\n` +
              `Note: The old cleanup will still be in the verifier dashboard.`
            )

            if (!confirmed) {
              setClearingPending(false)
              return
            }
          } catch (error: any) {
            // Cleanup doesn't exist onchain - safe to clear
            console.log('Cleanup does not exist onchain, clearing localStorage:', error?.message)
          }

          // Clear localStorage
          clearPendingCleanupData(address)
          setPendingCleanup(null)
          alert('Pending cleanup data cleared! You can now submit a new cleanup.')
        } catch (error) {
          console.error('Error clearing cleanup data:', error)
          alert('Failed to clear cleanup data. Please try refreshing the page.')
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
                You have a cleanup submission (ID: {pendingCleanup.id.toString()}) pending verification.
                Please wait until it's verified before submitting a new cleanup.
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
                      if (confirm('Reset submission counting? This will clear all pending cleanup data and allow you to submit again immediately.')) {
                        resetSubmissionCounting(address)
                        setPendingCleanup(null)
                        alert('Submission counting reset! You can now submit a new cleanup.')
                      }
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

  // Step 1: Photos (Before + After) + Location
  if (step === 'photos') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton href="/" />
          </div>

          <ReferralNotification />
          <CooldownBanner />

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Submit Cleanup Photos
            </h1>
            <p className="text-sm text-gray-400">
              Upload before and after cleanup photos with geotag. Supported formats: JPEG, JPG, HEIC. Maximum size per image: 10 MB.
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
                    disabled={isSubmissionDisabled}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePhotoSelect('before')}
                  disabled={isSubmissionDisabled}
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
                >
                  <Upload className={`mb-2 h-10 w-10 ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-500'}`} />
                  <p className={`text-sm ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                    {isSubmissionDisabled ? 'Submission on cooldown' : isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
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
                Allow us to post this picture on social platforms (X, Telegram)
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
                    disabled={isSubmissionDisabled}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePhotoSelect('after')}
                  disabled={isSubmissionDisabled}
                  className="flex h-48 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-700 bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-600"
                >
                  <Upload className={`mb-2 h-10 w-10 ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-500'}`} />
                  <p className={`text-sm ${isSubmissionDisabled ? 'text-gray-600' : 'text-gray-400'}`}>
                    {isSubmissionDisabled ? 'Submission on cooldown' : isMobile ? 'Tap to take photo or choose from gallery' : 'Click to upload photo'}
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
                Allow us to post this picture on social platforms (X, Telegram)
              </label>
            </div>

            {/* Location Status */}
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-3">
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Location *
              </label>
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
                    Paste coordinates (e.g. 37.7749, -122.4194) from Google Maps. We'll store them locally for this session.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      value={manualLatInput}
                      onChange={(e) => setManualLatInput(e.target.value)}
                      placeholder="Latitude"
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500"
                      step="0.000001"
                    />
                    <input
                      type="number"
                      value={manualLngInput}
                      onChange={(e) => setManualLngInput(e.target.value)}
                      placeholder="Longitude"
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-500"
                      step="0.000001"
                    />
                  </div>
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

          <Button
            onClick={handlePhotosNext}
            disabled={!beforePhoto || !afterPhoto || !location || isSubmitting || isGettingLocation || isSubmissionDisabled}
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
        </div>
      </div>
    )
  }


  // Step 4: Impact Report (Optional)
  if (step === 'enhanced') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <BackButton />
          </div>

          <ReferralNotification />

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Impact Report
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-yellow">
              +5 $cDCU Points Bonus
            </p>
            <p className="text-sm text-gray-400">
              Provide more details on your cleanup (optional, rewarded with 5 $cDCU Points).
            </p>
          </div>

          {/* Full form (always visible) */}
          <div 
            className="mb-6 space-y-4 max-h-[70vh] overflow-y-auto pr-2"
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
                  <label key={type} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 p-2 hover:bg-gray-800 cursor-pointer">
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
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      value={contributor}
                      onChange={(e) => {
                        const newContributors = [...enhancedData.contributors]
                        newContributors[idx] = e.target.value
                        setEnhancedData({ ...enhancedData, contributors: newContributors })
                      }}
                      placeholder="Contributor address (0x...)"
                      className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white placeholder-gray-500 text-sm"
                    />
                    <button
                      onClick={() => setEnhancedData({ ...enhancedData, contributors: enhancedData.contributors.filter((_, i) => i !== idx) })}
                      className="rounded-lg border border-red-500 bg-red-500/10 px-3 py-2 text-red-400 hover:bg-red-500/20"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setEnhancedData({ ...enhancedData, contributors: [...enhancedData.contributors, ''] })}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 hover:bg-gray-800"
                >
                  <span className="text-lg">+</span>
                  Add Contributor
                </button>
                {enhancedData.contributors.length > 0 && (
                  <p className="text-xs text-gray-500">Contributors are listed for attribution purposes only</p>
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

            {/* Rights Assignment */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Rights Assignment
              </label>
              <select
                value={enhancedData.rightsAssignment}
                onChange={(e) => setEnhancedData({ ...enhancedData, rightsAssignment: e.target.value as any })}
                onBlur={(e) => e.currentTarget.blur()}
                onWheel={(e) => {
                  // Prevent scroll from changing select value
                  if (document.activeElement === e.currentTarget) {
                    e.currentTarget.blur()
                  }
                }}
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-white"
              >
                <option value="">Select license</option>
                <option value="attribution">Allow use with credit (CC BY)</option>
                <option value="non-commercial">Non-commercial use only (CC BY-NC)</option>
                <option value="no-derivatives">No modifications allowed (CC BY-ND)</option>
                <option value="share-alike">Share with same license (CC BY-SA)</option>
                <option value="all-rights-reserved">All rights reserved</option>
              </select>
            </div>

            {/* Environmental Challenges */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-300">
                Environmental Challenges
              </label>
              <div className="mb-2 flex flex-wrap gap-2">
                {environmentalChallengePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const current = enhancedData.environmentalChallenges
                      const newValue = current ? `${current}, ${preset}` : preset
                      setEnhancedData({ ...enhancedData, environmentalChallenges: newValue })
                    }}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    + {preset}
                  </button>
                ))}
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
                {preventionPresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const current = enhancedData.preventionIdeas
                      const newValue = current ? `${current}, ${preset}` : preset
                      setEnhancedData({ ...enhancedData, preventionIdeas: newValue })
                    }}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-300 hover:bg-gray-700"
                  >
                    + {preset}
                  </button>
                ))}
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

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleSkipEnhanced}
              disabled={isSubmitting}
              className="flex-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900"
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
        </div>
      </div>
    )
  }

  // Step 5: Recyclables Report (Optional)
  if (step === 'recyclables') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
        <div className="mx-auto max-w-md">
          <div className="mb-6">
            <Button
              variant="outline"
              onClick={() => setStep('enhanced')}
              className="gap-2 border-2 border-gray-700 bg-black text-white hover:bg-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          <ReferralNotification />

          <div className="mb-6 text-center">
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Recyclables Submission
            </h1>
            <p className="mb-2 text-sm font-medium text-brand-green">
              Optional - Earn $cRECY tokens
            </p>
            <p className="text-sm text-gray-400">
              If you recycled any materials from your cleanup, upload proof to earn additional rewards.
            </p>
          </div>

          {/* Mainnet Notice */}
          <div className="mb-6 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="mb-2 text-sm font-medium text-yellow-400">
                  ⚠️ Testing Stage - Mainnet Coming Soon
                </p>
                <p className="text-xs text-gray-300">
                  Recyclables submissions are currently in <strong>testing stage</strong>. 
                  The full $cRECY token rewards system will be activated when contracts launch on{' '}
                  <strong>Celo Mainnet</strong>. You can still submit recyclables data now for testing purposes, 
                  but rewards will be distributed after mainnet deployment.
                </p>
              </div>
            </div>
          </div>

          {/* cRECY Reserve Note */}
          <div className="mb-6 rounded-lg border border-brand-green/50 bg-brand-green/10 p-4">
            <p className="mb-2 text-sm font-medium text-brand-green">
              💰 5,000 $cRECY Token Reserve Available (Mainnet)
            </p>
            <p className="mb-2 text-xs text-gray-300">
              <strong>What is this?</strong> $cRECY tokens are rewards for recycling materials from your cleanup. 
              This program is in partnership with{' '}
              <a
                href="https://www.detrashtoken.com/en"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green hover:underline font-semibold"
              >
                Detrash
              </a>
              .
            </p>
            <p className="mb-3 text-xs text-gray-300">
              We have a reserve of <strong>5,000 $cRECY tokens</strong> available for recycling rewards on Celo Mainnet. 
              This promotional program will continue until the reserve is depleted.
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <a
                href="https://celoscan.io/token/0x34C11A932853Ae24E845Ad4B633E3cEf91afE583"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green hover:underline flex items-center gap-1"
              >
                View $cRECY on CeloScan (Mainnet)
                <ExternalLink className="h-3 w-3" />
              </a>
              <span className="text-gray-500">•</span>
              <a
                href="https://www.detrashtoken.com/en"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green hover:underline flex items-center gap-1"
              >
                Learn more about Detrash
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="mb-6 space-y-4">
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
                    disabled={isSubmitting}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePhotoSelect('recyclables')}
                  disabled={isSubmitting}
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
                    disabled={isSubmitting}
                    className="absolute right-2 top-2 rounded-full bg-red-500 p-2 text-white disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handlePhotoSelect('recyclablesReceipt')}
                  disabled={isSubmitting}
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

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={handleSkipRecyclables}
              disabled={isSubmitting}
              className="flex-1 border-2 border-gray-700 bg-black text-white hover:bg-gray-900"
            >
              Skip
            </Button>
            <Button
              onClick={handleSubmitRecyclables}
              disabled={isSubmitting || !recyclablesPhoto}
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
        </div>
      </div>
    )
  }

  // Step 6: Success/Review
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8">
        <div className="mx-auto max-w-md text-center">
          <div className="mb-6">
            <CheckCircle className="mx-auto mb-4 h-16 w-16 text-brand-green" />
            <h1 className="mb-2 text-3xl font-bold uppercase tracking-wide text-white sm:text-4xl">
              Submission Successful!
            </h1>
            {cleanupId && (
              <p className="mb-2 text-sm font-mono text-brand-green">
                Submission ID: {cleanupId.toString()}
              </p>
            )}
            <p className="text-sm text-gray-400">
              Your cleanup has been submitted successfully and is now pending verification. 
              Usually the process takes from 2 to 12 hours. 
              You'll be able to claim your rewards when you claim your Impact Product level after verification.
            </p>
          </div>

          {beforePhoto && afterPhoto && (
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">BEFORE</p>
                <img
                  src={URL.createObjectURL(beforePhoto)}
                  alt="Before"
                  className="h-32 w-full rounded-lg object-cover"
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-gray-400">AFTER</p>
                <img
                  src={URL.createObjectURL(afterPhoto)}
                  alt="After"
                  className="h-32 w-full rounded-lg object-cover"
                />
              </div>
            </div>
          )}

          <div className="mb-6 rounded-lg border border-brand-green/50 bg-brand-green/10 p-4 text-left">
            <p className="mb-2 text-sm font-semibold text-brand-green">What's Next?</p>
            <ul className="space-y-1 text-xs text-gray-300 list-disc list-inside">
              <li>Your submission is being reviewed by our verifiers</li>
              <li>After verification, claim your Impact Product level to receive rewards (usually 2-12 hours)</li>
              <li>Check your profile to see submission status</li>
              <li>Contact us in Telegram if you have questions</li>
            </ul>
          </div>

          <Button
            onClick={() => router.push('/')}
            className="w-full gap-2 bg-brand-green text-black hover:bg-[#4a9a26]"
          >
            Go to Home
            <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="mt-4 text-xs text-gray-500">
            Redirecting automatically in a few seconds...
          </p>
        </div>
      </div>
    )
  }

  // Fallback (shouldn't reach here)
  return null
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

