'use client'

import { useEffect, useState } from 'react'
import { useAccount, useChainId } from 'wagmi'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import { buildHypercertMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { mintHypercert } from '@/lib/blockchain/hypercerts-minting'
import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import { submitHypercertRequest, getHypercertRequestsByUser, updateRequestWithHypercertId } from '@/lib/blockchain/hypercerts/requests'

export default function HypercertsTestPage() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()

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
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [brandingTitle, setBrandingTitle] = useState<string>('')
  const [brandingDescription, setBrandingDescription] = useState<string>('')
  const [brandingCids, setBrandingCids] = useState<{ logoImageCid?: string; bannerImageCid?: string } | null>(null)
  const [userRequests, setUserRequests] = useState<any[]>([])

  useEffect(() => {
    if (!address || !isConnected) return

    async function loadData() {
      setLoading(true)
      try {
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

        const validChainId = chainId === 44787 || chainId === 42220 ? chainId : 44787
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

    loadData()
  }, [address, isConnected, brandingCids, brandingTitle, brandingDescription])

  useEffect(() => {
    if (!address) return
    const requests = getHypercertRequestsByUser(address)
    setUserRequests(requests)
    console.log('📋 User Hypercert requests:', requests)
  }, [address, submitResult])

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
    if (!address || !metadata) return

    setSubmitResult('Submitting request...')
    try {
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

      const result = await mintHypercert(address, request.metadata)

      console.log('✅ Hypercert minted:', result)

      updateRequestWithHypercertId(requestId, result.hypercertId, result.txHash, result.metadataCid)

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
    const validChainId = chainId === 44787 || chainId === 42220 ? chainId : 44787
    if (validChainId === 44787) return 'Celo Sepolia (Testnet)'
    if (validChainId === 42220) return 'Celo Mainnet'
    return `Chain ID: ${validChainId} (corrected from ${chainId})`
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-black text-white selection:bg-brand-yellow selection:text-black">
        <main className="container mx-auto flex flex-col items-center justify-center px-4 py-20">
          <div className="max-w-3xl w-full text-center space-y-8 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-mono uppercase tracking-widest text-brand-green">
              <span className="h-2 w-2 rounded-full bg-brand-green animate-pulse" />
              On-chain Certification
            </div>
            <h1 className="font-bebas text-6xl md:text-8xl tracking-tight leading-none uppercase">
              Hypercert <span className="text-brand-yellow italic">Minting</span>
            </h1>
            <p className="text-white/60 text-lg md:text-xl max-w-xl mx-auto font-sans leading-relaxed">
              Aggregate your verified environmental cleanups into premium impact certificates. Prove your contribution to the network.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <WalletConnect />
              <Link
                href="https://decleanup.net/litepaper"
                className="px-6 py-2 rounded-full border border-white/10 hover:bg-white/5 transition-all text-sm font-medium uppercase tracking-wider"
              >
                Learn More
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 text-left">
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col gap-3">
                <div className="text-brand-green font-mono text-xs">-- 01 --</div>
                <div className="font-bebas text-xl uppercase tracking-wider">Clean & Log</div>
                <p className="text-white/40 text-sm">Submit your cleanup photos and reports through the app.</p>
              </div>
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col gap-3">
                <div className="text-brand-yellow font-mono text-xs">-- 02 --</div>
                <div className="font-bebas text-xl uppercase tracking-wider">Verification</div>
                <p className="text-white/40 text-sm">Decentralized verifiers confirm your environmental impact.</p>
              </div>
              <div className="p-6 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col gap-3">
                <div className="text-brand-green font-mono text-xs">-- 03 --</div>
                <div className="font-bebas text-xl uppercase tracking-wider">Certification</div>
                <p className="text-white/40 text-sm">Mint a permanent Hypercert representing your total work.</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-brand-yellow selection:text-black pb-20">
      <main className="container mx-auto px-4 py-8 lg:py-12 space-y-12">

        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-white/10 pb-10">
          <div className="space-y-4 max-w-2xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-mono uppercase tracking-widest text-brand-green">
              Dashboard / Hypercerts
            </div>
            <h1 className="font-bebas text-5xl md:text-7xl tracking-tight leading-none uppercase">
              Creator <span className="text-brand-yellow">Dashboard</span>
            </h1>
            <p className="text-white/60 text-base md:text-lg font-sans">
              Welcome back, {address?.slice(0, 6)}...{address?.slice(-4)}. Your impact on <span className="text-white font-medium">{getNetworkName()}</span> is being recorded.
            </p>
          </div>

          <div className="flex items-center gap-6 text-right">
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-widest text-white/40 font-mono">Current Network</div>
              <div className="text-sm font-medium uppercase">{getNetworkName()}</div>
            </div>
          </div>
        </header>

        {/* Impact Progress / How it works */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
          {[
            { step: '01', title: 'Aggregate', desc: 'Verified data collected', color: 'text-brand-green', active: true },
            { step: '02', title: 'Configure', desc: 'Add optional branding', color: 'text-brand-green', active: true },
            { step: '03', title: 'Request', desc: 'Submit for review', color: 'text-brand-yellow', active: true },
            { step: '04', title: 'Mint', desc: 'On-chain certificate', color: 'text-white/40', active: false },
          ].map((s, i) => (
            <div key={i} className={`p-6 rounded-2xl border border-white/5 bg-white/[0.02] flex flex-col gap-2 relative overflow-hidden group hover:bg-white/[0.04] transition-all ${s.active ? 'border-l-2 border-l-brand-green' : ''}`}>
              <div className={`${s.color} font-mono text-[10px] tracking-widest`}>-- {s.step} --</div>
              <div className="font-bebas text-lg uppercase tracking-wider">{s.title}</div>
              <div className="text-white/40 text-[11px] leading-tight">{s.desc}</div>
              {i < 3 && <div className="hidden md:block absolute right-[-10px] top-1/2 -translate-y-1/2 text-white/5 text-4xl">→</div>}
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Main Controls - Left 8 Columns */}
          <div className="lg:col-span-8 space-y-8">

            {/* Eligibility & Action Card */}
            <div className={`p-8 rounded-3xl border transition-all ${eligibility?.eligible ? 'card-border-glow bg-white/[0.03]' : 'border-white/10 bg-white/[0.01]'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                <div className="space-y-4">
                  <div className="font-bebas text-3xl uppercase tracking-wider">Certification Status</div>
                  {loading ? (
                    <div className="flex items-center gap-3 text-white/40 animate-pulse">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Scanning blockchain for verified impact...</span>
                    </div>
                  ) : eligibility ? (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-4">
                        <div className="px-10 py-4 bg-black/50 border border-white/5 rounded-2xl text-center">
                          <div className="text-brand-green font-bebas text-5xl leading-none">{eligibility.cleanupsCount}</div>
                          <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Verified Cleanups</div>
                        </div>
                        <div className="px-10 py-4 bg-black/50 border border-white/5 rounded-2xl text-center">
                          <div className="text-brand-yellow font-bebas text-5xl leading-none">{eligibility.reportsCount}</div>
                          <div className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Impact Reports</div>
                        </div>
                      </div>

                      {!eligibility.eligible && (
                        <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-xs text-red-400/80 font-sans">{eligibility.reason}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/40 text-sm">Failed to retrieve eligibility data.</p>
                  )}
                </div>

                <div className="w-full md:w-auto self-stretch md:self-auto flex flex-col justify-between items-end gap-6">
                  <button
                    onClick={handleSubmitRequest}
                    disabled={!eligibility?.eligible || loading}
                    className="w-full md:w-64 py-4 rounded-full font-bebas text-xl uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed
                            bg-brand-yellow text-black hover:bg-white border-2 border-brand-yellow hover:border-white shadow-[0_0_30px_rgba(250,255,0,0.15)] active:scale-95 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Request Hypercert</span>}
                  </button>
                  {submitResult && (
                    <div className="w-full max-w-xs text-[10px] font-mono p-3 bg-white/5 rounded-lg border border-white/10 text-white/60 overflow-hidden text-ellipsis whitespace-pre-wrap">
                      {submitResult}
                    </div>
                  )}
                </div>
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

          </div>

          {/* Sidebar Area - Right 4 Columns */}
          <div className="lg:col-span-4 space-y-8 animate-fade-in delay-200">

            {/* Branding Panel */}
            <div className="p-8 rounded-3xl border border-white/10 bg-white/[0.02] space-y-6">
              <div className="space-y-1">
                <div className="font-bebas text-2xl uppercase tracking-widest">Metadata Config</div>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-mono">Customize your certificate</p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-white/30 font-mono">Title</label>
                  <input
                    type="text"
                    value={brandingTitle}
                    onChange={(e) => setBrandingTitle(e.target.value)}
                    placeholder="Impact of the Year"
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/5 text-sm outline-none focus:border-brand-yellow/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-widest text-white/30 font-mono">Description</label>
                  <textarea
                    value={brandingDescription}
                    onChange={(e) => setBrandingDescription(e.target.value)}
                    placeholder="A permanent record of community action..."
                    className="w-full px-4 py-3 rounded-xl bg-black border border-white/5 text-sm outline-none focus:border-brand-yellow/50 transition-colors resize-none h-24"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-3">
                    <label className="text-[11px] uppercase tracking-widest text-white/30 font-mono flex justify-between">
                      Logo Image
                      {brandingCids?.logoImageCid && <span className="text-brand-green">✓ Ready</span>}
                    </label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        className="text-[10px] text-white/30 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-mono file:bg-white/5 file:text-white/60 hover:file:bg-white/10 cursor-pointer"
                      />
                      <button
                        onClick={() => handleBrandingUpload('logo')}
                        disabled={!logoFile}
                        className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 disabled:opacity-30 transition-all font-mono"
                      >
                        Upload
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[11px] uppercase tracking-widest text-white/30 font-mono flex justify-between">
                      Banner Image
                      {brandingCids?.bannerImageCid && <span className="text-brand-green">✓ Ready</span>}
                    </label>
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBannerFile(e.target.files?.[0] || null)}
                        className="text-[10px] text-white/30 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-mono file:bg-white/5 file:text-white/60 hover:file:bg-white/10 cursor-pointer"
                      />
                      <button
                        onClick={() => handleBrandingUpload('banner')}
                        disabled={!bannerFile}
                        className="w-full py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] uppercase tracking-widest font-bold hover:bg-white/10 disabled:opacity-30 transition-all font-mono"
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
                <div className="font-bebas text-2xl uppercase tracking-widest">Cumulative Impact</div>
                <p className="text-[10px] uppercase tracking-widest font-mono opacity-60">Calculated verified contributions</p>
              </div>

              {aggregatedData ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-1">
                      <div className="font-bebas text-5xl leading-none">{aggregatedData.totalCleanups}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Cleanups Finalized</div>
                    </div>
                    <div className="space-y-1">
                      <div className="font-bebas text-5xl leading-none">{aggregatedData.totalReports}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Impact Reports Filed</div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-black/10 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest font-bold opacity-40">Timeframe</div>
                    <div className="font-mono text-xs font-bold">
                      {new Date(aggregatedData.timeframeStart).toLocaleDateString()} — {new Date(aggregatedData.timeframeEnd).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-black/50 text-xs font-sans italic">Awaiting data aggregation...</p>
              )}
            </div>

            {/* Metadata Preview Small */}
            <div className="p-6 rounded-3xl border border-white/5 bg-white/[0.01] space-y-4">
              <div className="flex justify-between items-center">
                <div className="font-bebas text-sm uppercase tracking-widest text-white/60">Metadata Raw</div>
                <div className="h-2 w-2 rounded-full bg-brand-yellow"></div>
              </div>
              {metadata ? (
                <div className="bg-black/40 p-3 rounded-xl border border-white/5 mt-2">
                  <div className="font-mono text-[9px] text-white/30 overflow-hidden line-clamp-6 leading-tight select-all">
                    {JSON.stringify(metadata, null, 2)}
                  </div>
                </div>
              ) : (
                <p className="text-white/20 text-[10px] italic">No metadata generated yet.</p>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
