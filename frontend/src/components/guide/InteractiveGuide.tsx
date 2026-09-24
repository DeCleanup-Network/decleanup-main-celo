'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

type GuideState = {
  completed: boolean[]
  open: boolean[]
  checks: boolean[]
}

function loadState(storageKey: string, stepCount: number, checkCount: number): GuideState {
  const fallback: GuideState = {
    completed: Array(stepCount).fill(false),
    open: Array.from({ length: stepCount }, (_, i) => i === 0),
    checks: Array(checkCount).fill(false),
  }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return fallback
    const saved = JSON.parse(raw) as Partial<GuideState>
    if (!Array.isArray(saved.completed) || saved.completed.length !== stepCount) return fallback
    return {
      completed: saved.completed.map(Boolean),
      open:
        Array.isArray(saved.open) && saved.open.length === stepCount
          ? saved.open.map(Boolean)
          : fallback.open,
      checks:
        Array.isArray(saved.checks) && saved.checks.length === checkCount
          ? saved.checks.map(Boolean)
          : fallback.checks,
    }
  } catch {
    return fallback
  }
}

export function InteractiveGuide({
  storageKey,
  title,
  lede,
  doneCopy,
  steps,
  checkCount,
  footer,
  initialOpenIndex,
  initialScrollId,
}: {
  storageKey: string
  title: string
  lede: ReactNode
  doneCopy: string
  steps: GuideStep[]
  checkCount: number
  footer: ReactNode
  initialOpenIndex?: number
  initialScrollId?: string
}) {
  const stepCount = steps.length
  const [state, setState] = useState<GuideState>(() =>
    loadState(storageKey, stepCount, checkCount)
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const next = loadState(storageKey, stepCount, checkCount)
    if (initialOpenIndex != null && initialOpenIndex >= 0 && initialOpenIndex < stepCount) {
      next.open[initialOpenIndex] = true
    }
    setState(next)
    setHydrated(true)
  }, [storageKey, stepCount, checkCount, initialOpenIndex])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      /* ignore */
    }
  }, [hydrated, storageKey, state])

  useEffect(() => {
    if (!hydrated || !initialScrollId) return
    document.getElementById(initialScrollId)?.scrollIntoView({ block: 'start' })
  }, [hydrated, initialScrollId])

  const doneCount = state.completed.filter(Boolean).length

  const toggleOpen = (index: number) => {
    setState((prev) => {
      const open = [...prev.open]
      open[index] = !open[index]
      return { ...prev, open }
    })
  }

  const toggleComplete = (index: number) => {
    setState((prev) => {
      const completed = [...prev.completed]
      const open = [...prev.open]
      const next = !completed[index]
      completed[index] = next
      if (next && index < stepCount - 1) open[index + 1] = true
      return { ...prev, completed, open }
    })
  }

  const toggleCheck = (index: number) => {
    setState((prev) => {
      const checks = [...prev.checks]
      checks[index] = !checks[index]
      return { ...prev, checks }
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="sticky top-[calc(4.5rem+env(safe-area-inset-top,0px))] z-40 border-b border-white/[0.08] bg-background sm:top-[calc(5.5rem+env(safe-area-inset-top,0px))]">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="font-heading text-xs font-semibold uppercase tracking-[0.06em] text-white/60">
              Your progress
            </span>
            <span className="font-heading text-xs font-semibold text-brand-green">
              {doneCount} of {stepCount} steps
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-2 rounded-full bg-brand-green transition-all"
              style={{ width: `${Math.round((doneCount / stepCount) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-10 space-y-2 border-b border-white/[0.08] pb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand-green sm:text-4xl">
            {title}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">{lede}</p>
        </header>

        <div className="space-y-8">
          {steps.map((step, index) => (
            <StepCard
              key={step.id}
              id={step.id}
              index={index}
              title={step.title}
              account={step.account}
              open={state.open[index]}
              complete={state.completed[index]}
              onToggle={() => toggleOpen(index)}
              onComplete={() => toggleComplete(index)}
            >
              {step.render({ checks: state.checks, toggleCheck })}
            </StepCard>
          ))}

          {doneCount === stepCount ? (
            <div
              className="rounded-xl border border-brand-green/35 bg-brand-green/5 p-5 sm:p-6"
              role="status"
            >
              <p className="font-heading mb-2 text-xl font-semibold tracking-tight text-brand-green">
                Guide complete
              </p>
              <p className="text-sm leading-relaxed text-white/60">{doneCopy}</p>
            </div>
          ) : null}

          <footer className="space-y-4 border-t border-white/[0.08] pt-8 text-sm text-white/60">
            {footer}
          </footer>
        </div>
      </div>
    </div>
  )
}

export type GuideStepRender = {
  checks: boolean[]
  toggleCheck: (index: number) => void
}

export type GuideStep = {
  id: string
  title: string
  account?: boolean
  render: (ctx: GuideStepRender) => ReactNode
}

function StepCard({
  id,
  index,
  title,
  account,
  open,
  complete,
  onToggle,
  onComplete,
  children,
}: {
  id: string
  index: number
  title: string
  account?: boolean
  open: boolean
  complete: boolean
  onToggle: () => void
  onComplete: () => void
  children: ReactNode
}) {
  const bodyId = `${id}-body`

  return (
    <section
      id={id}
      className={`scroll-mt-24 overflow-hidden rounded-xl border ${
        account ? 'border-l-2 border-l-brand-yellow bg-[#1b1b1b]' : 'bg-[#141414]'
      } ${complete ? 'border-brand-green/35' : 'border-white/[0.08]'}`}
    >
      <button
        type="button"
        className="flex min-h-[48px] w-full items-center gap-3 p-5 text-left sm:p-6"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span
          className={`font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
            complete
              ? 'border-brand-green bg-brand-green text-[#0a0a0a]'
              : account
                ? 'border-white/10 bg-white/[0.04] text-white/70'
                : 'border-brand-green/30 bg-brand-green/10 text-brand-green'
          }`}
          aria-hidden
        >
          {index + 1}
        </span>
        <span className="font-heading min-w-0 flex-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {title}
        </span>
        {account ? (
          <span className="rounded-full border border-brand-yellow/50 bg-brand-yellow/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-yellow">
            Account
          </span>
        ) : null}
        {complete ? (
          <span className="rounded-full border border-brand-green/50 bg-brand-green/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-green">
            Done
          </span>
        ) : null}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={bodyId} className="space-y-4 border-t border-white/[0.08] px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
          {children}
          <button
            type="button"
            aria-pressed={complete}
            onClick={onComplete}
            className={
              complete
                ? 'inline-flex min-h-[48px] items-center justify-center rounded-lg border border-brand-green/40 bg-transparent px-5 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-brand-green'
                : 'inline-flex min-h-[48px] items-center justify-center rounded-lg border border-brand-green bg-brand-green px-5 py-2.5 font-heading text-sm font-semibold uppercase tracking-wide text-[#0a0a0a] shadow-btn-brand hover:shadow-btn-brand-hover'
            }
          >
            {complete ? 'Completed' : 'Mark complete'}
          </button>
        </div>
      ) : null}
    </section>
  )
}

export function GuideCheckItem({
  checked,
  onChange,
  children,
  number,
}: {
  checked: boolean
  onChange: () => void
  children: ReactNode
  number?: number
}) {
  return (
    <label
      className={`flex min-h-[44px] cursor-pointer items-start gap-3 rounded-lg border p-3 ${
        checked ? 'border-brand-green/35 bg-brand-green/5' : 'border-white/[0.08] bg-background/40'
      }`}
    >
      {number != null ? (
        <span
          className="font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/70"
          aria-hidden
        >
          {number}
        </span>
      ) : null}
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-green"
      />
      <span className="text-sm leading-relaxed text-white/60">{children}</span>
    </label>
  )
}

export function GuideLink({ href, children }: { href: string; children: ReactNode }) {
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
    >
      {children}
    </a>
  )
}
