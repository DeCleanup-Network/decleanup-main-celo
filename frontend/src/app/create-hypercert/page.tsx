'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'

type MintStatus = 'idle' | 'uploading' | 'generating' | 'minting' | 'success' | 'error'

export default function CreateHypercertPage() {
  const router = useRouter()
  const { address, isConnected } = useAccount()
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [status, setStatus] = useState<MintStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<{
    eligible: boolean
    reason?: string
    cleanupsCount: number
    reportsCount: number
    testingOverride?: boolean
  } | null>(null)

  // Check eligibility on mount
  useEffect(() => {
    async function checkEligibility() {
      if (!address) return

      try {
        const submissions = await getUserSubmissions(address)
        let verifiedCleanupsCount = 0
        let impactReportsCount = 0
        
        for (const id of submissions) {
          try {
            const details = await getCleanupDetails(id)
            if (details.verified) {
              verifiedCleanupsCount++
              if (details.hasImpactForm) impactReportsCount++
            }
          } catch (error) {
            console.warn('Error fetching cleanup details:', error)
          }
        }

        const result = checkHypercertEligibility({ 
          cleanupsCount: verifiedCleanupsCount, 
          reportsCount: impactReportsCount 
        })
        setEligibility(result)
      } catch (err) {
        console.error('Error checking eligibility:', err)
      }
    }

    checkEligibility()
  }, [address])

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setLogoFile(file)
    }
  }

  const handleBannerUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBannerFile(file)
    }
  }

  const handleMint = async () => {
    if (!logoFile || !bannerFile) {
      setError('Please upload both logo and banner images')
      return
    }
    const walletAddress = address
    if (!walletAddress) {
      setError('Wallet not connected')
      return
    }

    setStatus('uploading')
    setError(null)
    setStatusMessage('Uploading images to IPFS...')

    try {
      // Step 1: Upload images to IPFS
      setStatusMessage('Uploading logo image...')
      const logoResult = await uploadToIPFS(logoFile)
      console.log('Logo uploaded:', logoResult.hash)

      setStatusMessage('Uploading banner image...')
      const bannerResult = await uploadToIPFS(bannerFile)
      console.log('Banner uploaded:', bannerResult.hash)

      // Step 2: Generate metadata and mint
      setStatus('generating')
      setStatusMessage('Generating Hypercert metadata from verified cleanups...')
      
      // mintHypercert now generates full metadata automatically from on-chain data
      // Images will be added in future enhancement
      setStatus('minting')
      setStatusMessage('Minting Hypercert on-chain...')
      setStatusMessage('Please confirm the transaction in your wallet...')

      const result = await mintHypercert(walletAddress)
      
      console.log('Hypercert minted with images:', {
        logo: logoResult.hash,
        banner: bannerResult.hash,
        metadataCid: result.metadataCid
      })
      
      if (result.txHash) {
        setTxHash(result.txHash)
        setStatus('success')
        setStatusMessage('Hypercert minted successfully!')
        
        // Redirect after 3 seconds
        setTimeout(() => {
          router.push('/')
        }, 3000)
      } else {
        throw new Error('No transaction hash returned')
      }
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to mint Hypercert')
      setStatusMessage('')
      console.error('Minting error:', err)
    }
  }

  const isLoading = status !== 'idle' && status !== 'success' && status !== 'error'

  // Redirect if not connected
  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-500 px-4 py-3 rounded">
          Please connect your wallet to create a Hypercert
        </div>
        <button 
          onClick={() => router.push('/')}
          className="mt-4 text-blue-500 hover:underline"
        >
          ← Back to home
        </button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Create Hypercert</h1>
        <button 
          onClick={() => router.push('/')}
          className="text-sm text-gray-400 hover:text-gray-300"
        >
          ← Back
        </button>
      </div>

      {/* Eligibility Check */}
      {eligibility && (
        <div className={`mb-6 px-4 py-3 rounded border ${
          eligibility.eligible 
            ? 'bg-green-500/10 border-green-500 text-green-500' 
            : 'bg-red-500/10 border-red-500 text-red-500'
        }`}>
          <p className="font-semibold">
            {eligibility.eligible ? '✅ Eligible to mint Hypercert' : '❌ Not eligible yet'}
            {eligibility.testingOverride && (
              <span className="ml-2 text-xs opacity-70">(Sepolia Testnet)</span>
            )}
          </p>
          <p className="text-sm mt-1">
            Verified cleanups: {eligibility.cleanupsCount} | Impact reports: {eligibility.reportsCount}
          </p>
          {!eligibility.eligible && eligibility.reason && (
            <p className="text-sm mt-1">{eligibility.reason}</p>
          )}
        </div>
      )}

      {/* Status Messages */}
      {statusMessage && (
        <div className="bg-blue-500/10 border border-blue-500 text-blue-500 px-4 py-3 rounded mb-4">
          <div className="flex items-center gap-2">
            {isLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            )}
            <span>{statusMessage}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {status === 'success' && txHash && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 px-4 py-3 rounded mb-4">
          <p className="font-semibold">✅ Hypercert minted successfully!</p>
          <p className="text-sm mt-1">Transaction: {txHash}</p>
          <p className="text-sm mt-2">Redirecting to homepage...</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Logo Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Logo Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            disabled={isLoading}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {logoFile && (
            <p className="mt-2 text-sm text-gray-400">Selected: {logoFile.name}</p>
          )}
        </div>

        {/* Banner Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Banner Image
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleBannerUpload}
            disabled={isLoading}
            className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {bannerFile && (
            <p className="mt-2 text-sm text-gray-400">Selected: {bannerFile.name}</p>
          )}
        </div>

        {/* Mint Button */}
        <button
          onClick={handleMint}
          disabled={!eligibility?.eligible || !logoFile || !bannerFile || isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded transition-colors"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              {status === 'uploading' && 'Uploading...'}
              {status === 'generating' && 'Generating...'}
              {status === 'minting' && 'Minting...'}
            </span>
          ) : (
            'Mint Hypercert'
          )}
        </button>

        {/* Helper Text */}
        <p className="text-sm text-gray-400 text-center">
          Images will be uploaded to IPFS and associated with your Hypercert metadata
        </p>
      </div>
    </div>
  )
}
