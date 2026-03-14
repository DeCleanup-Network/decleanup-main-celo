'use client'

import { useState, useEffect } from 'react'
import { useAccount, useSignMessage, useChainId, useSwitchChain } from 'wagmi'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { BackButton } from '@/components/layout/BackButton'
import { CheckCircle, XCircle, Clock, MapPin, User, Calendar, ExternalLink, Loader2, Shield, RefreshCw, Users } from 'lucide-react'
import * as contractsLib from '@/lib/blockchain/contracts'

const {
  getCleanupCounter,
  getCleanupDetails,
  verifyCleanup,
  rejectCleanup,
  getUserLevel,
} = contractsLib

import { Address } from 'viem'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config, REQUIRED_BLOCK_EXPLORER_URL, REQUIRED_CHAIN_NAME, REQUIRED_CHAIN_ID } from '@/lib/blockchain/wagmi'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { getIPFSUrl, getIPFSFallbackUrls } from '@/lib/blockchain/ipfs'
import { findCleanupsByWallet } from '@/lib/utils/find-cleanup'
import { getHypercertRequestsByStatus, approveHypercertRequest, rejectHypercertRequest } from '@/lib/blockchain/hypercerts/requests'
import type { HypercertRequest } from '@/lib/blockchain/hypercerts/types'

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/'
const BLOCK_EXPLORER_NAME = REQUIRED_BLOCK_EXPLORER_URL.includes('sepolia')
  ? 'CeloScan (Sepolia)'
  : 'CeloScan'
const getExplorerTxUrl = (hash: `0x${string}`) => `${REQUIRED_BLOCK_EXPLORER_URL}/tx/${hash}`

interface CleanupItem {
  id: bigint
  user: Address
  beforePhotoHash: string
  afterPhotoHash: string
  timestamp: bigint
  latitude: bigint
  longitude: bigint
  verified: boolean
  claimed: boolean
  rejected: boolean
  level: number
  referrer: Address
  hasImpactForm: boolean
  impactReportHash: string
}


// Message to sign for verifier authentication
const VERIFIER_AUTH_MESSAGE = 'I am requesting access to the DeCleanup Verifier Dashboard. This signature proves I control this wallet address.'

// Storage key for verified verifier address
const VERIFIED_VERIFIER_KEY = 'decleanup_verified_verifier'

export default function VerifierPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isVerifier, setIsVerifier] = useState(false)
  const [needsSignature, setNeedsSignature] = useState(false)
  const [loading, setLoading] = useState(true)
  const [cleanups, setCleanups] = useState<CleanupItem[]>([])
  const [selectedCleanup, setSelectedCleanup] = useState<CleanupItem | null>(null)
  // Level is now calculated automatically based on user's current level
  const [verifying, setVerifying] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signingAddress, setSigningAddress] = useState<Address | null>(null)
  const [pollingStatus, setPollingStatus] = useState<{ cleanupId: bigint | null; count: number } | null>(null)
  const [expandedForms, setExpandedForms] = useState<Set<string>>(new Set())
  const [impactDataMap, setImpactDataMap] = useState<Map<string, any>>(new Map())
  const [activeTx, setActiveTx] = useState<{ cleanupId: bigint; hash: `0x${string}` } | null>(null)
  const [searchWallet, setSearchWallet] = useState<string>('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<Array<{ cleanupId: bigint; verified: boolean; claimed: boolean; level: number; user: Address }>>([])
  const [isLoadingCleanups, setIsLoadingCleanups] = useState(false)
  const [hypercertRequests, setHypercertRequests] = useState<HypercertRequest[]>([])
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null)

  const { signMessageAsync, isPending: isSigning } = useSignMessage()

  // Fix hydration error by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Check if we have a verified verifier in storage
  useEffect(() => {
    if (isConnected && address) {
      checkStoredVerification()
    } else {
      setLoading(false)
    }
  }, [address, isConnected])

  // Load cleanups and hypercert requests when verifier is authenticated
  useEffect(() => {
    if (!isVerifier) return
    
    // Load cleanups initially
    loadCleanups()
    
    // Load hypercert requests initially
    loadHypercertRequests()
    
    // Refresh cleanups and requests every 30 seconds
    const interval = setInterval(() => {
      // Only refresh if not currently loading
      if (!isLoadingCleanups) {
        loadCleanups()
        loadHypercertRequests()
      }
    }, 30000)
    
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVerifier])

  // Preload impact data for all cleanups with impact reports (so permissions are visible)
  useEffect(() => {
    if (cleanups.length === 0) return

    async function preloadImpactData() {
      for (const cleanup of cleanups) {
        if (cleanup.impactReportHash && !impactDataMap.has(cleanup.impactReportHash)) {
          try {
            const url = getIPFSUrl(cleanup.impactReportHash)
            if (!url) continue // Skip if URL is null
            const response = await fetch(url)
            if (response.ok) {
              const data = await response.json()
              setImpactDataMap(prev => {
                const newMap = new Map(prev)
                newMap.set(cleanup.impactReportHash, data)
                return newMap
              })
            }
          } catch (error) {
            // Silently fail - will load when form is expanded
            console.debug('Could not preload impact data for cleanup', cleanup.id.toString())
          }
        }
      }
    }

    preloadImpactData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanups]) // Only depend on isVerifier, not loading

  function checkStoredVerification() {
    try {
      const stored = localStorage.getItem(VERIFIED_VERIFIER_KEY)
      if (stored && address) {
        const { verifiedAddress, timestamp } = JSON.parse(stored)
        // Check if it's the same address and not expired (24 hours)
        const isExpired = Date.now() - timestamp > 24 * 60 * 60 * 1000
        if (verifiedAddress?.toLowerCase() === address.toLowerCase() && !isExpired) {
          // Address matches and not expired, verify against contract
          verifyAgainstContract(address)
          return
        }
      }
      // Need to sign
      setNeedsSignature(true)
      setLoading(false)
    } catch (error) {
      console.error('Error checking stored verification:', error)
      setNeedsSignature(true)
      setLoading(false)
    }
  }

  async function verifyAgainstContract(addr: Address) {
    try {
            
      // Get isVerifier from the contracts library
      const isVerifierFn = contractsLib.isVerifier
      
      // Verify isVerifier function is available
      if (!isVerifierFn || typeof isVerifierFn !== 'function') {
        console.error('isVerifier is not a function:', typeof isVerifierFn, isVerifierFn)
        console.error('Available exports from contractsLib:', Object.keys(contractsLib))
        setError(`Verifier check function not available. Type: ${typeof isVerifierFn}. Please check contract configuration.`)
        setLoading(false)
        return
      }

      console.log('Verifying address against contract:', addr)
      console.log('isVerifier function type:', typeof isVerifierFn)
      const isAuthorized = await isVerifierFn(addr)
      console.log('Verifier check result:', isAuthorized)
      
      setIsVerifier(isAuthorized)
      
      if (isAuthorized) {
        // Store verification
        localStorage.setItem(VERIFIED_VERIFIER_KEY, JSON.stringify({
          verifiedAddress: addr,
          timestamp: Date.now(),
        }))
        await loadCleanups()
      } else {
        setError(`Address ${addr} is not in the verifier allowlist.`)
        setIsVerifier(false)
      }
    } catch (error) {
      console.error('Error verifying against contract:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to verify: ${errorMessage}`)
      setIsVerifier(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignIn() {
    if (!address) {
      setError('Please connect your wallet first')
      return
    }

    // Check if signMessageAsync is available
    if (!signMessageAsync || typeof signMessageAsync !== 'function') {
      setError('Signature functionality not available. Please ensure your wallet supports message signing.')
      console.error('signMessageAsync is not a function:', signMessageAsync)
      return
    }

    setError(null)
    setSigningAddress(address)

    try {
      // Ensure wallet is on the correct chain before signing
      // Some connectors (like WalletConnect) require the chain to be configured
      if (chainId !== REQUIRED_CHAIN_ID) {
        console.log(`Current chain: ${chainId}, required: ${REQUIRED_CHAIN_ID}, switching...`)
        try {
          await switchChain({ chainId: REQUIRED_CHAIN_ID })
          // Wait a moment for the chain switch to complete
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (switchError: any) {
          const switchMsg = switchError?.message || String(switchError)
          if (switchMsg.includes('not configured') || switchMsg.includes('Chain not configured')) {
            throw new Error(
              `Your wallet doesn't have ${REQUIRED_CHAIN_NAME} configured. ` +
              `Please add ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) to your wallet manually, then try again.`
            )
          }
          throw new Error(`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet and try again.`)
        }
      }

      // Request signature - if user can sign, they control the wallet
      // This is proof enough, no need to verify the signature
      console.log('Requesting signature...')
      console.log('signMessageAsync function:', typeof signMessageAsync)
      console.log('Message to sign:', VERIFIER_AUTH_MESSAGE)
      
      // Call signMessageAsync - this should trigger the wallet prompt
      // signMessageAsync returns a promise that resolves with the signature
      const signature = await signMessageAsync({ message: VERIFIER_AUTH_MESSAGE })
      
      console.log('Signature received:', signature)
      console.log('Signature type:', typeof signature)
      console.log('Signature value:', signature)

      // Only validate after we've actually received something
      // If signature is undefined, it means the user rejected or there was an error
      if (signature === undefined || signature === null) {
        setError('Signature request was cancelled or rejected. Please try again.')
        setSigningAddress(null)
        return
      }

      // Check if it's a valid string signature
      if (typeof signature !== 'string' || signature.length === 0) {
        console.error('Unexpected signature format:', typeof signature, signature)
        setError('Invalid signature format received. Please try again.')
        setSigningAddress(null)
        return
      }

      // If we got a valid signature string, the user controls the wallet
      // Now verify the address is in the allowlist
      console.log('Signature is valid, checking allowlist...')
      setLoading(true)
      await verifyAgainstContract(address)
    } catch (error: any) {
      console.error('Error during signature:', error)
      console.error('Error details:', {
        message: error?.message,
        shortMessage: error?.shortMessage,
        name: error?.name,
        code: error?.code,
        cause: error?.cause,
      })
      
      const errorMessage = error?.message || error?.shortMessage || String(error || 'Unknown error')
      
      // Handle chain configuration errors
      if (errorMessage?.toLowerCase().includes('chain not configured') || 
          errorMessage?.toLowerCase().includes('not configured')) {
        setError(
          `Chain configuration error: ${errorMessage}\n\n` +
          `Please ensure ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) is added to your wallet, ` +
          `then switch to it and try signing again.`
        )
      } else if (errorMessage?.toLowerCase().includes('rejected') || 
          errorMessage?.toLowerCase().includes('denied') ||
          errorMessage?.toLowerCase().includes('user rejected') ||
          errorMessage?.toLowerCase().includes('user denied') ||
          errorMessage?.toLowerCase().includes('user cancelled')) {
        setError('Signature was rejected. Please try again when ready.')
      } else if (errorMessage?.toLowerCase().includes('invalid signature')) {
        setError('Invalid signature received. Please try again.')
      } else {
        setError(`Failed to sign message: ${errorMessage}`)
      }
      setSigningAddress(null)
      setLoading(false)
    }
  }

  async function loadCleanups() {
    // Prevent concurrent calls
    if (isLoadingCleanups) {
      console.log('loadCleanups already in progress, skipping...')
      return
    }
    
    try {
      setIsLoadingCleanups(true)
      setLoading(true)
      const counter = await getCleanupCounter()
      console.log('Cleanup counter:', counter.toString())
      const cleanupList: CleanupItem[] = []

      // Load all cleanups (from 1 to counter-1, since counter is the next ID to use)
      // If counter is 0, no cleanups exist yet
      // If counter is 1, no cleanups exist (counter points to next ID: 1)
      // If counter is 2, cleanup ID 1 exists (counter points to next ID: 2)
      const totalCleanups = Number(counter)
      const maxCleanupId = totalCleanups > 0 ? totalCleanups - 1 : 0
      console.log(`Counter: ${totalCleanups}, Loading cleanups 1 to ${maxCleanupId}...`)
      
      // Always try to load a wider range to catch any cleanups that might exist
      // Start from 1, go up to counter-1, but also try a few more in case counter is off
      const startId = 1
      // Load up to counter-1, but also try a few more IDs in case counter is slightly off
      // Use counter-1 as primary, but extend to at least 20 to catch any missed cleanups
      const endId = Math.max(maxCleanupId, 20) // Try at least up to ID 20, or counter-1 if higher
      
      console.log(`Attempting to load cleanups from ${startId} to ${endId}...`)
      
      for (let i = startId; i <= endId; i++) {
        try {
          const details = await getCleanupDetails(BigInt(i))
          
          // Filter out empty/invalid cleanups (zero address means cleanup doesn't exist)
          if (details.user === '0x0000000000000000000000000000000000000000' || 
              !details.user || 
              details.user === '0x') {
            // Skip empty cleanups silently
            continue
          }
          
          // Only log found cleanups, not every attempt
          console.log(`Found cleanup ${i}:`, {
            user: details.user,
            verified: details.verified,
            claimed: details.claimed,
            level: details.level,
            hasImpactForm: details.hasImpactForm,
            impactFormDataHash: details.impactFormDataHash,
          })
          
          // Fetch referrer for this user from contract
          let referrer: Address = '0x0000000000000000000000000000000000000000'
          try {
            const { getUserReferrer } = await import('@/lib/blockchain/contracts')
            const userReferrer = await getUserReferrer(details.user)
            if (userReferrer) {
              referrer = userReferrer
            }
          } catch (error) {
            console.warn(`Could not fetch referrer for user ${details.user}:`, error)
          }
          
          cleanupList.push({
            ...details,
            id: BigInt(i),
            rejected: details.rejected || false,
            referrer,
            hasImpactForm: details.hasImpactForm || false,
            impactReportHash: details.impactFormDataHash || '',
          })
          
          // Debug: Log impact report data
          if (details.hasImpactForm || details.impactFormDataHash) {
            console.log(`Cleanup ${i} has impact report:`, {
              hasImpactForm: details.hasImpactForm,
              impactFormDataHash: details.impactFormDataHash,
            })
          }
         
          
        } catch (error: any) {
          // If cleanup doesn't exist (e.g., deleted or never created), skip it
          // This can happen if counter is higher than actual cleanups
          const errorMessage = error?.message || String(error)
          if (errorMessage.includes('revert') || 
              errorMessage.includes('does not exist') || 
              errorMessage.includes('Invalid cleanup ID') ||
              errorMessage.includes('Failed to get cleanup')) {
            // Continue checking - don't stop early as counter might be off
            // Only stop if we've checked many IDs and found nothing
            if (i > 50) {
              console.log(`Checked up to ID ${i}, stopping search...`)
              break
            }
            continue
          }
          // For other errors (RPC issues), log but continue
          console.warn(`Unexpected error loading cleanup ${i}:`, errorMessage)
          // Don't break on RPC errors, continue trying
        }
      }

      console.log(`Loaded ${cleanupList.length} cleanup(s) total`)
      console.log('Pending cleanups:', cleanupList.filter(c => !c.verified && !c.rejected).length)
      console.log('Verified cleanups:', cleanupList.filter(c => c.verified).length)

      // Sort by timestamp (newest first)
      cleanupList.sort((a, b) => Number(b.timestamp - a.timestamp))
      setCleanups(cleanupList)
    } catch (error) {
      console.error('Error loading cleanups:', error)
      setError('Failed to load cleanups')
    } finally {
      setLoading(false)
      setIsLoadingCleanups(false)
    }
  }
  async function loadHypercertRequests() {
    try {
      const pending = getHypercertRequestsByStatus('PENDING')
      console.log('📋 Pending Hypercert requests:', pending.length)
      setHypercertRequests(pending)
    } catch (error) {
      console.error('Error loading Hypercert requests:', error)
    }
  }
  async function handleVerify(cleanupId: bigint) {
    setVerifying(true)
    setError(null)

    try {
      // Get the cleanup details to find the user
      const cleanup = cleanups.find(c => c.id === cleanupId)
      if (!cleanup) {
        throw new Error('Cleanup not found')
      }

      // Get user's current level from Impact Product NFT
      let nextLevel = 1 // Default to level 1 for new users
      try {
        const currentLevel = await getUserLevel(cleanup.user)
        // Next level is current + 1, capped at 10
        nextLevel = Math.min(currentLevel + 1, 10)
        console.log(`User ${cleanup.user} current level: ${currentLevel}, assigning level: ${nextLevel}`)
      } catch (levelError) {
        console.warn('Could not get user level, defaulting to 1:', levelError)
        // If user has no NFT yet, they start at level 1
        nextLevel = 1
      }

      // Verify with automatically calculated level - pass chainId to avoid false detection
      const hash = await verifyCleanup(cleanupId, nextLevel)
      setActiveTx({ cleanupId, hash })
      console.log(`Verifying cleanup ${cleanupId.toString()} with level ${nextLevel}`)
      console.log(`Transaction hash: ${hash}`)
      
      // Show initial success message
      const explorerUrl = getExplorerTxUrl(hash)
      setPollingStatus({ cleanupId, count: 0 })
      
      // Wait for transaction receipt first to ensure it was confirmed
      try {
        console.log('Waiting for transaction receipt...')
        const receipt = await waitForTransactionReceipt(config, { 
          hash,
          timeout: 120000, // 2 minute timeout
        })
        console.log('Transaction confirmed in block:', receipt.blockNumber)
        
        // Transaction confirmed, now check if verification was successful
        // Give it a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Check verification status
      let pollCount = 0
        const maxPolls = 30 // Poll for up to 1 minute after confirmation (30 * 2 seconds)
      const pollInterval = setInterval(async () => {
        pollCount++
        setPollingStatus({ cleanupId, count: pollCount })
        console.log(`Polling for verification status (attempt ${pollCount}/${maxPolls})...`)
        try {
          const status = await getCleanupDetails(cleanupId)
          console.log(`Cleanup ${cleanupId.toString()} status check:`, { verified: status.verified, level: status.level })
          if (status.verified) {
            console.log('✅ Cleanup verified confirmed onchain, reloading cleanups...')
            clearInterval(pollInterval)
            setPollingStatus(null)
            await loadCleanups()
              setSelectedCleanup(null)
              alert(
                `✅ Cleanup ${cleanupId.toString()} is now verified!\n\n` +
                `View on ${BLOCK_EXPLORER_NAME}: ${explorerUrl}`
              )
          } else if (pollCount >= maxPolls) {
              console.log('Max polls reached after confirmation, stopping check')
            clearInterval(pollInterval)
            setPollingStatus(null)
              await loadCleanups()
              setSelectedCleanup(null)
              alert(
                `⚠️ Transaction confirmed but verification status not updated yet.\n\n` +
                `This may be a temporary RPC issue. Check ${BLOCK_EXPLORER_NAME}:\n${explorerUrl}`
              )
          }
        } catch (checkError: any) {
          const errorMsg = checkError?.message || String(checkError)
          console.log(`Poll attempt ${pollCount} failed:`, errorMsg)
          if (pollCount >= maxPolls) {
            clearInterval(pollInterval)
            setPollingStatus(null)
              await loadCleanups()
              setSelectedCleanup(null)
          }
        }
      }, 2000) // Poll every 2 seconds
      
        // Cleanup interval after 1 minute
      setTimeout(() => {
        clearInterval(pollInterval)
        if (pollingStatus?.cleanupId === cleanupId) {
          setPollingStatus(null)
        }
        }, 60000)
      } catch (receiptError: any) {
        // Transaction receipt wait failed (timeout or error)
        console.error('Error waiting for transaction receipt:', receiptError)
        setPollingStatus(null)
        await loadCleanups()
        setSelectedCleanup(null)
        
        const errorMsg = receiptError?.message || String(receiptError)
        if (errorMsg.includes('timeout')) {
          alert(
            `⏱️ Transaction submitted but confirmation is taking longer than expected.\n\n` +
            `Transaction Hash: ${hash}\n\n` +
            `Please check ${BLOCK_EXPLORER_NAME} for status:\n${explorerUrl}\n\n` +
            `The cleanup will be verified once the transaction confirms.`
          )
        } else {
          alert(
            `⚠️ Transaction submitted but could not confirm receipt.\n\n` +
            `Transaction Hash: ${hash}\n\n` +
            `Please check ${BLOCK_EXPLORER_NAME} for status:\n${explorerUrl}`
          )
        }
      }
    } catch (error) {
      console.error('Error verifying cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to verify: ${errorMessage}`)
      
      // Show alert for critical errors (chain mismatches, etc.)
      if (errorMessage.includes('CRITICAL') || errorMessage.includes('Chain') || errorMessage.includes('network')) {
        alert(`❌ ${errorMessage}`)
      } else {
        // For other errors, show a more user-friendly message
        alert(`Failed to verify cleanup:\n\n${errorMessage}\n\nPlease check your wallet connection and network settings.`)
      }
    } finally {
      setVerifying(false)
      setActiveTx(null)
    }
  }

  async function handleReject(cleanupId: bigint) {
    setRejecting(true)
    setError(null)

    try {
      // Pass chainId to avoid false chain detection
      const hash = await rejectCleanup(cleanupId)
      console.log(`Rejecting cleanup ${cleanupId.toString()}`)
      console.log(`Transaction hash: ${hash}`)
      
      // Reload cleanups
      await loadCleanups()
      setSelectedCleanup(null)
      
      // Show success with transaction hash
      const explorerUrl = getExplorerTxUrl(hash)
      alert(
        `✅ Rejection transaction submitted!\n\n` +
        `Transaction Hash: ${hash}\n\n` +
        `The cleanup will be marked as rejected once the transaction confirms.\n\n` +
        `View on ${BLOCK_EXPLORER_NAME}: ${explorerUrl}`
      )
    } catch (error) {
      console.error('Error rejecting cleanup:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setError(`Failed to reject: ${errorMessage}`)
    } finally {
      setRejecting(false)
    }
  }

  async function handleApproveHypercert(requestId: string) {
    if (!address) return
    
    setProcessingRequestId(requestId)
    try {
      console.log('Approving Hypercert request:', requestId)
      
      // Approve the request
      const approvedRequest = approveHypercertRequest({
        requestId,
        verifierAddress: address,
      })
      
      if (!approvedRequest) {
        throw new Error('Failed to approve request')
      }
      
      // TODO: In Phase 6, this will call the actual on-chain mint function
      // For now, just update the UI
      console.log('✅ Hypercert request approved:', approvedRequest.id)
      
      alert(
        `✅ Hypercert request approved!\n\n` +
        `Request ID: ${requestId}\n\n` +
        `Note: On-chain minting will be implemented in Phase 6.`
      )
      
      // Refresh the requests list
      loadHypercertRequests()
    } catch (error) {
      console.error('Error approving Hypercert request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to approve Hypercert request:\n\n${errorMessage}`)
    } finally {
      setProcessingRequestId(null)
    }
  }

  async function handleRejectHypercert(requestId: string) {
    if (!address) return
    
    const reason = prompt('Enter rejection reason (optional):')
    
    setProcessingRequestId(requestId)
    try {
      console.log('Rejecting Hypercert request:', requestId)
      
      // Reject the request
      const rejectedRequest = rejectHypercertRequest({
        requestId,
        verifierAddress: address,
        reason: reason || undefined,
      })
      
      if (!rejectedRequest) {
        throw new Error('Failed to reject request')
      }
      
      console.log('❌ Hypercert request rejected:', rejectedRequest.id)
      
      alert(
        `Hypercert request rejected.\n\n` +
        `Request ID: ${requestId}\n` +
        (reason ? `Reason: ${reason}` : '')
      )
      
      // Refresh the requests list
      loadHypercertRequests()
    } catch (error) {
      console.error('Error rejecting Hypercert request:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      alert(`Failed to reject Hypercert request:\n\n${errorMessage}`)
    } finally {
      setProcessingRequestId(null)
    }
  }

  function getIPFSUrl(hash: string): string | null {
    if (!hash || hash === '' || hash === '0x' || hash.length === 0) return null
    // Remove ipfs:// prefix if present
    const cleanHash = hash.replace(/^ipfs:\/\//, '')
    if (!cleanHash || cleanHash.length === 0) return null
    return `${IPFS_GATEWAY}${cleanHash}`
  }

  function formatDate(timestamp: bigint): string {
    return new Date(Number(timestamp) * 1000).toLocaleString()
  }

  function formatCoordinates(lat: bigint, lng: bigint): string {
    const latNum = Number(lat) / 1e6
    const lngNum = Number(lng) / 1e6
    return `${latNum.toFixed(6)}, ${lngNum.toFixed(6)}`
  }

  function getLevelName(level: number): string {
    if (level >= 1 && level <= 3) return 'Newbie'
    if (level >= 4 && level <= 6) return 'Pro'
    if (level >= 7 && level <= 9) return 'Hero'
    if (level >= 10) return 'Guardian'
    return 'Unassigned'
  }


  // Component to fetch and display impact report details from IPFS
  function ImpactReportDetails({ impactReportHash }: { impactReportHash?: string | null }) {
    const [impactData, setImpactData] = useState<any>(null)
    const [impactDataUrl, setImpactDataUrl] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
      async function fetchImpactData() {
        if (!impactReportHash) {
          setError('Impact report data was not provided with this cleanup.')
          setLoading(false)
          return
        }
        try {
          setLoading(true)
          const primaryUrl = getIPFSUrl(impactReportHash)
          if (!primaryUrl) {
            throw new Error('Failed to generate IPFS URL for impact report')
            }
          const urls = [primaryUrl, ...getIPFSFallbackUrls(impactReportHash)]

          if (!urls[0]) {
            throw new Error('Failed to generate IPFS URL for impact report')
          }
          setImpactDataUrl(urls[0])
          
          // Try each gateway until one works
          let data: any = null
          let lastError: Error | null = null
          for (const url of urls) {
            try {
              const response = await fetch(url, { 
                mode: 'cors',
                cache: 'no-cache'
              })
              if (response.ok) {
                data = await response.json()
                break
              }
            } catch (err) {
              lastError = err instanceof Error ? err : new Error(String(err))
              continue
            }
          }
          
          if (!data) {
            throw lastError || new Error('Failed to fetch impact report data from IPFS')
          }
          
          setImpactData(data)
          // Store in map for easy access by cleanup ID
          if (impactReportHash) {
            setImpactDataMap(prev => {
              const newMap = new Map(prev)
              newMap.set(impactReportHash, data)
              return newMap
            })
          }
        } catch (err: any) {
          console.error('Error fetching impact report data:', err)
          setError(err.message || 'Failed to load impact report data')
        } finally {
          setLoading(false)
        }
      }

      fetchImpactData()
    }, [impactReportHash, reloadKey])

    if (loading) {
      return (
        <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
          <p className="font-semibold text-green-300">Impact Report</p>
          <p className="mt-2 text-gray-200">Loading impact report data…</p>
        </div>
      )
    }

    if (error || !impactData) {
      return (
        <div className="mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
          <p className="font-semibold text-yellow-200">Impact Report</p>
          <p className="mt-2 text-gray-200">
            {error || 'Impact report metadata is unavailable. Ask the submitter to re-open the cleanup and re-send the enhanced form if needed.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="mt-3 border-yellow-500/60 text-yellow-200 hover:bg-yellow-500/10"
          >
            Retry Load
          </Button>
        </div>
      )
    }

    return (
      <div className="mt-3 rounded-xl border border-green-500/40 bg-green-500/5 p-4 text-sm text-gray-100">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold uppercase tracking-wide text-green-300">Impact Report Details</p>
          {impactDataUrl && (
            <a
              href={impactDataUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-200 underline hover:text-green-100"
            >
              View raw IPFS JSON
            </a>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {impactData.locationType && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Location Type</dt>
              <dd className="text-base text-white">{impactData.locationType}</dd>
            </div>
          )}
          {impactData.area && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Area Cleaned</dt>
              <dd className="text-base text-white">
                {impactData.area} {impactData.areaUnit === 'sqm' ? 'm²' : 'ft²'}
              </dd>
            </div>
          )}
          {impactData.weight && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Weight Removed</dt>
              <dd className="text-base text-white">
                {impactData.weight} {impactData.weightUnit}
              </dd>
            </div>
          )}
          {impactData.bags && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Bags Filled</dt>
              <dd className="text-base text-white">{impactData.bags}</dd>
            </div>
          )}
          {(impactData.hours || impactData.minutes) && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Time Spent</dt>
              <dd className="text-base text-white">
                {impactData.hours || 0}h {impactData.minutes || 0}m
              </dd>
            </div>
          )}
          {impactData.wasteTypes && impactData.wasteTypes.length > 0 && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Waste Types</dt>
              <dd className="text-base text-white">{impactData.wasteTypes.join(', ')}</dd>
            </div>
          )}
          {impactData.contributors && impactData.contributors.length > 0 && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Contributors</dt>
              <dd className="text-base text-white">{impactData.contributors.length} address(es)</dd>
            </div>
          )}
          {impactData.scopeOfWork && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Scope of Work</dt>
              <dd className="text-base text-white">{impactData.scopeOfWork}</dd>
            </div>
          )}
          {impactData.rightsAssignment && (
            <div>
              <dt className="text-xs uppercase text-gray-400">Rights Assignment</dt>
              <dd className="text-base text-white">{impactData.rightsAssignment}</dd>
            </div>
          )}
          {impactData.environmentalChallenges && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Environmental Challenges</dt>
              <dd className="text-base text-white">{impactData.environmentalChallenges}</dd>
            </div>
          )}
          {impactData.preventionIdeas && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Prevention Suggestions</dt>
              <dd className="text-base text-white">{impactData.preventionIdeas}</dd>
            </div>
          )}
          {impactData.additionalNotes && (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-gray-400">Additional Notes</dt>
              <dd className="text-base text-white whitespace-pre-wrap">{impactData.additionalNotes}</dd>
            </div>
          )}
        </dl>

        <p className="mt-4 text-xs text-gray-400">
          * Impact report data is self-reported; verify details against the provided photos before approving.
        </p>
      </div>
    )
  }

  {/* Pending Hypercert Requests */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Pending Hypercert Requests</h2>
          {hypercertRequests.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No pending Hypercert requests to review.
            </div>
          ) : (
            <div className="space-y-4">
              {hypercertRequests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-6"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white">Hypercert Request</h3>
                      <p className="mt-1 font-mono text-xs text-gray-400">ID: {request.id}</p>
                    </div>
                    <div className="rounded-full bg-yellow-500/20 px-3 py-1 text-sm font-medium text-yellow-400">
                      PENDING
                    </div>
                  </div>

                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-400">
                      <User className="h-4 w-4" />
                      <span className="font-mono text-xs">{request.requester}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date(request.submittedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Metadata Preview */}
                  <div className="mb-4 rounded-lg border border-gray-700 bg-gray-800 p-4">
                    <h4 className="mb-2 text-sm font-semibold text-white">Impact Summary</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400">Cleanups:</span>
                        <span className="ml-2 font-bold text-white">
                          {request.metadata?.impact?.summary?.totalCleanups || 0}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Reports:</span>
                        <span className="ml-2 font-bold text-white">
                          {request.metadata?.impact?.summary?.totalReports || 0}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-400">Timeframe:</span>
                        <span className="ml-2 text-white">
                          {request.metadata?.impact?.summary?.timeframeStart && 
                            new Date(request.metadata.impact.summary.timeframeStart).toLocaleDateString()
                          } - {
                            request.metadata?.impact?.summary?.timeframeEnd &&
                            new Date(request.metadata.impact.summary.timeframeEnd).toLocaleDateString()
                          }
                        </span>
                      </div>
                    </div>
                    
                    {/* Show branding if available */}
                    {request.metadata?.branding && (
                      <div className="mt-3 border-t border-gray-700 pt-3">
                        <h5 className="mb-2 text-xs font-semibold uppercase text-gray-400">Branding</h5>
                        {request.metadata.branding.title && (
                          <div className="mb-1 text-sm text-white">
                            Title: {request.metadata.branding.title}
                          </div>
                        )}
                        {request.metadata.branding.description && (
                          <div className="text-xs text-gray-400">
                            {request.metadata.branding.description}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleRejectHypercert(request.id)}
                      disabled={processingRequestId === request.id}
                      variant="outline"
                      className="flex-1 border-red-500 text-red-400 hover:bg-red-500/10"
                    >
                      {processingRequestId === request.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Rejecting...
                        </>
                      ) : (
                        <>
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleApproveHypercert(request.id)}
                      disabled={processingRequestId === request.id}
                      className="flex-1 bg-brand-green text-black hover:bg-brand-green/90"
                    >
                      {processingRequestId === request.id ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Approving...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Approve & Mint
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

  const pendingCleanups = cleanups.filter((c) => !c.verified && !c.rejected)
  const verifiedCleanups = cleanups.filter((c) => c.verified)
  const rejectedCleanups = cleanups.filter((c) => c.rejected)

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
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
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
            <h2 className="mb-4 text-2xl font-bold uppercase text-white">Verifier Login</h2>
            <p className="mb-6 text-gray-400">
              Connect your wallet to access the verifier dashboard. Only whitelisted verifier addresses can access this page.
            </p>
            <div className="flex justify-center">
              <WalletConnect />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show signature request screen
  if (needsSignature && !isVerifier) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900 p-6 text-center">
            <Shield className="mx-auto mb-4 h-16 w-16 text-brand-green" />
            <h2 className="mb-4 text-2xl font-bold uppercase text-white">Verify Your Identity</h2>
            <p className="mb-6 text-gray-400">
              Please sign a message with your wallet to verify you control a whitelisted verifier address.
            </p>
            
            {address && (
              <div className="mb-6 rounded-lg border border-gray-700 bg-gray-800 p-4 text-left">
                <p className="mb-2 text-sm text-gray-400">Connected Address:</p>
                <p className="font-mono text-sm text-white break-all">{address}</p>
              </div>
            )}

            <div className="mb-6 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-blue-400">Message to sign:</p>
              <p className="text-sm text-gray-300 italic">"{VERIFIER_AUTH_MESSAGE}"</p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
                {error}
              </div>
            )}

            <Button
              onClick={handleSignIn}
              disabled={isSigning || loading}
              className="bg-brand-green text-black hover:bg-brand-green/90"
            >
              {isSigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Sign Message to Verify
                </>
              )}
            </Button>

            <p className="mt-6 text-xs text-gray-500">
              This signature proves you control the wallet address. We'll check if it's whitelisted as a verifier.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-brand-green" />
          </div>
        </div>
      </div>
    )
  }

  if (!isVerifier) {
        return (
      <div className="min-h-screen bg-background px-4 py-8 pb-20">
        <div className="mx-auto max-w-4xl">
          <BackButton href="/" />
          <div className="mt-8 rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
            <XCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h2 className="mb-4 text-2xl font-bold uppercase text-white">Access Denied</h2>
            {error && (
              <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-left">
                <p className="text-sm text-yellow-400 font-mono break-all">{error}</p>
              </div>
            )}
            <p className="mb-4 text-gray-400">
              This address is not authorized as a verifier. Only whitelisted verifier addresses can access this dashboard.
            </p>
            <div className="mb-6 space-y-2 text-left">
              <p className="text-sm text-gray-500 font-mono break-all">
                <span className="text-gray-400">Your address:</span> {address}
              </p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-left">
              <p className="mb-2 text-sm font-semibold text-white">Troubleshooting:</p>
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-400">
                <li>Ensure contracts are deployed with your address in VERIFIER_ADDRESSES</li>
                <li>Check that NEXT_PUBLIC_SUBMISSION_CONTRACT matches the deployed contract</li>
                <li>Verify you're connected to the correct network ({REQUIRED_CHAIN_NAME})</li>
                <li>Check browser console for detailed error messages</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="min-h-screen bg-background px-4 py-6 sm:py-8 pb-20">
      <div className="mx-auto max-w-6xl">
        <BackButton href="/" />
        
        <div className="mb-8 mt-6 flex items-start justify-between">
          <div>
          <h1 className="mb-2 text-4xl font-bold uppercase tracking-wide text-white sm:text-5xl">
            Verifier Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            Review and verify cleanup submissions. Assign levels (1-10) based on impact and quality.
          </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                setLoading(true)
                loadCleanups()
              }}
              disabled={loading}
              variant="outline"
              className="gap-2 border-gray-700 bg-gray-900 text-white hover:bg-gray-800"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Search by Wallet Address */}
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
          <h3 className="mb-3 text-sm font-semibold uppercase text-gray-400">Search Cleanups by Wallet</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter wallet address (e.g., ...2493)"
              value={searchWallet}
              onChange={(e) => setSearchWallet(e.target.value)}
              className="flex-1 rounded-lg border border-gray-700 bg-black px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand-green focus:outline-none"
            />
            <Button
              onClick={async () => {
                if (!searchWallet.trim()) return
                setSearching(true)
                setSearchResults([])
                setError(null)
                try {
                  // Search for cleanups by wallet (supports partial addresses like "2493")
                  const results = await findCleanupsByWallet(searchWallet.trim(), 100)
                  setSearchResults(results)
                  if (results.length > 0) {
                    // Reload cleanups to include the found ones
                    await loadCleanups()
                  } else {
                    setError(`No cleanups found for wallet ending in "${searchWallet.trim()}"`)
                  }
                } catch (error: any) {
                  setError(`Search failed: ${error?.message || String(error)}`)
                } finally {
                  setSearching(false)
                }
              }}
              disabled={searching || !searchWallet.trim()}
              variant="outline"
              className="border-brand-green text-brand-green hover:bg-brand-green/10"
            >
              {searching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                'Search'
              )}
            </Button>
          </div>
          {searchResults.length > 0 && (
            <div className="mt-3 rounded-lg border border-green-500/50 bg-green-500/10 p-3">
              <p className="text-sm font-semibold text-green-400">Found {searchResults.length} cleanup(s):</p>
              <ul className="mt-2 space-y-2 text-xs">
                {searchResults.map((result) => (
                  <li key={result.cleanupId.toString()} className="rounded border border-gray-700 bg-gray-800 p-2">
                    <div className="font-mono text-white">Cleanup #{result.cleanupId.toString()}</div>
                    <div className="mt-1 text-gray-400">
                      Wallet: {result.user}
                    </div>
                    <div className="mt-1">
                      Status: {result.verified ? '✓ Verified' : '⏳ Pending'} | Level: {result.level} | {result.claimed ? 'Claimed' : 'Not Claimed'}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-gray-800 bg-gray-900 p-4">
            <div className="text-sm text-gray-400">Total Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-white">{cleanups.length}</div>
            {pollingStatus && (
              <div className="mt-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-2 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-yellow-400">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Waiting for verification... (check {pollingStatus.count}/90)</span>
                </div>
              </div>
            )}
          </div>
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="text-sm text-gray-400">Pending Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-yellow-400">{pendingCleanups.length}</div>
          </div>
          <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
            <div className="text-sm text-gray-400">Verified Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-green-400">{verifiedCleanups.length}</div>
          </div>
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <div className="text-sm text-gray-400">Rejected Cleanups</div>
            <div className="mt-1 text-2xl font-bold text-red-400">{rejectedCleanups.length}</div>
          </div>
        </div>

        {/* Pending Cleanups */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Pending Verification</h2>
          {pendingCleanups.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No pending cleanups to verify.
            </div>
          ) : (
            <div className="space-y-4">
              {pendingCleanups.map((cleanup) => (
                <div
                  key={cleanup.id.toString()}
                  className="rounded-lg border border-gray-800 bg-gray-900 p-6"
                >
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-2 text-lg font-bold text-white">Cleanup #{cleanup.id.toString()}</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="h-4 w-4" />
                          <span className="font-mono text-xs">{cleanup.user}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(cleanup.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span>{formatCoordinates(cleanup.latitude, cleanup.longitude)}</span>
                        </div>
                        {cleanup.referrer !== '0x0000000000000000000000000000000000000000' && (
                          <div className="flex items-center gap-2 text-xs text-yellow-400">
                            <Users className="h-3 w-3" />
                            <span>Referred by: <span className="font-mono text-[10px]">{cleanup.referrer.slice(0, 6)}...{cleanup.referrer.slice(-4)}</span> (both will earn 3 $cDCU each when invitee claims their first level)</span>
                          </div>
                        )}
                        <div className="text-xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const formId = cleanup.id.toString()
                              console.log('Impact report button clicked:', {
                                cleanupId: formId,
                                hasImpactForm: cleanup.hasImpactForm,
                                impactReportHash: cleanup.impactReportHash,
                                currentlyExpanded: expandedForms.has(formId),
                              })
                              setExpandedForms(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(formId)) {
                                  newSet.delete(formId)
                                  console.log('Collapsing impact report for cleanup', formId)
                                } else {
                                  newSet.add(formId)
                                  console.log('Expanding impact report for cleanup', formId)
                                }
                                return newSet
                              })
                            }}
                            className={`flex items-center gap-1 hover:opacity-80 cursor-pointer ${
                              cleanup.hasImpactForm 
                                ? 'text-green-400 hover:text-green-300' 
                                : 'text-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {cleanup.hasImpactForm ? (
                              <>
                                ✓ Impact Report submitted
                                <span className="text-xs text-gray-400 ml-1">
                                  ({expandedForms.has(cleanup.id.toString()) ? 'hide' : 'expand'})
                                </span>
                              </>
                            ) : (
                              <>
                                ✗ Impact Report not submitted
                                <span className="text-xs text-gray-400 ml-1">
                                  ({expandedForms.has(cleanup.id.toString()) ? 'hide' : 'expand'})
                                </span>
                              </>
                            )}
                          </button>
                          {expandedForms.has(cleanup.id.toString()) && (
                            <div className="mt-2">
                              {cleanup.hasImpactForm && cleanup.impactReportHash ? (
                                <ImpactReportDetails key={`${cleanup.id}-${cleanup.impactReportHash}`} impactReportHash={cleanup.impactReportHash} />
                              ) : (
                                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-400">
                                  No impact report data available for this cleanup.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>Before Photo</span>
                          {(() => {
                            const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                            const allowed = impactData?.beforePhotoAllowed
                            if (allowed === true) {
                              return <CheckCircle className="h-4 w-4 text-green-400" aria-label="User allowed use of this image" />
                            } else if (allowed === false) {
                              return <XCircle className="h-4 w-4 text-red-400" aria-label="User did not allow use of this image" />
                            }
                            return null
                          })()}
                        </div>
                        {getIPFSUrl(cleanup.beforePhotoHash) ? (
                          <a
                            href={getIPFSUrl(cleanup.beforePhotoHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block overflow-hidden rounded-lg border border-gray-700"
                          >
                            <img
                              src={getIPFSUrl(cleanup.beforePhotoHash)!}
                              alt="Before"
                              className="h-32 w-full object-cover"
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.beforePhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                            {(() => {
                              const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                              const allowed = impactData?.beforePhotoAllowed
                              if (allowed === true) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1.5" title="Allowed for social media">
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  </div>
                                )
                              } else if (allowed === false) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5" title="Not allowed for social media">
                                    <XCircle className="h-4 w-4 text-white" />
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>After Photo</span>
                          {(() => {
                            const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                            const allowed = impactData?.afterPhotoAllowed
                            if (allowed === true) {
                              return <CheckCircle className="h-4 w-4 text-green-400" aria-label="User allowed use of this image" />
                            } else if (allowed === false) {
                              return <XCircle className="h-4 w-4 text-red-400" aria-label="User did not allow use of this image" />
                            }
                            return null
                          })()}
                        </div>
                        {getIPFSUrl(cleanup.afterPhotoHash) ? (
                          <a
                            href={getIPFSUrl(cleanup.afterPhotoHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block overflow-hidden rounded-lg border border-gray-700"
                          >
                            <img
                              src={getIPFSUrl(cleanup.afterPhotoHash)!}
                              alt="After"
                              className="h-32 w-full object-cover"
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.afterPhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                            {(() => {
                              const impactData = cleanup.impactReportHash ? impactDataMap.get(cleanup.impactReportHash) : null
                              const allowed = impactData?.afterPhotoAllowed
                              if (allowed === true) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-green-500/90 p-1.5" title="Allowed for social media">
                                    <CheckCircle className="h-4 w-4 text-white" />
                                  </div>
                                )
                              } else if (allowed === false) {
                                return (
                                  <div className="absolute right-2 top-2 rounded-full bg-red-500/90 p-1.5" title="Not allowed for social media">
                                    <XCircle className="h-4 w-4 text-white" />
                                  </div>
                                )
                              }
                              return null
                            })()}
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-gray-400">
                      Level will be assigned automatically based on user's current Impact Product level (next level up, max 10)
                    </div>
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleReject(cleanup.id)}
                        disabled={rejecting || verifying}
                        variant="outline"
                        className="border-red-500 text-red-400 hover:bg-red-500/10"
                      >
                        {rejecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Rejecting...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => handleVerify(cleanup.id)}
                        disabled={verifying || rejecting}
                        className="bg-brand-green text-black hover:bg-brand-green/90"
                      >
                        {verifying ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Verify & Assign Level
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  {activeTx && activeTx.cleanupId === cleanup.id && (
                    <div className="mt-4 rounded-lg border border-brand-green/40 bg-brand-green/5 p-4 text-sm text-white">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-brand-green" />
                        <span>Verification transaction submitted. Waiting for Celo confirmation…</span>
                      </div>
                      <a
                        href={getExplorerTxUrl(activeTx.hash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-2 text-xs text-brand-green underline hover:text-brand-green/80"
                      >
                        <ExternalLink className="h-3 w-3" />
                        View on {BLOCK_EXPLORER_NAME}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verified Cleanups */}
        <div className="mb-8">
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Verified Cleanups</h2>
          {verifiedCleanups.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No verified cleanups yet.
            </div>
          ) : (
            <div className="space-y-4">
              {verifiedCleanups.map((cleanup) => (
                <div
                  key={cleanup.id.toString()}
                  className="rounded-lg border border-green-500/50 bg-green-500/10 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-400" />
                        <span className="font-bold text-white">Cleanup #{cleanup.id.toString()}</span>
                      </div>
                      <div className="mt-2 text-sm text-gray-400">
                        Level {cleanup.level} ({getLevelName(cleanup.level)}) • {formatDate(cleanup.timestamp)}
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        User: <span className="font-mono">{cleanup.user.slice(0, 10)}...{cleanup.user.slice(-8)}</span>
                      </div>
                    </div>
                    <div className="text-sm text-gray-400">
                      {cleanup.claimed ? (
                        <span className="text-green-400">✓ Claimed</span>
                      ) : (
                        <span className="text-yellow-400">Pending Claim</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rejected Cleanups */}
        <div>
          <h2 className="mb-4 text-2xl font-bold uppercase text-white">Rejected Cleanups</h2>
          {rejectedCleanups.length === 0 ? (
            <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
              No rejected cleanups.
            </div>
          ) : (
            <div className="space-y-4">
              {rejectedCleanups.map((cleanup) => (
                <div
                  key={cleanup.id.toString()}
                  className="rounded-lg border border-red-500/50 bg-red-500/10 p-6"
                >
                  <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-400" />
                        <span className="font-bold text-white">Cleanup #{cleanup.id.toString()}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="h-4 w-4" />
                          <span className="font-mono text-xs">{cleanup.user}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(cleanup.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin className="h-4 w-4" />
                          <span>{formatCoordinates(cleanup.latitude, cleanup.longitude)}</span>
                        </div>
                        <div className="text-xs">
                          <button
                            onClick={() => {
                              const formId = `verified-${cleanup.id.toString()}`
                              setExpandedForms(prev => {
                                const newSet = new Set(prev)
                                if (newSet.has(formId)) {
                                  newSet.delete(formId)
                                } else {
                                  newSet.add(formId)
                                }
                                return newSet
                              })
                            }}
                            className={`flex items-center gap-1 hover:opacity-80 ${
                              cleanup.hasImpactForm 
                                ? 'text-green-400 hover:text-green-300' 
                                : 'text-gray-500 hover:text-gray-400'
                            }`}
                          >
                            {cleanup.hasImpactForm ? (
                              <>
                                ✓ Impact Report submitted
                                <span className="text-xs text-gray-400 ml-1">
                                  ({expandedForms.has(`verified-${cleanup.id.toString()}`) ? 'hide' : 'expand'})
                                </span>
                              </>
                            ) : (
                              <>
                                ✗ Impact Report not submitted
                                <span className="text-xs text-gray-400 ml-1">
                                  ({expandedForms.has(`verified-${cleanup.id.toString()}`) ? 'hide' : 'expand'})
                                </span>
                              </>
                            )}
                          </button>
                          {expandedForms.has(`verified-${cleanup.id.toString()}`) && (
                            <div className="mt-2">
                              {cleanup.hasImpactForm && cleanup.impactReportHash ? (
                                <ImpactReportDetails key={`${cleanup.id}-${cleanup.impactReportHash}`} impactReportHash={cleanup.impactReportHash} />
                              ) : (
                                <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-400">
                                  No impact report data available for this cleanup.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-2 text-xs text-gray-400">Before Photo</div>
                        {getIPFSUrl(cleanup.beforePhotoHash) ? (
                          <a
                            href={getIPFSUrl(cleanup.beforePhotoHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block overflow-hidden rounded-lg border border-gray-700"
                          >
                            <img
                              src={getIPFSUrl(cleanup.beforePhotoHash)!}
                              alt="Before"
                              className="h-32 w-full object-cover"
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.beforePhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="mb-2 text-xs text-gray-400">After Photo</div>
                        {getIPFSUrl(cleanup.afterPhotoHash) ? (
                          <a
                            href={getIPFSUrl(cleanup.afterPhotoHash)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block overflow-hidden rounded-lg border border-gray-700"
                          >
                            <img
                              src={getIPFSUrl(cleanup.afterPhotoHash)!}
                              alt="After"
                              className="h-32 w-full object-cover"
                              crossOrigin="anonymous"
                              loading="lazy"
                              onError={(e) => {
                                const img = e.currentTarget
                                const hash = cleanup.afterPhotoHash
                                const fallbacks = getIPFSFallbackUrls(hash)
                                const currentSrc = img.src
                                const hashFromUrl = currentSrc.split('/ipfs/')[1]?.split('?')[0]
                                const currentIndex = fallbacks.findIndex(url => url.includes(hashFromUrl || ''))
                                
                                if (currentIndex >= 0 && currentIndex < fallbacks.length - 1) {
                                  // Try next fallback
                                  img.src = fallbacks[currentIndex + 1]
                                } else {
                                  // All fallbacks exhausted, show placeholder
                                  img.src = '/placeholder-image.png'
                                  img.onerror = null // Prevent infinite loop
                                }
                              }}
                            />
                          </a>
                        ) : (
                          <div className="flex h-32 items-center justify-center rounded-lg border border-gray-700 bg-gray-800 text-xs text-gray-500">
                            No photo
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        const formId = `rejected-${cleanup.id.toString()}`
                        setExpandedForms(prev => {
                          const newSet = new Set(prev)
                          if (newSet.has(formId)) {
                            newSet.delete(formId)
                          } else {
                            newSet.add(formId)
                          }
                          return newSet
                        })
                      }}
                      className={`text-sm hover:opacity-80 ${
                        cleanup.hasImpactForm 
                          ? 'text-green-400 hover:text-green-300' 
                          : 'text-gray-500 hover:text-gray-400'
                      }`}
                    >
                      {cleanup.hasImpactForm ? (
                        <>
                          ✓ Impact Report submitted
                          <span className="text-xs text-gray-400 ml-1">
                            ({expandedForms.has(`rejected-${cleanup.id.toString()}`) ? 'hide' : 'expand'})
                          </span>
                        </>
                      ) : (
                        <>
                          ✗ Impact Report not submitted
                          <span className="text-xs text-gray-400 ml-1">
                            ({expandedForms.has(`rejected-${cleanup.id.toString()}`) ? 'hide' : 'expand'})
                          </span>
                        </>
                      )}
                    </button>
                    {expandedForms.has(`rejected-${cleanup.id.toString()}`) && (
                      <div className="mt-2">
                        {cleanup.hasImpactForm && cleanup.impactReportHash ? (
                          <ImpactReportDetails key={`${cleanup.id}-${cleanup.impactReportHash}`} impactReportHash={cleanup.impactReportHash} />
                        ) : (
                          <div className="rounded-lg border border-gray-700 bg-gray-800 p-3 text-sm text-gray-400">
                            No impact report data available for this cleanup.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                    <div className="flex items-center gap-2 text-sm text-red-400">
                      <XCircle className="h-4 w-4" />
                      <span className="font-semibold">This cleanup was rejected</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Rejected cleanups cannot be verified. The user will need to submit a new cleanup.
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

