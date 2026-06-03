'use client'

import { useEffect, useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DeCleanupPageHero } from '@/components/layout/DeCleanupPageHero'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import { getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import { buildHypercertMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import {
  submitHypercertRequest,
  fetchHypercertRequestsByUser,
  updateRequestWithHypercertId,
  hasOpenHypercertWorkflow,
} from '@/lib/blockchain/hypercerts/requests'

export default function HypercertsCertificationPage() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount()
  const { address: appAddress, showMainApp } = useAppWalletAddress()
  const { signMessageAsync } = useSignMessage()
  const chainId = useResolvedChainId()
  const { submissionOwnerAddress } = useSmartAccountClient()
  const submissionDataAddress = submissionOwnerAddress as `0x${string}` | undefined
  const displayAddress = (wagmiConnected ? wagmiAddress : appAddress) as `0x${string}` | undefined
  const signerAddress = wagmiConnected ? (wagmiAddress as `0x${string}`) : displayAddress

  useEffect(() => {
    console.log('🔍 [ChainId Raw]', {
      chainId,
      type: typeof chainId,
      expected: 'Should be 11142220 (Sepolia) or 42220 (Mainnet)',
      willFix: chainId !== 11142220 && chainId !== 42220
    })
  }, [chainId])

  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState<any>(null)
  const [aggregatedData, setAggregatedData] = useState<any>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [submitResult, setSubmitResult] = useState<string>('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [brandingTitle, setBrandingTitle] = useState<string>('')
  const [brandingDescription, setBrandingDescription] = useState<string>('')
  const [brandingCids, setBrandingCids] = useState<{ logoImageCid?: string; bannerImageCid?: string } | null>(null)
  const [userRequests, setUserRequests] = useState<any[]>([])

  useEffect(() => {
    if (!showMainApp) return

    async function loadData() {
      setLoading(true)
      try {
        const owner = submissionDataAddress
        if (!owner) {
          setEligibility(null)
          setAggregatedData(null)
          return
        }
        const submissions = await getUserSubmissions(owner)
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

        const validChainId = chainId === 11142220 || chainId === 42220 ? chainId : 11142220
        console.log('🔍 [Using ChainId]', validChainId)

        const eligibilityResult = checkHypercertEligibility({
          cleanupsCount: verifiedCleanups.length,
          reportsCount: impactReportsCount,
          chainId: validChainId,
        })
        setEligibility(eligibilityResult)

        if (verifiedCleanups.length > 0) {
          const aggregated = aggregateUserCleanups(verifiedCleanups)
          setAggregatedData({
            ...aggregated,
            totalReports: impactReportsCount,
            cleanupIds: verifiedCleanups.map(c => c.cleanupId)
          })

          const metadataInput = {
            userAddress: owner,
            cleanups: verifiedCleanups,
            summary: {
              totalCleanups: aggregated.totalCleanups,
              totalReports: impactReportsCount,
              timeframeStart: aggregated.timeframeStart,
              timeframeEnd: aggregated.timeframeEnd,
            },
            issuer: 'DeCleanup Network',
            version: 'v1',
            branding: brandingCids ? {
              logoImageCid: brandingCids.logoImageCid,
              bannerImageCid: brandingCids.bannerImageCid,
              title: brandingTitle,
              description: brandingDescription
            } : undefined,
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

    void loadData()
  }, [showMainApp, brandingCids, brandingTitle, brandingDescription, submissionDataAddress, chainId])

  useEffect(() => {
    if (!signerAddress) return
    void (async () => {
      const requests = await fetchHypercertRequestsByUser(signerAddress)
      setUserRequests(requests)
      console.log('📋 User Hypercert requests:', requests)
    })()
  }, [signerAddress, submitResult])

  const handleBrandingUpload = async (type: 'logo' | 'banner') => {
    try {
      const file = type === 'logo' ? logoFile : bannerFile
      if (!file) {
        setSubmitResult(`No ${type} file selected`)
        return
      }

      setSubmitResult(`Uploading ${type}...`)
      const result = await uploadToIPFS(file)

      if (type === 'logo') {
        setBrandingCids(prev => ({ ...prev, logoImageCid: result.hash }))
        setSubmitResult(`Logo uploaded: ${result.hash}`)
      } else {
        setBrandingCids(prev => ({ ...prev, bannerImageCid: result.hash }))
        setSubmitResult(`Banner uploaded: ${result.hash}`)
      }
    } catch (error) {
      setSubmitResult(`Upload failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const handleSubmitRequest = async () => {
    if (!metadata || !signerAddress) return
    if (!signMessageAsync) {
      setSubmitResult('Wallet signing is required to submit a Hypercert request.')
      return
    }

    setSubmitResult('Submitting request...')
    try {
      const request = await submitHypercertRequest({
        requester: signerAddress,
        metadata,
        signMessageAsync: async ({ message }) => signMessageAsync({ message }),
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
    if (!signerAddress) return
    if (!signMessageAsync) {
      setSubmitResult('Wallet signing is required to record the mint on the server.')
      return
    }

    const request = userRequests.find(r => r.id === requestId)
    if (!request || request.status !== 'APPROVED') {
      setSubmitResult('Error: Request not found or not approved')
      return
    }

    setSubmitResult('Minting Hypercert...')
    try {
      console.log('🪙 Minting approved request:', requestId)

      const result = await mintHypercert(signerAddress, request.metadata)

      console.log('✅ Hypercert minted:', result)

      await updateRequestWithHypercertId(requestId, result.hypercertId, result.txHash, result.metadataCid, {
        requester: signerAddress,
        signMessageAsync: async ({ message }) => signMessageAsync({ message }),
      })

      const updatedRequests = await fetchHypercertRequestsByUser(signerAddress)
      setUserRequests(updatedRequests)

      setSubmitResult(
        `Hypercert minted successfully!\n\n` +
        `Transaction: ${result.txHash}\n` +
        `Hypercert ID: ${result.hypercertId}\n` +
        `Metadata CID: ${result.metadataCid}\n\n` +
        `Your Hypercert is ready!`
      )
    } catch (error) {
      console.error('Error minting Hypercert:', error)
      setSubmitResult(`Minting failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const getNetworkName = () => {
    const validChainId = chainId === 11142220 || chainId === 42220 ? chainId : 11142220
    if (validChainId === 11142220) return 'Celo Sepolia (Testnet)'
    if (validChainId === 42220) return 'Celo Mainnet'
    return `Chain ID: ${validChainId} (corrected from ${chainId})`
  }

  if (!showMainApp) {
    return (
      <div className="min-h-screen bg-background text-foreground selection:bg-brand-yellow/25">
        <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-12">
          <DeCleanupPageHero
            align="center"
            programWord="HYPERCERTS"
            description="Aggregate verified environmental cleanups into impact certificates. Prove your contribution to the network."
            trailing={
              <div className="flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:justify-center">
                <WalletConnect />
                <Button variant="outline" asChild className="border-border bg-card font-heading tracking-wider">
                  <Link href="https://decleanup.net/litepaper" target="_blank" rel="noopener noreferrer">
                    Learn more
                  </Link>
                </Button>
              </div>
            }
          />

          <div className="grid grid-cols-1 gap-4 pt-10 text-left md:grid-cols-3 md:gap-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <div className="font-mono text-xs text-brand-green">-- 01 --</div>
              <div className="font-heading text-xl uppercase tracking-wider">Clean &amp; log</div>
              <p className="text-sm text-muted-foreground">Submit cleanup photos and reports through the app.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <div className="font-mono text-xs text-brand-yellow">-- 02 --</div>
              <div className="font-heading text-xl uppercase tracking-wider">Verification</div>
              <p className="text-sm text-muted-foreground">Decentralized verifiers confirm your environmental impact.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6">
              <div className="font-mono text-xs text-brand-green">-- 03 --</div>
              <div className="font-heading text-xl uppercase tracking-wider">Certification</div>
              <p className="text-sm text-muted-foreground">Mint a permanent Hypercert representing your total work.</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  const workflowBlocked = displayAddress ? hasOpenHypercertWorkflow(userRequests) : false
  const pendingCount = userRequests.filter((r) => r.status === 'PENDING').length
  const approvedToMintCount = userRequests.filter((r) => r.status === 'APPROVED' && !r.hypercertId).length
  const mintedCount = userRequests.filter((r) => r.status === 'MINTED' || !!r.hypercertId).length

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-brand-yellow/25 pb-20">
      <main className="mx-auto max-w-[1200px] space-y-10 px-4 py-8 sm:px-6 lg:space-y-12 lg:py-12">
        <DeCleanupPageHero
          programWord="HYPERCERTS"
          description={
            <>
              Signed in as{' '}
              <span className="font-mono text-foreground">
                {displayAddress?.slice(0, 6)}…{displayAddress?.slice(-4)}
              </span>
              <span className="text-muted-foreground"> · Network </span>
              <span className="font-medium text-foreground">{getNetworkName()}</span>
            </>
          }
          trailing={
            <Button variant="outline" asChild size="sm" className="border-border bg-card font-heading tracking-wider">
              <Link href="/">Home</Link>
            </Button>
          }
        />

        {/* Workflow status banner */}
        <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-[11px] text-yellow-300">
              Pending review: {pendingCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-[11px] text-brand-green">
              Approved: {approvedToMintCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] text-cyan-300">
              Minted: {mintedCount}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {approvedToMintCount > 0
              ? 'You have approved request(s) ready to mint below.'
              : pendingCount > 0
                ? 'Your request is pending verifier review. Mint unlocks after approval.'
                : mintedCount > 0
                  ? 'Your latest approved request has been minted.'
                  : 'Submit a Hypercert request to start the certification workflow.'}
          </p>
        </section>

        {/* Impact Progress / How it works */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
          {[
            { step: '01', title: 'Aggregate', desc: 'Verified data collected', color: 'text-brand-green', active: true },
            { step: '02', title: 'Configure', desc: 'Add optional branding', color: 'text-brand-green', active: true },
            { step: '03', title: 'Request', desc: 'Submit for review', color: 'text-brand-yellow', active: true },
            { step: '04', title: 'Mint', desc: 'Impact certificate', color: 'text-muted-foreground', active: false },
          ].map((s, i) => (
            <div
              key={i}
              className={`group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all hover:bg-muted/30 ${s.active ? 'border-l-2 border-l-brand-green' : ''}`}
            >
              <div className={`${s.color} font-mono text-[10px] tracking-widest`}>-- {s.step} --</div>
              <div className="font-heading text-lg uppercase tracking-wider text-foreground">{s.title}</div>
              <div className="text-[11px] leading-tight text-muted-foreground">{s.desc}</div>
              {i < 3 && (
                <div className="absolute right-[-10px] top-1/2 hidden -translate-y-1/2 text-4xl text-muted/30 md:block">
                  →
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Main Controls - Left 8 Columns */}
          <div className="lg:col-span-8 space-y-8">

            {/* Eligibility & Action Card */}
            <div
              className={`rounded-3xl border p-8 transition-all ${eligibility?.eligible ? 'card-border-glow bg-card' : 'border-border bg-muted/20'}`}
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="space-y-4">
                  <div className="font-heading text-3xl uppercase tracking-wider text-foreground">Certification Status</div>
                  {loading ? (
                    <div className="flex animate-pulse items-center gap-3 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Scanning blockchain for verified impact...</span>
                    </div>
                  ) : eligibility ? (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-4">
                        <div className="rounded-2xl border border-border bg-muted/40 px-10 py-4 text-center">
                          <div className="font-heading text-5xl leading-none text-brand-green">{eligibility.cleanupsCount}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Verified Cleanups</div>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted/40 px-10 py-4 text-center">
                          <div className="font-heading text-5xl leading-none text-brand-yellow">{eligibility.reportsCount}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Impact Reports</div>
                        </div>
                      </div>

                      {!eligibility.eligible && (
                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs text-red-400/80 font-sans">{eligibility.reason}</span>
                        </div>
                      )}

                      {eligibility.eligible && workflowBlocked && (
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/25 rounded-xl space-y-2">
                          <p className="text-xs text-yellow-200/90 font-sans">
                            You have an open Hypercert workflow: a request pending review, or an approved certificate
                            waiting to be minted. Complete or resolve it before submitting another request.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Failed to retrieve eligibility data.</p>
                  )}
                </div>

                <div className="w-full md:w-auto self-stretch md:self-auto flex flex-col justify-between items-end gap-6">
                  <button
                    onClick={handleSubmitRequest}
                    disabled={!eligibility?.eligible || loading || workflowBlocked}
                    className="w-full md:w-64 py-4 rounded-full font-heading text-xl uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed
                            bg-brand-yellow text-black hover:bg-white border-2 border-brand-yellow hover:border-white shadow-[0_0_30px_rgba(250,255,0,0.15)] active:scale-95 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Request Hypercert</span>}
                  </button>
                  {submitResult && (
                    <div className="w-full max-w-xs overflow-hidden text-ellipsis whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 font-mono text-[10px] text-muted-foreground">
                      {submitResult}
                    </div>
                  )}
                </div>
            </div>
            {/* Levels vs Hypercerts Explanation */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-4 w-4 rounded-full bg-muted-foreground"></div>
                <h3 className="font-heading text-sm tracking-wider text-muted-foreground">
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
                  <h2 className="font-heading text-lg sm:text-xl tracking-wider text-foreground">
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
                          request.status === 'MINTED' ? 'bg-cyan-500/20 text-cyan-300' :
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
                      {request.status === 'APPROVED' && !request.hypercertId && request.status !== 'MINTED' && (
                        <button
                          onClick={() => handleMintApprovedRequest(request.id)}
                          className="mt-2 w-full gap-2 bg-brand-green py-2 font-heading text-sm tracking-wider text-black hover:bg-brand-green/80 rounded-md transition-all flex items-center justify-center"
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
                <h2 className="font-heading text-lg sm:text-xl tracking-wider text-foreground">
                  SUBMIT FOR REVIEW
                </h2>
              </div>
              <div className="space-y-3">
                <button
                  onClick={handleSubmitRequest}
                  disabled={!eligibility?.eligible || workflowBlocked}
                  className="w-full gap-2 bg-brand-yellow py-3 sm:py-4 font-heading text-sm sm:text-base tracking-wider text-black hover:bg-[#e6e600] disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all flex items-center justify-center"
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

          </div>

          {/* Sidebar Area - Right 4 Columns */}
          <div className="lg:col-span-4 space-y-8 animate-fade-in delay-200">

            {/* Branding Panel */}
            <div className="space-y-6 rounded-3xl border border-border bg-card p-8">
              <div className="space-y-1">
                <div className="font-heading text-2xl uppercase tracking-widest text-foreground">Metadata Config</div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Customize your certificate</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Title</label>
                  <input
                    type="text"
                    value={brandingTitle}
                    onChange={(e) => setBrandingTitle(e.target.value)}
                    placeholder="Impact of the Year"
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-yellow/50"
                  />
                </div>
                <div className="space-y-2">
                  <label className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Description</label>
                  <textarea
                    value={brandingDescription}
                    onChange={(e) => setBrandingDescription(e.target.value)}
                    placeholder="A permanent record of community action..."
                    className="h-24 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-brand-yellow/50"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-3">
                    <label className="flex justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      Logo Image
                      {brandingCids?.logoImageCid && <span className="text-brand-green">✓ Ready</span>}
                    </label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        className="cursor-pointer text-[10px] text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:font-mono file:text-[10px] file:text-foreground hover:file:bg-muted/80"
                      />
                      <button
                        onClick={() => handleBrandingUpload('logo')}
                        disabled={!logoFile}
                        className="w-full rounded-lg border border-border bg-muted/50 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-muted disabled:opacity-30"
                      >
                        Upload
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="flex justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                      Banner Image
                      {brandingCids?.bannerImageCid && <span className="text-brand-green">✓ Ready</span>}
                    </label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                        className="cursor-pointer text-[10px] text-muted-foreground file:mr-4 file:rounded-full file:border-0 file:bg-muted file:px-4 file:py-2 file:font-mono file:text-[10px] file:text-foreground hover:file:bg-muted/80"
                      />
                      <button
                        onClick={() => handleBrandingUpload('banner')}
                        disabled={!bannerFile}
                        className="w-full rounded-lg border border-border bg-muted/50 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-all hover:bg-muted disabled:opacity-30"
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Impact Summary / Preview */}
            <div className="p-8 rounded-3xl bg-brand-green text-black space-y-6">
              <div className="space-y-1">
                <div className="font-heading text-2xl uppercase tracking-widest">Cumulative Impact</div>
                <p className="text-[10px] uppercase tracking-widest font-mono opacity-60">Calculated verified contributions</p>
                {displayAddress && (
                  <Link
                    href={`/impact/${displayAddress}${
                      submissionDataAddress &&
                      submissionDataAddress.toLowerCase() !== displayAddress?.toLowerCase()
                        ? `?sa=${submissionDataAddress}`
                        : ''
                    }`}
                    className="inline-block mt-2 text-[11px] font-sans font-semibold underline underline-offset-2 hover:opacity-80"
                  >
                    Open Impact Portfolio →
                  </Link>
                )}
              </div>

              {aggregatedData ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-1">
                      <div className="font-heading text-5xl leading-none">{aggregatedData.totalCleanups}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Cleanups Finalized</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-heading text-5xl leading-none">{aggregatedData.totalReports}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Impact Reports Filed</div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-black/10 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Timeframe</div>
                    <div className="font-mono text-xs font-bold">
                      {new Date(aggregatedData.timeframeStart).toLocaleDateString()} - {new Date(aggregatedData.timeframeEnd).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-black/50 text-xs font-sans italic">Awaiting data aggregation...</p>
              )}
            </div>

            {/* Metadata Preview Small */}
            <div className="space-y-4 rounded-3xl border border-border bg-card p-6">
              <div className="flex items-center justify-between">
                <div className="font-heading text-sm uppercase tracking-widest text-muted-foreground">Metadata Raw</div>
                <div className="h-2 w-2 rounded-full bg-brand-yellow" />
              </div>
              {metadata ? (
                <div className="mt-2 rounded-xl border border-border bg-muted/50 p-3">
                  <div className="line-clamp-6 select-all overflow-hidden font-mono text-[9px] leading-tight text-muted-foreground">
                    {JSON.stringify(metadata, null, 2)}
                  </div>
                </div>
              ) : (
                <p className="text-[10px] italic text-muted-foreground">No metadata generated yet.</p>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
