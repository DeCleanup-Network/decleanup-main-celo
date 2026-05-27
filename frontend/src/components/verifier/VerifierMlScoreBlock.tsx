'use client'

import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

type MlStoredResult = {
  submissionId?: string
  score?: {
    verdict?: string
    score?: number
    delta?: number
    confidenceVariance?: number
  }
  hash?: string
  beforeInference?: { objectCount: number; meanConfidence: number }
  afterInference?: { objectCount: number; meanConfidence: number }
}

type MlApiEmpty = {
  hasResult: false
  message?: string
  cleanupId?: string
  mlVerificationDisabled?: boolean
}

export function VerifierMlScoreBlock({ cleanupId }: { cleanupId: string }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<MlStoredResult | MlApiEmpty | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/ml-verification/result?cleanupId=${encodeURIComponent(cleanupId)}`)
      .then((r) => r.json())
      .then((json: MlStoredResult | MlApiEmpty) => {
        if (!cancelled) setData(json)
      })
      .catch(() => {
        if (!cancelled) setData({ hasResult: false, message: 'Request failed' })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cleanupId])

  if (loading) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-950/20 p-3 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
        Loading AI pre-screening for this submission…
      </div>
    )
  }

  const empty = data && typeof data === 'object' && 'hasResult' in data && data.hasResult === false
  const stored = data && !empty ? (data as MlStoredResult) : null
  const hasScore = Boolean(stored?.score)
  const emptyPayload = empty ? (data as MlApiEmpty) : null
  const mlOff = Boolean(emptyPayload?.mlVerificationDisabled)

  if (!stored || !hasScore) {
    return (
      <div
        className={`mb-4 rounded-lg border p-3 ${
          mlOff
            ? 'border-gray-500/40 bg-gray-950/40'
            : 'border-amber-500/40 bg-amber-950/15'
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            mlOff ? 'text-gray-300/90' : 'text-amber-200/90'
          }`}
        >
          {mlOff ? 'AI pre-screening off' : 'AI pre-screening unavailable'}
        </p>
        <p className={`mt-1 text-xs ${mlOff ? 'text-gray-400' : 'text-amber-100/70'}`}>
          {emptyPayload?.message ||
            'No AI result file on this server for this ID. Submitter’s app must hit POST /api/ml-verification/verify on this host (check UPLOAD_DIR / same deployment).'}
        </p>
      </div>
    )
  }

  const { score, hash, beforeInference, afterInference } = stored
  const verdict = score?.verdict ?? 'unknown'
  const rawScore = typeof score?.score === 'number' ? score.score : 0
  const confidence = Math.max(0, Math.min(100, Math.round(rawScore * 100)))
  const confidenceColor =
    rawScore < 0.3 ? 'bg-red-500' : rawScore <= 0.6 ? 'bg-yellow-400' : 'bg-emerald-500'
  const delta = typeof score?.delta === 'number' ? score.delta : null
  const wastePillClass =
    delta == null
      ? 'bg-gray-500/20 text-gray-200 ring-1 ring-gray-400/30'
      : delta > 0
        ? 'bg-emerald-500/20 text-emerald-200 ring-1 ring-emerald-500/30'
        : delta === 0
          ? 'bg-gray-500/20 text-gray-200 ring-1 ring-gray-400/30'
          : 'bg-red-500/20 text-red-200 ring-1 ring-red-500/30'
  const wastePillText =
    delta == null
      ? '~ No change detected'
      : delta > 0
        ? `✓ +${delta} items detected`
        : delta === 0
          ? '~ No change detected'
          : `⚠ ${delta} items detected`

  return (
    <div className="mb-4 rounded-xl border-2 border-cyan-500/50 bg-gradient-to-b from-cyan-950/60 to-gray-950/90 p-4 text-left shadow-lg shadow-cyan-950/20">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-cyan-300" aria-hidden />
        <p className="text-sm font-bold uppercase tracking-wide text-cyan-200">
          AI PRE-SCREENING RESULT
        </p>
      </div>
      <p className="mb-3 text-xs text-cyan-100/85">
        AI pre-screened this cleanup. Use as a triage guide - your onchain decision is final.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
            verdict === 'approved'
              ? 'bg-emerald-500/30 text-emerald-100'
              : verdict === 'rejected'
                ? 'bg-amber-500/30 text-amber-100'
                : 'bg-yellow-500/25 text-yellow-100'
          }`}
        >
          {verdict}
        </span>
      </div>
      <div className="rounded-lg bg-black/40 p-3 ring-1 ring-white/10">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">AI confidence</p>
          <p className="text-xs font-semibold text-white">{confidence}%</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all ${confidenceColor}`}
            style={{ width: `${confidence}%` }}
            aria-hidden
          />
        </div>
      </div>
      <div className="mt-3 flex justify-center">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${wastePillClass}`}>{wastePillText}</span>
      </div>
      {beforeInference != null && afterInference != null && (
        <p className="mt-3 text-xs text-gray-500">
          Before: {beforeInference.objectCount} obj @{' '}
          {typeof beforeInference.meanConfidence === 'number'
            ? beforeInference.meanConfidence.toFixed(2)
            : beforeInference.meanConfidence}{' '}
          · After: {afterInference.objectCount} obj @{' '}
          {typeof afterInference.meanConfidence === 'number'
            ? afterInference.meanConfidence.toFixed(2)
            : afterInference.meanConfidence}
        </p>
      )}
      {hash ? (
        <p className="mt-2 truncate font-mono text-[10px] text-gray-600" title={hash}>
          Audit hash: {hash}
        </p>
      ) : null}
    </div>
  )
}
