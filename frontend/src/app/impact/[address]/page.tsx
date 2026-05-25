'use client'

import { Suspense, useEffect, useState, useCallback, useMemo, useLayoutEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAccount, useSignMessage } from 'wagmi'
import { isAddress, getAddress } from 'viem'
import type { Address } from 'viem'
import {
  Loader2,
  Share2,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  MapPin,
  Trash2,
  Scale,
  Ruler,
  FileText,
  Recycle,
  Users,
  Clock3,
  Award,
  ExternalLink,
  Stamp,
  Shield,
  BadgeCheck,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import dynamic from 'next/dynamic'
import { resolveEnsToAddress, resolveAddressToEnsName } from '@/lib/utils/ens'
import {
  fetchPublicPortfolioData,
  hashToProxyDisplayUrl,
  canShowPhoto,
  hashToGatewayUrl,
  type ImpactReportJson,
  type PublicPortfolioPayload,
} from '@/lib/impact/public-portfolio-data'
import { Button } from '@/components/ui/button'
import { DeCleanupPageHero } from '@/components/layout/DeCleanupPageHero'
import { CopyableAddress } from '@/components/ui/copyable-address'
import {
  CONTRACT_ADDRESSES,
  MAX_IMPACT_PRODUCT_LEVEL,
  REQUIRED_BLOCK_EXPLORER_URL,
} from '@/lib/blockchain/chain-constants'
import { isVerifier } from '@/lib/blockchain/contracts'
import { useSmartAccountClient } from '@/hooks/useSmartAccountClient'
import {
  PROFILE_LIMITS,
  buildProfileSignMessage,
  emptyImpactProfile,
  sanitizeProfileFromUserInput,
  type EditableProfile,
} from '@/lib/impact/portfolio-profile'

const VERIFICATION_PIPELINE_DOC_URL =
  'https://github.com/DeCleanup-Network/decleanup-main-celo/blob/main/docs/ML_VERIFICATION_ARCHITECTURE.md'
const SYSTEM_ARCHITECTURE_DOC_URL =
  'https://github.com/DeCleanup-Network/decleanup-main-celo/blob/main/docs/system-architecture.md'

const ImpactPortfolioTrendChart = dynamic(
  () =>
    import('@/components/impact/ImpactPortfolioTrendChart').then((m) => ({
      default: m.ImpactPortfolioTrendChart,
    })),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-md bg-muted/40" aria-hidden />,
  }
)

function formatNum(n: number, d = 0) {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d })
}

function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (!value) return ''
  if (value.length <= head + tail + 3) return value
  return `${value.slice(0, head)}...${value.slice(-tail)}`
}

function parseImpactMetrics(impact: ImpactReportJson | null): {
  areaSqm: number
  weightKg: number
} {
  if (!impact) return { areaSqm: 0, weightKg: 0 }
  const areaRaw = parseFloat(impact.area || '0') || 0
  const weightRaw = parseFloat(impact.weight || '0') || 0
  const areaSqm = (impact.areaUnit || 'sqm') === 'sqft' ? areaRaw / 10.764 : areaRaw
  const weightKg = (impact.weightUnit || 'kg') === 'lbs' ? weightRaw / 2.20462 : weightRaw
  return { areaSqm, weightKg }
}

function extractAdditionalReportLinks(impact: ImpactReportJson | null): Array<{ title: string; url: string }> {
  if (!impact) return []
  const out: Array<{ title: string; url: string }> = []
  const seen = new Set<string>()
  const add = (url: string, title: string) => {
    const clean = url.trim()
    if (!/^https?:\/\//i.test(clean)) return
    if (seen.has(clean)) return
    seen.add(clean)
    out.push({ title: title.trim() || 'Reference link', url: clean })
  }
  const anyImpact = impact as Record<string, unknown>

  const maybeArrays = ['additionalLinks', 'reportLinks', 'sources', 'references', 'evidenceLinks']
  for (const key of maybeArrays) {
    const val = anyImpact[key]
    if (Array.isArray(val)) {
      for (const item of val) {
        if (typeof item === 'string') add(item, key)
        if (item && typeof item === 'object') {
          const obj = item as Record<string, unknown>
          const url = typeof obj.url === 'string' ? obj.url : typeof obj.href === 'string' ? obj.href : ''
          const title = typeof obj.title === 'string' ? obj.title : typeof obj.label === 'string' ? obj.label : key
          if (url) add(url, title)
        }
      }
    }
  }

  const textSources = [anyImpact.additionalNotes, anyImpact.scopeOfWork, anyImpact.environmentalChallenges]
    .filter((v): v is string => typeof v === 'string')
    .join(' ')
  const regex = /https?:\/\/[^\s)]+/gi
  for (const m of textSources.match(regex) || []) {
    add(m, 'Reference')
  }
  return out
}

function pickReportDownloadUrl(
  links: Array<{ title: string; url: string }>,
  cid: string
): string | null {
  const pdf = links.find((l) => /\.pdf(?:$|[?#])/i.test(l.url))
  if (pdf) return pdf.url
  if (cid) return hashToGatewayUrl(cid)
  return null
}

function PublicPortfolioContent() {
  const { address: connectedAddress } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { submissionOwnerAddress } = useSmartAccountClient()
  const params = useParams()
  const searchParams = useSearchParams()
  const raw = typeof params?.address === 'string' ? params.address : ''

  const saParam = searchParams.get('sa') || searchParams.get('submissionOwner')
  const submissionOwnerOverride = useMemo(() => {
    if (!saParam?.trim()) return undefined
    const t = saParam.trim()
    return isAddress(t) ? (t as Address) : undefined
  }, [saParam])

  const [resolved, setResolved] = useState<Address | null>(null)
  const [ensName, setEnsName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<PublicPortfolioPayload | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [trendRange, setTrendRange] = useState<30 | 90 | 365>(90)
  const [profile, setProfile] = useState<EditableProfile | null>(null)
  const [draftProfile, setDraftProfile] = useState<EditableProfile | null>(null)
  const [showEditor, setShowEditor] = useState(false)
  const [showImpactReports, setShowImpactReports] = useState(false)
  const impactReportsSectionRef = useRef<HTMLElement | null>(null)
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null)
  const [saveProfileLoading, setSaveProfileLoading] = useState(false)
  const [isPortfolioVerifier, setIsPortfolioVerifier] = useState(false)

  const effectiveSubmissionOwner = useMemo(() => {
    if (submissionOwnerOverride) return submissionOwnerOverride
    if (!resolved || !connectedAddress || !submissionOwnerAddress) return undefined
    if (connectedAddress.toLowerCase() !== resolved.toLowerCase()) return undefined
    if (submissionOwnerAddress.toLowerCase() === resolved.toLowerCase()) return undefined
    return submissionOwnerAddress as Address
  }, [submissionOwnerOverride, resolved, connectedAddress, submissionOwnerAddress])

  /** Reverse-ENS for the on-chain identity shown on this page (explicit ?sa=, linked Safe, else path address). */
  const ensLookupAddress = useMemo((): Address | null => {
    if (!resolved) return null
    try {
      if (submissionOwnerOverride) return getAddress(submissionOwnerOverride)
      if (
        effectiveSubmissionOwner &&
        effectiveSubmissionOwner.toLowerCase() !== resolved.toLowerCase()
      ) {
        return getAddress(effectiveSubmissionOwner)
      }
      return getAddress(resolved)
    } catch {
      return null
    }
  }, [resolved, submissionOwnerOverride, effectiveSubmissionOwner])

  const resolveParam = useCallback(async () => {
    const trimmed = decodeURIComponent(raw).trim()
    if (!trimmed) {
      setResolved(null)
      setError('Missing address')
      return
    }
    if (isAddress(trimmed)) {
      setResolved(trimmed as Address)
      setError(null)
      return
    }
    const addr = await resolveEnsToAddress(trimmed)
    if (addr && isAddress(addr)) {
      setResolved(addr as Address)
      setError(null)
    } else {
      setResolved(null)
      setError('Could not resolve ENS or invalid address')
    }
  }, [raw])

  useEffect(() => {
    void resolveParam()
  }, [resolveParam])

  useEffect(() => {
    if (!ensLookupAddress) {
      setEnsName(null)
      return
    }
    let cancelled = false
    void resolveAddressToEnsName(ensLookupAddress).then((n) => {
      if (!cancelled) setEnsName(n)
    })
    return () => {
      cancelled = true
    }
  }, [ensLookupAddress])

  useEffect(() => {
    if (!resolved) {
      if (!error) setLoading(true)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const payload = await fetchPublicPortfolioData(resolved, {
          submissionOwner: effectiveSubmissionOwner,
        })
        if (!cancelled) setData(payload)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load portfolio')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resolved, effectiveSubmissionOwner])

  useLayoutEffect(() => {
    if (!showImpactReports) return
    impactReportsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [showImpactReports])

  const shareUrl =
    typeof window !== 'undefined' && resolved
      ? `${window.location.origin}/impact/${resolved}${effectiveSubmissionOwner ? `?sa=${effectiveSubmissionOwner}` : ''}`
      : ''

  const copyShare = async () => {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      // ignore
    }
  }

  const shareOnX = () => {
    if (!shareUrl) return
    const text = encodeURIComponent('View my DeCleanup Impact Portfolio')
    const url = encodeURIComponent(shareUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener,noreferrer')
  }

  const shareOnFarcaster = () => {
    if (!shareUrl) return
    const text = encodeURIComponent(`View my DeCleanup Impact Portfolio\n\n${shareUrl}`)
    window.open(`https://warpcast.com/~/compose?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  const reward = data?.rewards
  const totalRewards = reward?.totalDcuBreakdown || 0

  const displayTitle = useMemo(() => {
    const fromProfile = profile?.displayName?.trim()
    if (fromProfile) return fromProfile
    if (ensName?.trim()) return ensName.trim()
    if (resolved) return `${resolved.slice(0, 6)}…${resolved.slice(-4)}`
    return 'Impact portfolio'
  }, [profile?.displayName, ensName, resolved])

  const hasMaxImpactLevel =
    data != null && Number(data.level ?? 0) >= MAX_IMPACT_PRODUCT_LEVEL

  useEffect(() => {
    if (!resolved) return
    const empty = emptyImpactProfile()
    let cancelled = false
    void (async () => {
      let localMerged = empty
      if (typeof window !== 'undefined') {
        const key = `impact_profile:${resolved.toLowerCase()}`
        try {
          const rawStored = window.localStorage.getItem(key)
          const stored = rawStored ? (JSON.parse(rawStored) as Partial<EditableProfile>) : {}
          localMerged = sanitizeProfileFromUserInput({ ...empty, ...stored })
        } catch {
          localMerged = empty
        }
      }

      try {
        const res = await fetch(`/api/impact/profile?address=${encodeURIComponent(resolved)}`, {
          cache: 'no-store',
        })
        const payload = await res.json().catch(() => ({}))
        if (!cancelled && res.ok && payload?.success && payload?.profile) {
          const merged = sanitizeProfileFromUserInput(payload.profile as Partial<EditableProfile>)
          setProfile(merged)
          setDraftProfile(merged)
          return
        }
      } catch {
        // fall through to local fallback
      }

      if (!cancelled) {
        setProfile(localMerged)
        setDraftProfile(localMerged)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resolved])

  /** Verifier role may be on the path address or a linked submission owner / ?sa= override. */
  const addressesForVerifierCheck = useMemo((): Address[] => {
    const out: Address[] = []
    const tryPush = (a: string | undefined) => {
      if (!a || !isAddress(a)) return
      try {
        const c = getAddress(a)
        if (!out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c)
      } catch {
        // skip invalid
      }
    }
    tryPush(resolved ?? undefined)
    tryPush(effectiveSubmissionOwner ?? undefined)
    tryPush(submissionOwnerOverride ?? undefined)
    return out
  }, [resolved, effectiveSubmissionOwner, submissionOwnerOverride])

  useEffect(() => {
    if (addressesForVerifierCheck.length === 0) {
      setIsPortfolioVerifier(false)
      return
    }
    let cancelled = false
    void Promise.all(addressesForVerifierCheck.map((a) => isVerifier(a))).then((flags) => {
      if (!cancelled) setIsPortfolioVerifier(flags.some(Boolean))
    })
    return () => {
      cancelled = true
    }
  }, [addressesForVerifierCheck])

  const copyAny = async (key: string, value: string) => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopiedKey(key)
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      // ignore
    }
  }

  const trendData = useMemo(() => {
    if (!data) return []
    const now = Date.now()
    const daysMs = trendRange * 24 * 60 * 60 * 1000
    const dayMap = new Map<string, { cleanups: number; weight: number }>()
    for (const item of data.enriched) {
      if (!item.details.verified || item.details.rejected) continue
      const ts = Number(item.details.timestamp) * 1000
      if (!Number.isFinite(ts) || now - ts > daysMs) continue
      const day = new Date(ts).toISOString().slice(0, 10)
      const prev = dayMap.get(day) || { cleanups: 0, weight: 0 }
      const parsed = parseImpactMetrics(item.impact)
      dayMap.set(day, {
        cleanups: prev.cleanups + 1,
        weight: prev.weight + parsed.weightKg,
      })
    }
    const sortedDays = Array.from(dayMap.keys()).sort()
    return sortedDays.map((day) => {
      const v = dayMap.get(day)!
      return {
        day: day.slice(5),
        cleanups: v.cleanups,
        weight: Number(v.weight.toFixed(2)),
      }
    })
  }, [data, trendRange])

  const hasTrend = trendData.length > 0
  const placeholderTrend = useMemo(
    () =>
      Array.from({ length: 6 }).map((_, i) => ({
        day: `W${i + 1}`,
        cleanups: i % 2 === 0 ? 1 : 0,
        weight: i % 3 === 0 ? 0.7 : 0.2,
      })),
    []
  )
  const chartData = hasTrend ? trendData : placeholderTrend
  const co2eEstimate = data ? data.cumulative.weightKg * 1.7 : 0

  const socialLinks = [
    { label: 'Farcaster', href: profile?.farcaster || '' },
    { label: 'Twitter/X', href: profile?.twitter || '' },
    { label: 'DeCleanup dApp', href: profile?.dapp || '' },
  ].filter((s) => s.href.trim().length > 0)

  const rewardSegments = reward
    ? [
        { label: 'Cleanups', value: reward.cleanupsDCU, color: 'bg-brand-green' },
        { label: 'Referrals', value: reward.referralsDCU, color: 'bg-emerald-500' },
        { label: 'Streak', value: reward.streakDCU, color: 'bg-lime-400' },
        { label: 'Reports', value: reward.reportsDCU, color: 'bg-brand-yellow' },
        { label: 'Recyclables', value: reward.recyclablesDCU, color: 'bg-cyan-400' },
        { label: 'Hypercerts', value: reward.hypercertsDCU, color: 'bg-violet-400' },
        { label: 'Verifier', value: reward.verifierDCU, color: 'bg-orange-400' },
      ]
    : []
  const canEditProfile = useMemo(() => {
    if (!connectedAddress || !resolved) return false
    const connected = connectedAddress.toLowerCase()
    const owners = [resolved.toLowerCase(), effectiveSubmissionOwner?.toLowerCase()].filter(Boolean) as string[]
    return owners.includes(connected)
  }, [connectedAddress, resolved, effectiveSubmissionOwner])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:space-y-8 sm:py-10">
        <DeCleanupPageHero
          programWord="IMPACT PORTFOLIO"
          pageTagline="Verified disclosure"
          description="Verified cleanups, rewards, and profile for this wallet on Celo."
          trailing={
            <Button asChild variant="outline" size="sm" className="border-border bg-card">
              <Link href="/">Home</Link>
            </Button>
          }
        />

        {/* 1) Header */}
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-8">
          <div className="flex flex-col justify-between gap-5 lg:flex-row">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-green/40 bg-brand-green/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-green">
                <Stamp className="h-3.5 w-3.5" />
                Verified Impact · ESG Disclosure
              </div>
              <h2 className="font-bebas text-4xl leading-none tracking-wider sm:text-6xl">{displayTitle}</h2>
              {(isPortfolioVerifier || hasMaxImpactLevel) && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {isPortfolioVerifier && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/45 bg-gradient-to-r from-cyan-500/20 to-sky-600/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100 shadow-[0_0_20px_-4px_rgba(34,211,238,0.45)]">
                      <Shield className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                      Verifier
                    </span>
                  )}
                  {hasMaxImpactLevel && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-500/25 to-orange-600/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100 shadow-[0_0_18px_-4px_rgba(251,191,36,0.4)]">
                      <Award className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                      Impact max · Lv {MAX_IMPACT_PRODUCT_LEVEL}
                    </span>
                  )}
                </div>
              )}
              {resolved && (
                <div className="max-w-xl">
                  <CopyableAddress address={resolved} truncate className="font-mono text-xs text-muted-foreground sm:text-sm" />
                </div>
              )}
              {profile?.bio?.trim() ? (
                <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{profile.bio.trim()}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-brand-green/50 hover:text-foreground"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              {shareUrl && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-brand-green/40 bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
                    onClick={() => void copyShare()}
                  >
                    <Share2 className="mr-2 h-4 w-4 shrink-0" />
                    {linkCopied ? 'Copied!' : 'Copy link'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-card font-bebas tracking-wider text-foreground hover:bg-muted"
                    onClick={shareOnX}
                  >
                    Share on X
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="border-border bg-card font-bebas tracking-wider text-foreground hover:bg-muted"
                    onClick={shareOnFarcaster}
                  >
                    Share on Farcaster
                  </Button>
                </>
              )}
              {canEditProfile && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-border bg-card"
                  onClick={() => setShowEditor((v) => !v)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {showEditor ? 'Close editor' : 'Edit profile'}
                </Button>
              )}
            </div>
          </div>
        </section>

        {canEditProfile && showEditor && draftProfile && (
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bebas text-xl tracking-wider">Edit Portfolio Profile</h2>
              <span className="text-xs text-muted-foreground">Saved locally for this profile address</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  ['displayName', 'Display name / ENS label'],
                  ['bio', 'Bio'],
                  ['locationLabel', 'Location label'],
                  ['locationCoords', 'Precise coordinates'],
                  ['creatorName', 'Creator name'],
                  ['creatorRole', 'Creator role'],
                  ['projects', 'Active projects'],
                  ['openTo', 'Open to'],
                  ['farcaster', 'Farcaster link'],
                  ['twitter', 'Twitter/X link'],
                  ['dapp', 'dApp link'],
                ] as const
              ).map(([key, label]) => (
                <label
                  key={key}
                  className={`text-xs ${key === 'bio' || key === 'projects' || key === 'openTo' ? 'md:col-span-2' : ''}`}
                >
                  <span className="mb-1 block text-muted-foreground">{label}</span>
                  {(key === 'bio' || key === 'projects' || key === 'openTo') ? (
                    <textarea
                      className="min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                      value={draftProfile[key]}
                      maxLength={PROFILE_LIMITS[key]}
                      onChange={(e) => setDraftProfile((p) => (p ? { ...p, [key]: e.target.value } : p))}
                    />
                  ) : (
                    <input
                      className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                      value={draftProfile[key]}
                      maxLength={PROFILE_LIMITS[key]}
                      onChange={(e) => setDraftProfile((p) => (p ? { ...p, [key]: e.target.value } : p))}
                    />
                  )}
                  <span className="mt-1 block text-[10px] text-muted-foreground">
                    {draftProfile[key].length}/{PROFILE_LIMITS[key]}
                  </span>
                </label>
              ))}
            </div>
            <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={draftProfile.showPreciseLocation}
                onChange={(e) =>
                  setDraftProfile((p) => (p ? { ...p, showPreciseLocation: e.target.checked } : p))
                }
              />
              Show precise location coordinates publicly
            </label>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                onClick={async () => {
                  if (!resolved || !draftProfile) return
                  setSaveProfileError(null)
                  setSaveProfileLoading(true)
                  const sanitized = sanitizeProfileFromUserInput(draftProfile)
                  const key = `impact_profile:${resolved.toLowerCase()}`
                  try {
                    if (typeof window !== 'undefined') {
                      window.localStorage.setItem(key, JSON.stringify(sanitized))
                    }

                    const connected = connectedAddress?.toLowerCase()
                    const allowedSigners = [resolved.toLowerCase(), effectiveSubmissionOwner?.toLowerCase()].filter(Boolean) as string[]
                    if (!connected || !allowedSigners.includes(connected)) {
                      setProfile(sanitized)
                      setDraftProfile(sanitized)
                      setShowEditor(false)
                      return
                    }

                    if (!signMessageAsync) {
                      throw new Error('Wallet signature is unavailable. Changes were saved only in this browser.')
                    }

                    const timestamp = Date.now()
                    const message = buildProfileSignMessage({
                      address: resolved,
                      profile: sanitized,
                      timestamp,
                    })
                    const signature = await signMessageAsync({ message })

                    const res = await fetch('/api/impact/profile', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        address: resolved,
                        signerAddress: connectedAddress,
                        profile: sanitized,
                        timestamp,
                        signature,
                      }),
                    })
                    const payload = await res.json().catch(() => ({}))
                    if (!res.ok || !payload?.success) {
                      throw new Error(payload?.error || 'Failed to save profile to database')
                    }

                    setProfile(sanitized)
                    setDraftProfile(sanitized)
                    setShowEditor(false)
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : 'Failed to save profile'
                    setSaveProfileError(msg)
                    // keep local fallback visible even when db save fails
                    setProfile(sanitized)
                    setDraftProfile(sanitized)
                  } finally {
                    setSaveProfileLoading(false)
                  }
                }}
                className="bg-brand-green text-black hover:bg-brand-green/90"
                disabled={saveProfileLoading}
              >
                {saveProfileLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraftProfile(profile)
                  setShowEditor(false)
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
            {saveProfileError && <p className="mt-2 text-xs text-red-400">{saveProfileError}</p>}
          </section>
        )}

        {error && !resolved && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <Loader2 className="h-12 w-12 animate-spin text-brand-green" />
            <p className="text-sm text-muted-foreground">Loading impact portfolio</p>
          </div>
        )}

        {!loading && data && reward && (
          <>
            {/* 2) Impact summary */}
            <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: 'DCU Recognized', value: reward.totalDcuBreakdown, icon: ShieldCheck },
                { label: 'Verified Cleanups', value: data.verifiedCleanups, icon: Trash2 },
                { label: 'Impact Reports', value: data.verifiedWithReport, icon: FileText },
                { label: 'Cumulative Weight', value: `${formatNum(data.cumulative.weightKg, 1)} kg`, icon: Scale },
                { label: 'Cumulative Area', value: `${formatNum(data.cumulative.areaSqm, 1)} m²`, icon: Ruler },
              ].map((k) => (
                <div key={k.label} className="rounded-xl border border-border bg-card p-4">
                  <k.icon className="mb-2 h-4 w-4 text-brand-green" aria-hidden />
                  <p className="font-bebas text-2xl leading-none">{typeof k.value === 'number' ? formatNum(k.value, 0) : k.value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
                </div>
              ))}
            </section>

            {/* 3) Framework alignment */}
            <section className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="mb-3 font-bebas text-xl tracking-wider">Framework Alignment</h2>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { code: 'SDG 11', title: 'Sustainable Cities', color: '#FD9D24' },
                    { code: 'SDG 14', title: 'Life Below Water', color: '#0A97D9' },
                    { code: 'SDG 15', title: 'Life on Land', color: '#56C02B' },
                  ].map((sdg) => (
                    <div
                      key={sdg.code}
                      className="flex items-center gap-2 rounded-md border border-border/60 px-2 py-2"
                      aria-label={`${sdg.code} ${sdg.title}`}
                    >
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-black" style={{ backgroundColor: sdg.color }}>
                        {sdg.code.split(' ')[1]}
                      </span>
                      <span className="text-xs text-foreground">{sdg.code}: {sdg.title}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-bebas text-lg tracking-wider">GHG Equivalency</h3>
                <p className="mt-2 text-2xl font-bebas text-brand-green">
                  ≈ {formatNum(co2eEstimate, 1)} kg CO₂e avoided
                </p>
                <p
                  className="mt-2 text-xs text-muted-foreground"
                  title="Estimate based on plastic displacement proxy and IPCC-style linear factor (1.7 kg CO₂e per 1 kg collected material)."
                  aria-label="GHG methodology info"
                >
                  Methodology: IPCC displacement factor proxy for recovered plastic mass.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-bebas text-lg tracking-wider">Location</h3>
                <p className="mt-2 text-sm text-foreground">{profile?.locationLabel || '—'}</p>
                {profile?.showPreciseLocation ? (
                  <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline h-3.5 w-3.5" />
                    {profile.locationCoords || '—'}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                    <MapPin className="mr-1 inline h-3.5 w-3.5" />
                    Precise coordinates hidden by profile owner
                  </div>
                )}
              </div>
            </section>

            {/* 4) Rewards segmented bar */}
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bebas text-xl tracking-wider">Rewards Breakdown</h2>
                <span className="font-mono text-xs text-muted-foreground">Total {formatNum(totalRewards, 0)} DCU</span>
              </div>
              <div className="mt-4 flex h-5 overflow-hidden rounded-full border border-border bg-muted">
                {rewardSegments.map((seg) => {
                  const pct = totalRewards > 0 ? (seg.value / totalRewards) * 100 : 0
                  return (
                    <div
                      key={seg.label}
                      className={`${seg.color} h-full`}
                      style={{ width: `${pct}%` }}
                      aria-label={`${seg.label} ${formatNum(seg.value, 0)} DCU`}
                    />
                  )
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                {rewardSegments.map((seg) => (
                  <div key={seg.label} className="rounded-md border border-border/60 px-2 py-1.5 text-xs">
                    <p className="text-muted-foreground">{seg.label}</p>
                    <p className="font-bebas text-lg leading-none">{formatNum(seg.value, 0)}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Hypercerts */}
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bebas text-xl tracking-wider">Hypercerts</h2>
                <a href="/hypercerts" className="text-xs text-brand-green underline">
                  Open Hypercerts
                </a>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hypercert DCU</p>
                  <p className="font-bebas text-2xl leading-none">{formatNum(reward.hypercertsDCU, 0)}</p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Estimated Count</p>
                  <p className="font-bebas text-2xl leading-none">{formatNum(reward.hypercertsDCU / 10, 0)}</p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Timeframe Start</p>
                  <p className="text-xs text-foreground">
                    {data.aggregated ? new Date(data.aggregated.timeframeStart).toLocaleDateString() : '—'}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Timeframe End</p>
                  <p className="text-xs text-foreground">
                    {data.aggregated ? new Date(data.aggregated.timeframeEnd).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </section>

            {/* 5) Environmental impact + trend */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-bebas text-xl tracking-wider">Environmental Impact</h2>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { label: 'Area', value: `${formatNum(data.cumulative.areaSqm, 1)} m²`, icon: Ruler },
                  { label: 'Weight', value: `${formatNum(data.cumulative.weightKg, 1)} kg`, icon: Scale },
                  { label: 'Bags', value: formatNum(data.cumulative.bagsTotal, 0), icon: Recycle },
                  { label: 'Time', value: `${Math.round(data.cumulative.minutesTotal / 60)} h`, icon: Clock3 },
                ].map((m) => (
                  <div key={m.label} className="rounded-md border border-border/60 p-3">
                    <m.icon className="mb-1 h-4 w-4 text-brand-green" aria-hidden />
                    <p className="font-bebas text-xl leading-none">{m.value}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Trend View</p>
                  <div className="inline-flex rounded-md border border-border">
                    {[30, 90, 365].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setTrendRange(d as 30 | 90 | 365)}
                        className={`px-2.5 py-1 text-xs ${trendRange === d ? 'bg-brand-green/15 text-brand-green' : 'text-muted-foreground'}`}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <div className="h-56 w-full">
                    <ImpactPortfolioTrendChart data={chartData} />
                  </div>
                  {!hasTrend && (
                    <p className="mt-2 text-xs text-muted-foreground">Data populates as cleanups are verified.</p>
                  )}
                </div>
              </div>
            </section>

            {/* 6) Methodology */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-bebas text-xl tracking-wider">Methodology · Verification Pipeline</h2>
              <div className="mt-4 grid gap-2 md:grid-cols-4">
                {[
                  { step: 'Photo upload', desc: 'Before/after evidence submitted by cleanup leader.' },
                  { step: 'AI pre-screening', desc: 'Image quality and mismatch checks before human review.' },
                  { step: 'Onchain attestation', desc: 'Verifier confirms cleanup status in smart contract.' },
                  { step: 'IPFS anchor', desc: 'Impact report metadata and evidence hashes stored on IPFS.' },
                ].map((s, i) => (
                  <div key={s.step} className="rounded-md border border-border/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-brand-green">Step {i + 1}</p>
                    <p className="mt-1 font-semibold text-foreground">{s.step}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Weight and area are self-reported by the cleanup leader and cross-referenced against photo evidence by AI screening.
                {' '}
                <a
                  href={VERIFICATION_PIPELINE_DOC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-green underline"
                >
                  Verification pipeline (GitHub)
                </a>
                {' · '}
                <a
                  href={SYSTEM_ARCHITECTURE_DOC_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-green underline"
                >
                  System overview
                </a>
              </p>
            </section>

            {/* 7) Impact reports (collapsed by default) */}
            <section
              ref={impactReportsSectionRef}
              className="space-y-4 scroll-mt-[5.5rem] sm:scroll-mt-[6.5rem]"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div>
                  <h2 className="font-bebas text-2xl tracking-wider">Impact Reports</h2>
                  <p className="text-xs text-muted-foreground">{data.enriched.length} records</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowImpactReports((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted/40"
                  aria-expanded={showImpactReports}
                  aria-controls="impact-reports-content"
                >
                  {showImpactReports ? (
                    <>
                      Hide reports
                      <ChevronDown className="h-3.5 w-3.5" />
                    </>
                  ) : (
                    <>
                      Show reports
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
              {showImpactReports && (
                <div id="impact-reports-content" className="space-y-4">
                  {data.enriched.map((e) => {
                    const d = e.details
                    const beforeU = d.beforePhotoHash ? hashToProxyDisplayUrl(d.beforePhotoHash) : ''
                    const afterU = d.afterPhotoHash ? hashToProxyDisplayUrl(d.afterPhotoHash) : ''
                    const showBefore = beforeU && canShowPhoto(e.impact, 'before')
                    const showAfter = afterU && canShowPhoto(e.impact, 'after')
                    const badgeLabel = d.hasImpactForm ? 'Verified · Report' : 'Verified'
                    const cid = d.impactFormDataHash || ''
                    const additionalLinks = extractAdditionalReportLinks(e.impact)
                    const reportDownloadUrl = pickReportDownloadUrl(additionalLinks, cid)
                    return (
                      <article key={e.submissionId} className="overflow-hidden rounded-xl border border-border bg-card">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
                          <p className="font-bebas text-xl">Cleanup #{e.submissionId}</p>
                          <span
                            className="inline-flex items-center gap-1 rounded-full border border-brand-green/40 bg-brand-green/10 px-2.5 py-0.5 text-[11px] text-brand-green"
                            aria-label={badgeLabel}
                          >
                            {d.hasImpactForm ? <FileText className="h-3.5 w-3.5" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                            {badgeLabel}
                          </span>
                        </div>
                        <div className="grid gap-0 md:grid-cols-2">
                          <div className="aspect-[4/3] border-b border-border bg-black/40 md:border-b-0 md:border-r">
                            {showBefore ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={beforeU} alt="Before cleanup evidence" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Before photo hidden</div>
                            )}
                          </div>
                          <div className="aspect-[4/3] bg-black/40">
                            {showAfter ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={afterU} alt="After cleanup evidence" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">After photo hidden</div>
                            )}
                          </div>
                        </div>
                        <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
                          <div className="rounded-md border border-border/60 p-3 text-xs">
                            <p className="text-muted-foreground">Scope</p>
                            <p className="mt-1">{e.impact?.scopeOfWork || '—'}</p>
                          </div>
                          <div className="rounded-md border border-border/60 p-3 text-xs">
                            <p className="text-muted-foreground">Waste Type</p>
                            <p className="mt-1">{e.impact?.wasteTypes?.join(', ') || '—'}</p>
                          </div>
                          <div className="rounded-md border border-border/60 p-3 text-xs">
                            <p className="text-muted-foreground">Challenges</p>
                            <p className="mt-1">{e.impact?.environmentalChallenges || '—'}</p>
                          </div>
                          <div className="rounded-md border border-border/60 p-3 text-xs">
                            <p className="text-muted-foreground">Prevention Note</p>
                            <p className="mt-1">{e.impact?.preventionIdeas || '—'}</p>
                          </div>
                        </div>
                        {additionalLinks.length > 0 && (
                          <div className="border-t border-border px-4 py-3">
                            <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Additional report links</p>
                            <div className="flex flex-wrap gap-2">
                              {additionalLinks.map((link, idx) => (
                                <a
                                  key={`${e.submissionId}-link-${idx}`}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-brand-green hover:text-foreground"
                                >
                                  {truncateMiddle(link.title || link.url, 20, 8)}
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
                          {reportDownloadUrl ? (
                            <a
                              href={reportDownloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              download
                              className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs text-foreground hover:bg-accent hover:text-accent-foreground"
                            >
                              Download report PDF
                            </a>
                          ) : (
                            <Button disabled size="sm" variant="outline" className="text-xs">
                              Download report PDF
                            </Button>
                          )}
                          {cid && (
                            <button
                              type="button"
                              onClick={() => void copyAny(`cid-${e.submissionId}`, cid)}
                              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                              aria-label={`Copy IPFS CID for report ${e.submissionId}`}
                            >
                              {truncateMiddle(cid, 10, 8)}
                              {copiedKey === `cid-${e.submissionId}` ? <Check className="h-3.5 w-3.5 text-brand-green" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* 8) Hypercerts */}
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="font-bebas text-xl tracking-wider">Hypercerts</h2>
                  <p className="text-xs text-muted-foreground">Impact credential rewards and minting status</p>
                </div>
                <a href="/hypercerts" className="text-xs text-brand-green underline">
                  Open Hypercerts page
                </a>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Hypercert rewards</p>
                  <p className="mt-1 font-bebas text-2xl leading-none">{formatNum(data.rewards.hypercertsDCU, 0)} points</p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verified cleanups</p>
                  <p className="mt-1 font-bebas text-2xl leading-none">{formatNum(data.verifiedCleanups, 0)}</p>
                </div>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Verified reports</p>
                  <p className="mt-1 font-bebas text-2xl leading-none">{formatNum(data.verifiedWithReport, 0)}</p>
                </div>
              </div>
            </section>

            {/* 9) Impact Product */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-bebas text-xl tracking-wider">Impact Product Level</h2>
              <p className="text-xs text-muted-foreground">Cleanup Progression Credential · ERC-1155</p>
              <div className="mt-4 grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="overflow-hidden rounded-lg border border-border bg-black/40">
                  {data.impactProductImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.impactProductImageUrl} alt={`Impact Product level ${data.level}`} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center">
                      <Award className="h-10 w-10 text-brand-green/40" />
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <p className="font-bebas text-3xl leading-none">Level {data.level || 0}</p>
                  <div className="rounded-md border border-border/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Contract</p>
                    {CONTRACT_ADDRESSES.IMPACT_PRODUCT ? (
                      <a
                        href={`${REQUIRED_BLOCK_EXPLORER_URL}/address/${CONTRACT_ADDRESSES.IMPACT_PRODUCT}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-mono text-xs text-foreground underline"
                      >
                        {truncateMiddle(CONTRACT_ADDRESSES.IMPACT_PRODUCT, 10, 8)}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">not-configured</p>
                    )}
                  </div>
                  <a href={hashToGatewayUrl(data.impactProductImageUrl || '') || '#'} className="inline-flex items-center gap-1 text-xs text-brand-green underline">
                    Field verified metadata
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </section>

            {/* 10) Creator portfolio footer */}
            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="font-bebas text-xl tracking-wider">Creator Portfolio</h2>
              <p className="mt-2 text-sm text-foreground">{profile?.creatorName || ''}</p>
              <p className="text-xs text-muted-foreground">{profile?.creatorRole || ''}</p>
              <div className="mt-4 grid gap-2 md:grid-cols-2">
                <div className="rounded-md border border-border/60 p-3 text-xs">
                  <p className="text-muted-foreground">Active projects</p>
                  <p className="mt-1">{profile?.projects || ''}</p>
                </div>
                <div className="rounded-md border border-border/60 p-3 text-xs">
                  <p className="text-muted-foreground">Open to</p>
                  <p className="mt-1">{profile?.openTo || ''}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {socialLinks.map((s) => (
                  <a
                    key={`footer-${s.label}`}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    {s.label}
                  </a>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}

export default function PublicImpactPortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-10 w-10 animate-spin text-brand-green" />
        </div>
      }
    >
      <PublicPortfolioContent />
    </Suspense>
  )
}
