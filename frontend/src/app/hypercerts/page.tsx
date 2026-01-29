'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import { buildHypercertMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { submitHypercertRequest, getHypercertRequestsByUser, updateRequestWithHypercertId } from '@/lib/blockchain/hypercerts/requests'

export default function HypercertsTestPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

  // Debug e correção do chainId
  useEffect(() => {
    console.log('🔍 [ChainId Raw]', {
      chainId,
      type: typeof chainId,
      expected: 'Should be 44787 (Sepolia) or 42220 (Mainnet)',
      willFix: chainId !== 44787 && chainId !== 42220
    })
  }, [chainId])
  
  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState<any>(null)
  const [aggregatedData, setAggregatedData] = useState<any>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [submitResult, setSubmitResult] = useState<string>('')

  useEffect(() => {
    if (!address || !isConnected) return

    async function loadData() {
      setLoading(true)
      try {
        // Get user's verified cleanups
        const submissions = await getUserSubmissions(address as `0x${string}`)
        const verifiedCleanups = []
        let impactReportsCount = 0

        for (const id of submissions) {
          try {
            const details = await getCleanupDetails(id)
            if (details.verified) {
              verifiedCleanups.push({
                cleanupId: id.toString(),
                verifiedAt: Number(details.timestamp),
              })
              if (details.hasImpactForm) impactReportsCount++
            }
          } catch (error) {
            console.warn('Error fetching cleanup details:', error)
          }
        }

        // Check eligibility - fix chainId if corrupted
        const validChainId = chainId === 44787 || chainId === 42220 ? chainId : 44787 // default to Sepolia
        console.log('🔍 [Using ChainId]', validChainId)
        
        const eligibilityResult = checkHypercertEligibility({
          cleanupsCount: verifiedCleanups.length,
          reportsCount: impactReportsCount,
          chainId: validChainId,
        })
        setEligibility(eligibilityResult)

        // Aggregate data
        if (verifiedCleanups.length > 0) {
          const aggregated = aggregateUserCleanups(verifiedCleanups)
          setAggregatedData({
            ...aggregated,
            totalReports: impactReportsCount,
            cleanupIds: verifiedCleanups.map(c => c.cleanupId)
          })

          // Build metadata
          const metadataInput = {
            userAddress: address as `0x${string}`,
            cleanups: verifiedCleanups,
            summary: {
              totalCleanups: aggregated.totalCleanups,
              totalReports: impactReportsCount,
              timeframeStart: aggregated.timeframeStart,
              timeframeEnd: aggregated.timeframeEnd,
            },
            issuer: 'DeCleanup Network',
            version: 'v1',
            narrative: {
              description: 'Environmental cleanup impact certificate from DeCleanup Network test milestone.',
              locations: [],
              wasteTypes: [],
              challenges: 'Testing phase implementation',
              preventionIdeas: 'Continued environmental education and cleanup initiatives',
            },
          }
          const metadataResult = buildHypercertMetadata(metadataInput)
          setMetadata(metadataResult)
        }
      } catch (error) {
        console.error('Error loading Hypercerts data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [address, isConnected])

  const [userRequests, setUserRequests] = useState<any[]>([])

  // Load user's existing requests
  useEffect(() => {
    if (!address) return
    
    const requests = getHypercertRequestsByUser(address)
    setUserRequests(requests)
    console.log('📋 User Hypercert requests:', requests)
  }, [address, submitResult]) // Refresh when new request is submitted

  const handleSubmitRequest = async () => {
    if (!address || !metadata) return

    setSubmitResult('Submitting request...')
    try {
      // Submit Hypercert request for verifier review
      const request = submitHypercertRequest({
        requester: address,
        metadata: metadata,
      })

      console.log('✅ Hypercert request submitted:', request)
      
      setSubmitResult(
        `Request submitted successfully!\n\n` +
        `Request ID: ${request.id}\n` +
        `Status: ${request.status}\n\n` +
        `Your Hypercert is now pending verifier approval. ` +
        `You will be notified once a verifier reviews your submission.`
      )
    } catch (error) {
      console.error('Error submitting Hypercert request:', error)
      setSubmitResult(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleMintApprovedRequest = async (requestId: string) => {
    if (!address) return

    const request = userRequests.find(r => r.id === requestId)
    if (!request || request.status !== 'APPROVED') {
      setSubmitResult('Error: Request not found or not approved')
      return
    }

    setSubmitResult('Minting Hypercert...')
    try {
      console.log('🪙 Minting approved request:', requestId)

      // Mint Hypercert with the approved metadata
      const result = await mintHypercert(address, request.metadata)

      console.log('✅ Hypercert minted:', result)

      // Update request with hypercert ID
      updateRequestWithHypercertId(requestId, result.hypercertId)

      // Refresh requests list
      const updatedRequests = getHypercertRequestsByUser(address)
      setUserRequests(updatedRequests)

      setSubmitResult(
        `Hypercert minted successfully!\n\n` +
        `Transaction: ${result.txHash}\n` +
        `Hypercert ID: ${result.hypercertId}\n` +
        `Metadata CID: ${result.metadataCid}\n\n` +
        `Your Hypercert is now on-chain!`
      )
    } catch (error) {
      console.error('Error minting Hypercert:', error)
      setSubmitResult(`Minting failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const getNetworkName = () => {
  // Use o chainId corrigido
  const validChainId = chainId === 44787 || chainId === 42220 ? chainId : 44787
  
  if (validChainId === 44787) return 'Celo Sepolia (Testnet)'
  if (validChainId === 42220) return 'Celo Mainnet'
  return `Chain ID: ${validChainId} (corrected from ${chainId})`
}

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 sm:gap-6 px-4 py-4 sm:px-6 sm:py-6">
          {/* Header Section */}
          <div className="flex items-center justify-between flex-shrink-0 mb-2">
            <div>
              <h1 className="font-bebas text-3xl sm:text-4xl lg:text-5xl tracking-wider text-foreground">
                CREATE HYPERCERT
              </h1>
              <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">
                Aggregate your verified cleanups into an environmental impact certificate
              </p>
            </div>
          </div>

          <div className="flex flex-col rounded-2xl border border-border bg-card p-6 sm:p-8 min-h-[400px] sm:min-h-[500px]">
            <div className="flex flex-1 flex-col items-center justify-center text-center min-h-0">
              <div className="mb-4 rounded-2xl border-2 border-border/50 bg-gradient-to-br from-brand-green/5 to-transparent p-8 sm:p-12">
                <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-muted-foreground/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔗</span>
                </div>
              </div>
              <h3 className="mb-2 font-bebas text-2xl sm:text-3xl tracking-wider text-foreground">
                WALLET NOT CONNECTED
              </h3>
              <p className="text-sm sm:text-base text-muted-foreground max-w-xs">
                Please connect your wallet to test Hypercerts functionality.
              </p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 sm:gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {/* Header Section */}
        <div className="flex items-center justify-between flex-shrink-0 mb-2">
          <div>
            <h1 className="font-bebas text-3xl sm:text-4xl lg:text-5xl tracking-wider text-foreground">
              CREATE HYPERCERT
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">
              Aggregate your verified cleanups into an environmental impact certificate
            </p>
          </div>
        </div>

        {/* Network & Wallet Info */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">Network:</span>
            <span className="px-2 py-1 bg-muted rounded text-xs font-medium">{getNetworkName()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">Wallet:</span>
            <span className="px-2 py-1 bg-muted rounded text-xs font-mono">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
          </div>
        </div>

        {/* How It Works Section */}
        <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-5 w-5 rounded-full bg-brand-blue"></div>
            <h2 className="font-bebas text-lg sm:text-xl tracking-wider text-foreground">
              HOW IT WORKS
            </h2>
          </div>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">1.</span>
              <span>Your verified cleanups and reports are aggregated</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">2.</span>
              <span>You submit a Hypercert creation request</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">3.</span>
              <span>Verifiers review your impact</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">4.</span>
              <span>Hypercert is minted after approval</span>
            </li>
          </ol>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Eligibility Status */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 rounded-full bg-brand-green"></div>
                <h2 className="font-bebas text-lg sm:text-xl tracking-wider text-foreground">
                  ELIGIBILITY STATUS
                </h2>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : eligibility ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Eligible to Mint</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      eligibility.eligible
                        ? 'bg-brand-green/20 text-brand-green'
                        : 'bg-red-500/20 text-red-500'
                    }`}>
                      {eligibility.eligible ? 'YES' : 'NO'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Rule Set</span>
                    <span className="px-2 py-1 bg-muted rounded text-xs font-medium">
                      {eligibility.testingOverride ? 'TESTNET' : 'MAINNET'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Verified Cleanups</span>
                    <span className="font-bebas text-lg">{eligibility.cleanupsCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Impact Reports</span>
                    <span className="font-bebas text-lg">{eligibility.reportsCount}</span>
                  </div>
                  {!eligibility.eligible && (
                    <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-sm text-red-400">{eligibility.reason}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No eligibility data available.</p>
              )}
            </div>
            {/* Levels vs Hypercerts Explanation */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 rounded-full bg-muted-foreground"></div>
                <h3 className="font-bebas text-sm tracking-wider text-muted-foreground">
                  LEVELS vs HYPERCERTS
                </h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Levels are earned per verified cleanup via Impact Products.
                Hypercerts are minted separately and represent aggregated impact
                across multiple verified cleanups with impact reports.
              </p>
            </div>
            {/* User's Requests */}
            {userRequests.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-5 w-5 rounded-full bg-brand-blue"></div>
                  <h2 className="font-bebas text-lg sm:text-xl tracking-wider text-foreground">
                    YOUR REQUESTS
                  </h2>
                </div>
                <div className="space-y-3">
                  {userRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-muted-foreground">{request.id}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          request.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                          request.status === 'APPROVED' ? 'bg-brand-green/20 text-brand-green' :
                          'bg-red-500/20 text-red-500'
                        }`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Submitted: {new Date(request.submittedAt).toLocaleDateString()}
                      </div>
                      {request.reviewedAt && (
                        <div className="text-xs text-muted-foreground">
                          Reviewed: {new Date(request.reviewedAt).toLocaleDateString()}
                        </div>
                      )}
                      {request.hypercertId && (
                        <div className="text-xs text-brand-green mt-2">
                          ✅ Minted: {request.hypercertId}
                        </div>
                      )}
                      {request.status === 'APPROVED' && !request.hypercertId && (
                        <button
                          onClick={() => handleMintApprovedRequest(request.id)}
                          className="mt-2 w-full gap-2 bg-brand-green py-2 font-bebas text-sm tracking-wider text-black hover:bg-brand-green/80 rounded-md transition-all flex items-center justify-center"
                        >
                          🪙 MINT HYPERCERT
                        </button>
                      )}
                      {request.status === 'REJECTED' && request.rejectionReason && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
                          Reason: {request.rejectionReason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Submit for Review */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 rounded-full bg-brand-yellow"></div>
                <h2 className="font-bebas text-lg sm:text-xl tracking-wider text-foreground">
                  SUBMIT FOR REVIEW
                </h2>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleSubmitRequest}
                  disabled={!eligibility?.eligible}
                  className="w-full gap-2 bg-brand-yellow py-3 sm:py-4 font-bebas text-sm sm:text-base tracking-wider text-black hover:bg-[#e6e600] disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all flex items-center justify-center"
                >
                  SUBMIT HYPERCERT FOR REVIEW
                </button>
                {submitResult && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm font-mono whitespace-pre-line">{submitResult}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Aggregated Impact Summary */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 rounded-full bg-brand-blue"></div>
                <h2 className="font-bebas text-lg sm:text-xl tracking-wider text-foreground">
                  IMPACT SUMMARY
                </h2>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : aggregatedData ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center">
                      <div className="font-bebas text-2xl text-brand-green">{aggregatedData.totalCleanups}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Cleanups</div>
                    </div>
                    <div className="text-center">
                      <div className="font-bebas text-2xl text-brand-yellow">{aggregatedData.totalReports}</div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">Reports</div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">Timeframe</div>
                    <div className="font-mono text-xs">
                      {new Date(aggregatedData.timeframeStart).toLocaleDateString()} - {new Date(aggregatedData.timeframeEnd).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border">
                    <div className="text-sm text-muted-foreground mb-2">Cleanup IDs ({aggregatedData.cleanupIds.length})</div>
                    <div className="max-h-32 overflow-y-auto">
                      {aggregatedData.cleanupIds.map((id: string, index: number) => (
                        <div key={id} className="font-mono text-xs text-muted-foreground">
                          {index + 1}. {id}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No impact data available.</p>
              )}
            </div>

            {/* Metadata Preview */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-5 w-5 rounded-full bg-purple-500"></div>
                <h2 className="font-bebas text-lg sm:text-xl tracking-wider text-foreground">
                  METADATA PREVIEW
                </h2>
              </div>
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : metadata ? (
                <pre className="bg-muted p-3 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                  {JSON.stringify(metadata, null, 2)}
                </pre>
              ) : (
                <p className="text-sm text-muted-foreground">No metadata available.</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}