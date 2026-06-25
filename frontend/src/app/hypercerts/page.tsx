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
import { compressImageIfLarge } from '@/lib/utils/compress-image-for-upload'
import {
  submitHypercertRequest,
  fetchHypercertRequestsByUser,
  hasOpenHypercertWorkflow,
  countPublishedHypercerts,
  isHypercertPublished,
  isAwaitingHypercertPublish,
  publishApprovedHypercert,
  cancelHypercertRequest,
} from '@/lib/blockchain/hypercerts/requests'
import { buildHyperscanHypercertUrl } from '@/lib/blockchain/hypercerts/atproto/urls'
import { evaluateBrandingReadiness, isBrandingTextComplete } from '@/lib/blockchain/hypercerts/branding-readiness'
import { HypercertStatusPills } from '@/components/hypercerts/HypercertStatusPills'
import { HypercertProgressTracker } from '@/components/hypercerts/HypercertProgressTracker'
import { HypercertWhyCollapsible, HypercertPoweredBy } from '@/components/hypercerts/HypercertWhyCollapsible'
import { HypercertImpactStep } from '@/components/hypercerts/HypercertImpactStep'
import { HypercertBrandingPanel } from '@/components/hypercerts/HypercertBrandingPanel'
import { HypercertRequestStep } from '@/components/hypercerts/HypercertRequestStep'
import { HypercertPublishStep } from '@/components/hypercerts/HypercertPublishStep'
import { HypercertCertificateCard } from '@/components/hypercerts/HypercertCertificateCard'
import { AlertModal, type AlertModalVariant } from '@/components/ui/alert-modal'
import type { HypercertMetadata } from '@/lib/blockchain/hypercerts/types'

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
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null)
  const [brandingTitle, setBrandingTitle] = useState('')
  const [brandingDescription, setBrandingDescription] = useState('')
  const [brandingCids, setBrandingCids] = useState<{ logoImageCid?: string; bannerImageCid?: string } | null>(
    null
  )
  const [userRequests, setUserRequests] = useState<Awaited<ReturnType<typeof fetchHypercertRequestsByUser>>>([])
  const [publishResult, setPublishResult] = useState('')
  const [cancelPending, setCancelPending] = useState(false)
  const [requestsRefreshKey, setRequestsRefreshKey] = useState(0)
  const [actionModal, setActionModal] = useState<{
    title: string
    message: string
    variant: AlertModalVariant
  } | null>(null)

  const loadUserRequests = useCallback(async () => {
    if (!eoaAddress) return
    const requests = await fetchHypercertRequestsByUser(
      eoaAddress,
      eligibilityAddress && eligibilityAddress.toLowerCase() !== eoaAddress.toLowerCase()
        ? eligibilityAddress
        : undefined
    )
    setUserRequests(requests)
  }, [eoaAddress, eligibilityAddress])

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
    void loadUserRequests()
  }, [loadUserRequests, submitResult, publishResult, requestsRefreshKey])

  const awaitingPublishCount = userRequests.filter(isAwaitingHypercertPublish).length
  useEffect(() => {
    if (!eoaAddress || awaitingPublishCount === 0) return
    const interval = setInterval(() => {
      setRequestsRefreshKey((k) => k + 1)
    }, 10_000)
    return () => clearInterval(interval)
  }, [eoaAddress, awaitingPublishCount])

  const handleCoverFileSelect = useCallback(async (file: File | null) => {
    setCoverFile(file)
    setCoverUploadError(null)
    if (!file) return
    setCoverUploading(true)
    try {
      const ready = await compressImageIfLarge(file)
      const result = await uploadToIPFS(ready, {
        pinataKeyvalueType: 'hypercert-cover',
        walletAddress: eoaAddress ?? eligibilityAddress ?? undefined,
      })
      setBrandingCids((prev) => ({ ...prev, bannerImageCid: result.hash }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cover upload failed.'
      setCoverUploadError(message)
      console.error('Cover upload failed:', error)
    } finally {
      setCoverUploading(false)
    }
  }, [eoaAddress, eligibilityAddress])

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
      setSubmitResult('')
      setActionModal({
        title: 'Hypercert submitted',
        message:
          `Your certificate is saved.\n\nRequest ID: ${request.id}\n\nGo to Step 4 to publish on Hyperscan.`,
        variant: 'success',
      })
      setRequestsRefreshKey((k) => k + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setSubmitResult('')
      setActionModal({
        title: 'Submit failed',
        message,
        variant: 'error',
      })
    }
  }

  const handlePublish = async (requestId: string) => {
    if (!eoaAddress || !canSignMessages) return

    setPublishResult('')
    setPublishResult('Publishing to Hyperscan...')
    try {
      const result = await publishApprovedHypercert({
        requestId,
        requester: eoaAddress,
        signMessageAsync: async ({ message }) => signMessageAsync(message),
      })
      setPublishResult('')
      setActionModal({
        title: 'Published on Hyperscan',
        message: `Your certificate is live.\n\n${result.atUri}`,
        variant: 'success',
      })
      setRequestsRefreshKey((k) => k + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPublishResult('')
      setActionModal({
        title: 'Publish failed',
        message,
        variant: 'error',
      })
    }
  }

  const handleCancel = async (requestId: string) => {
    if (!eoaAddress || !canSignMessages || cancelPending) return

    setCancelPending(true)
    setPublishResult('')
    try {
      await cancelHypercertRequest({
        requestId,
        requester: eoaAddress,
        signMessageAsync: async ({ message }) => signMessageAsync(message),
      })
      setPublishResult('')
      setActionModal({
        title: 'Request withdrawn',
        message: 'You can configure a new certificate and submit again.',
        variant: 'info',
      })
      setRequestsRefreshKey((k) => k + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setPublishResult('')
      setActionModal({
        title: 'Withdraw failed',
        message,
        variant: 'error',
      })
    } finally {
      setCancelPending(false)
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
  const publishingCount = userRequests.filter(isAwaitingHypercertPublish).length
  const publishedCount = countPublishedHypercerts(userRequests)
  const publishedRequests = userRequests.filter(isHypercertPublished)
  const activeRequests = userRequests.filter((r) => !isHypercertPublished(r))
  const awaitingPublishRequests = userRequests.filter(isAwaitingHypercertPublish)

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

  const brandingTextComplete = useMemo(
    () =>
      isBrandingTextComplete({
        title: brandingTitle,
        description: brandingDescription,
      }),
    [brandingTitle, brandingDescription]
  )

  const submittedBrandingReadiness = useMemo(() => {
    const open = userRequests.find((r) => !isHypercertPublished(r))
    if (!open?.metadata) return null
    const meta = open.metadata as HypercertMetadata
    return evaluateBrandingReadiness({
      title: meta.branding?.title ?? meta.name ?? '',
      description: meta.branding?.description ?? meta.description ?? '',
      logoImageCid: meta.branding?.logoImageCid,
      bannerImageCid: meta.branding?.bannerImageCid,
    })
  }, [userRequests])

  const hasCleanups = (eligibility?.cleanupsCount ?? 0) > 0
  const aggregateComplete = hasCleanups
  const configureComplete = brandingReadiness.ready || submittedBrandingReadiness?.ready === true
  const requestComplete = pendingCount > 0 || publishingCount > 0 || publishedCount > 0
  const publishedComplete = publishedCount > 0

  const stepCompleted = [aggregateComplete, configureComplete, requestComplete, publishedComplete]
  const firstIncomplete = stepCompleted.findIndex((c) => !c)
  const activeStepIndex = firstIncomplete === -1 ? 3 : firstIncomplete

  const flowSteps = [
    { number: '01', title: 'Aggregate', description: 'Verified cleanups' },
    { number: '02', title: 'Configure', description: 'Certificate details' },
    { number: '03', title: 'Submit', description: 'Save certificate' },
    { number: '04', title: 'Published', description: 'Hyperscan live' },
  ].map((step, i) => ({
    ...step,
    completed: stepCompleted[i],
    active: i === activeStepIndex,
  }))

  const displayBrandingReadiness =
    submittedBrandingReadiness?.ready && !brandingReadiness.ready
      ? submittedBrandingReadiness
      : brandingReadiness

  const canRequestHypercert =
    Boolean(eligibility?.eligible) &&
    !workflowBlocked &&
    brandingReadiness.ready &&
    canSignMessages &&
    !needsUnlock

  const isTransactionPending = submitResult === 'Submitting request...'
  const isPublishPending = publishResult === 'Publishing to Hyperscan...'
  const showRequestStep = pendingCount > 0 || awaitingPublishRequests.length === 0

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
        <DeCleanupPageHero
          programWord="HYPERCERTS"
          description="Build and publish your impact certificate on Hyperscan."
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
            coverUploadError={coverUploadError}
            readiness={displayBrandingReadiness}
            textComplete={brandingTextComplete || submittedBrandingReadiness?.ready === true}
            onTitleChange={setBrandingTitle}
            onDescriptionChange={setBrandingDescription}
            onCoverFileSelect={(file) => void handleCoverFileSelect(file)}
          />

          {showRequestStep ? (
            <HypercertRequestStep
              canRequest={canRequestHypercert}
              pending={isTransactionPending}
              submitResult={submitResult}
              onRequest={() => void handleSubmitRequest()}
            />
          ) : null}

          <HypercertPublishStep
            requests={awaitingPublishRequests}
            canSign={canSignMessages && !needsUnlock}
            pending={isPublishPending}
            publishResult={publishResult}
            onPublish={(requestId) => void handlePublish(requestId)}
            onCancel={(requestId) => void handleCancel(requestId)}
            cancelPending={cancelPending}
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
                      {isAwaitingHypercertPublish(request) ? 'Ready to publish' : request.status}
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

      {actionModal ? (
        <AlertModal
          isOpen
          onClose={() => setActionModal(null)}
          title={actionModal.title}
          message={actionModal.message}
          variant={actionModal.variant}
          closeOnBackdropClick={false}
        />
      ) : null}
    </div>
  )
}
