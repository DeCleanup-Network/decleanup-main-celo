'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { WalletConnect } from '@/features/wallet/components/WalletConnect'
import { Button } from '@/components/ui/button'
import { DeCleanupPageHero } from '@/components/layout/DeCleanupPageHero'
import { useAppWalletAddress } from '@/hooks/useAppWalletAddress'
import { useHypercertWallet } from '@/hooks/useHypercertWallet'
import { useResolvedChainId } from '@/hooks/useResolvedChainId'
import { getUserSubmissions, getCleanupDetails } from '@/lib/blockchain/contracts'
import { checkHypercertEligibility } from '@/lib/blockchain/hypercerts/eligibility'
import { aggregateUserCleanups } from '@/lib/blockchain/hypercerts/aggregation'
import { buildHypercertMetadata } from '@/lib/blockchain/hypercerts/metadata'
import { uploadToIPFS } from '@/lib/blockchain/ipfs'
import {
  submitHypercertRequest,
  fetchHypercertRequestsByUser,
  hasOpenHypercertWorkflow,
  countPublishedHypercerts,
  isHypercertPublished,
} from '@/lib/blockchain/hypercerts/requests'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'
import { evaluateBrandingReadiness } from '@/lib/blockchain/hypercerts/branding-readiness'
import { HypercertStatusPills } from '@/components/hypercerts/HypercertStatusPills'
import { HypercertProgressTracker } from '@/components/hypercerts/HypercertProgressTracker'
import { HypercertWhyCollapsible, HypercertPoweredBy } from '@/components/hypercerts/HypercertWhyCollapsible'
import { HypercertImpactStep } from '@/components/hypercerts/HypercertImpactStep'
import { HypercertBrandingPanel } from '@/components/hypercerts/HypercertBrandingPanel'
import { HypercertRequestStep } from '@/components/hypercerts/HypercertRequestStep'
import { HypercertCertificateCard } from '@/components/hypercerts/HypercertCertificateCard'

export default function HypercertsCertificationPage() {
  const { showMainApp } = useAppWalletAddress()
  const { eoaAddress, eligibilityAddress, canSignMessages, needsUnlock, signMessageAsync } =
    useHypercertWallet()
  const chainId = useResolvedChainId()

  const [loading, setLoading] = useState(false)
  const [eligibility, setEligibility] = useState<ReturnType<typeof checkHypercertEligibility> | null>(null)
  const [aggregatedData, setAggregatedData] = useState<{
    timeframeStart: number
    timeframeEnd: number
    totalReports: number
  } | null>(null)
  const [metadata, setMetadata] = useState<ReturnType<typeof buildHypercertMetadata> | null>(null)
  const [submitResult, setSubmitResult] = useState('')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const [brandingTitle, setBrandingTitle] = useState('')
  const [brandingDescription, setBrandingDescription] = useState('')
  const [brandingCids, setBrandingCids] = useState<{ logoImageCid?: string; bannerImageCid?: string } | null>(
    null
  )
  const [userRequests, setUserRequests] = useState<Awaited<ReturnType<typeof fetchHypercertRequestsByUser>>>([])

  useEffect(() => {
    if (!showMainApp) return

    async function loadData() {
      setLoading(true)
      try {
        const owner = eligibilityAddress
        if (!owner) {
          setEligibility(null)
          setAggregatedData(null)
          return
        }
        const submissions = await getUserSubmissions(owner)
        const verifiedCleanups: { cleanupId: string; verifiedAt: number }[] = []
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
        const publishedCount = countPublishedHypercerts(userRequests)

        const eligibilityResult = checkHypercertEligibility({
          cleanupsCount: verifiedCleanups.length,
          reportsCount: impactReportsCount,
          publishedCount,
          chainId: validChainId,
        })
        setEligibility(eligibilityResult)

        if (verifiedCleanups.length > 0) {
          const aggregated = aggregateUserCleanups(verifiedCleanups)
          setAggregatedData({
            timeframeStart: aggregated.timeframeStart,
            timeframeEnd: aggregated.timeframeEnd,
            totalReports: impactReportsCount,
          })

          const metadataInput = {
            userAddress: (eoaAddress ?? owner) as string,
            cleanups: verifiedCleanups,
            summary: {
              totalCleanups: aggregated.totalCleanups,
              totalReports: impactReportsCount,
              timeframeStart: aggregated.timeframeStart,
              timeframeEnd: aggregated.timeframeEnd,
            },
            issuer: eoaAddress ?? 'DeCleanup Network',
            version: 'v1',
            impactData: eoaAddress ? { contributors: [eoaAddress] } : undefined,
            branding: {
              logoImageCid: brandingCids?.logoImageCid,
              bannerImageCid: brandingCids?.bannerImageCid,
              title: brandingTitle,
              description: brandingDescription,
            },
            narrative: {
              description: 'Environmental cleanup impact certificate from DeCleanup Network.',
              locations: [],
              wasteTypes: [],
              challenges: 'Continued environmental education and cleanup initiatives',
              preventionIdeas: 'Continued environmental education and cleanup initiatives',
            },
          }
          setMetadata(buildHypercertMetadata(metadataInput))
        }
      } catch (error) {
        console.error('Error loading Hypercerts data:', error)
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [
    showMainApp,
    brandingCids,
    brandingTitle,
    brandingDescription,
    eligibilityAddress,
    eoaAddress,
    chainId,
    userRequests.length,
  ])

  useEffect(() => {
    if (!eoaAddress) return
    void (async () => {
      const requests = await fetchHypercertRequestsByUser(
        eoaAddress,
        eligibilityAddress &&
          eligibilityAddress.toLowerCase() !== eoaAddress.toLowerCase()
          ? eligibilityAddress
          : undefined
      )
      setUserRequests(requests)
    })()
  }, [eoaAddress, eligibilityAddress, submitResult])

  const handleCoverFileSelect = useCallback(async (file: File | null) => {
    setCoverFile(file)
    if (!file) return
    setCoverUploading(true)
    try {
      const result = await uploadToIPFS(file)
      setBrandingCids((prev) => ({ ...prev, bannerImageCid: result.hash }))
    } catch (error) {
      console.error('Cover upload failed:', error)
    } finally {
      setCoverUploading(false)
    }
  }, [])

  const handleSubmitRequest = async () => {
    if (!metadata || !eoaAddress || !canSignMessages) return

    setSubmitResult('')
    setSubmitResult('Submitting request...')
    try {
      const request = await submitHypercertRequest({
        requester: eoaAddress,
        metadata,
        signMessageAsync: async ({ message }) => signMessageAsync(message),
      })
      setSubmitResult(
        `Request submitted. ID ${request.id.slice(0, 8)}… Pending verifier review.`
      )
    } catch (error) {
      setSubmitResult(`Error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const homeButton = (
    <Link href="/">
      <Button variant="outline" size="sm" className="gap-2 border-border bg-card font-heading tracking-wider">
        <ArrowLeft className="h-4 w-4" />
        Home
      </Button>
    </Link>
  )

  if (!showMainApp) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-background">
        <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
          <DeCleanupPageHero
            programWord="HYPERCERTS"
            description="Connect your wallet to request a milestone impact certificate."
            align="center"
            trailing={homeButton}
          />
          <div className="mx-auto flex max-w-md flex-col items-center gap-6 rounded-2xl border border-border bg-card p-8 text-center">
            <WalletConnect />
          </div>
        </div>
      </div>
    )
  }

  const workflowBlocked = eoaAddress ? hasOpenHypercertWorkflow(userRequests) : false
  const pendingCount = userRequests.filter((r) => r.status === 'PENDING').length
  const publishingCount = userRequests.filter(
    (r) => r.status === 'APPROVED' && !isHypercertPublished(r)
  ).length
  const publishedCount = countPublishedHypercerts(userRequests)
  const publishedRequests = userRequests.filter(isHypercertPublished)
  const activeRequests = userRequests.filter((r) => !isHypercertPublished(r))

  const brandingReadiness = useMemo(
    () =>
      evaluateBrandingReadiness({
        title: brandingTitle,
        description: brandingDescription,
        logoImageCid: brandingCids?.logoImageCid,
        bannerImageCid: brandingCids?.bannerImageCid,
      }),
    [brandingTitle, brandingDescription, brandingCids]
  )

  const hasCleanups = (eligibility?.cleanupsCount ?? 0) > 0
  const aggregateComplete = hasCleanups
  const configureComplete = brandingReadiness.ready
  const requestComplete = pendingCount > 0 || publishingCount > 0 || publishedCount > 0
  const publishedComplete = publishedCount > 0

  const stepCompleted = [aggregateComplete, configureComplete, requestComplete, publishedComplete]
  const firstIncomplete = stepCompleted.findIndex((c) => !c)
  const activeStepIndex = firstIncomplete === -1 ? 3 : firstIncomplete

  const flowSteps = [
    { number: '01', title: 'Aggregate', description: 'Verified cleanups' },
    { number: '02', title: 'Configure', description: 'Certificate details' },
    { number: '03', title: 'Request', description: 'Verifier review' },
    { number: '04', title: 'Published', description: 'Hyperscan live' },
  ].map((step, i) => ({
    ...step,
    completed: stepCompleted[i],
    active: i === activeStepIndex,
  }))

  const canRequestHypercert =
    Boolean(eligibility?.eligible) &&
    !workflowBlocked &&
    brandingReadiness.ready &&
    canSignMessages &&
    !needsUnlock

  const isTransactionPending = submitResult === 'Submitting request...'

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <DeCleanupPageHero
          programWord="HYPERCERTS"
          description="Request a verifier-backed impact certificate published to Hyperscan."
          trailing={homeButton}
        />

        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          <HypercertStatusPills
            pendingCount={pendingCount}
            publishingCount={publishingCount}
            publishedCount={publishedCount}
          />

          <HypercertProgressTracker steps={flowSteps} />

          <HypercertWhyCollapsible />

          <HypercertImpactStep
            loading={loading}
            cleanupsCount={eligibility?.cleanupsCount ?? 0}
            reportsCount={eligibility?.reportsCount ?? 0}
            timeframeStart={aggregatedData?.timeframeStart}
            timeframeEnd={aggregatedData?.timeframeEnd}
            complete={aggregateComplete}
          />

          <HypercertBrandingPanel
            title={brandingTitle}
            description={brandingDescription}
            coverImageCid={brandingCids?.bannerImageCid ?? brandingCids?.logoImageCid}
            coverFile={coverFile}
            coverUploading={coverUploading}
            readiness={brandingReadiness}
            onTitleChange={setBrandingTitle}
            onDescriptionChange={setBrandingDescription}
            onCoverFileSelect={(file) => void handleCoverFileSelect(file)}
          />

          <HypercertRequestStep
            canRequest={canRequestHypercert}
            pending={isTransactionPending}
            submitResult={submitResult}
            onRequest={() => void handleSubmitRequest()}
          />

          {publishedRequests.length > 0 ? (
            <section className="space-y-4">
              <h2 className="font-heading text-xl uppercase tracking-wider text-foreground">
                Your certificates
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {publishedRequests.map((request) => (
                  <HypercertCertificateCard key={request.id} request={request} />
                ))}
              </div>
            </section>
          ) : null}

          {activeRequests.length > 0 ? (
            <section className="space-y-4 border-t border-border pt-8">
              <h2 className="font-heading text-xl uppercase tracking-wider text-foreground">
                Open requests
              </h2>
              <ul className="space-y-2">
                {activeRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm"
                  >
                    <span className="text-muted-foreground">{request.id.slice(0, 8)}…</span>
                    <span className="text-xs uppercase text-muted-foreground">
                      {request.status === 'APPROVED' && !request.atUri ? 'Publishing' : request.status}
                    </span>
                    {request.atUri ? (
                      <Link
                        href={buildHyperscanHypercertUrl(request.atUri)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-green hover:underline"
                      >
                        Hyperscan
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <HypercertPoweredBy />
        </div>
      </div>
    </div>
  )
}
