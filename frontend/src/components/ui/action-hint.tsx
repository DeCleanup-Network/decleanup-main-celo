'use client'

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const HOVER_SHOW_MS = 100

function useTouchUi(): boolean | null {
  const [touchUi, setTouchUi] = useState<boolean | null>(null)
  useEffect(() => {
    const mq = window.matchMedia('(hover: none), (pointer: coarse)')
    const sync = () => setTouchUi(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return touchUi
}

type ActionHintProps = {
  hint: string
  children: ReactElement<{ className?: string; title?: string }>
}

/**
 * Fast desktop hints (~100ms) via a floating label; on touch / coarse pointers, a small ? opens a bottom sheet
 * (native `title` is slow and unreliable on mobile).
 */
export function ActionHint({ hint, children }: ActionHintProps) {
  const touchUi = useTouchUi()
  const [open, setOpen] = useState(false)
  const hoverTimer = useRef<number | null>(null)

  const clearHoverTimer = useCallback(() => {
    if (hoverTimer.current) {
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  const scheduleOpen = useCallback(() => {
    if (touchUi) return
    clearHoverTimer()
    hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_SHOW_MS)
  }, [clearHoverTimer, touchUi])

  const closeHint = useCallback(() => {
    clearHoverTimer()
    setOpen(false)
  }, [clearHoverTimer])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!isValidElement(children)) return children

  const child = cloneElement(children, {
    className: cn(children.props.className, touchUi === true && 'pr-6'),
    title: undefined,
  })

  const desktopHover = touchUi === false

  return (
    <div
      className="relative inline-flex shrink-0"
      onMouseOver={(e) => {
        if (!desktopHover) return
        const from = e.relatedTarget
        if (from instanceof Node && e.currentTarget.contains(from)) return
        scheduleOpen()
      }}
      onMouseOut={(e) => {
        if (!desktopHover) return
        const next = e.relatedTarget
        if (next instanceof Node && e.currentTarget.contains(next)) return
        closeHint()
      }}
    >
      {child}

      {touchUi === true ? (
        <>
          <button
            type="button"
            className="absolute right-1 top-1/2 z-[1] -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/50"
            aria-label={`Hint: ${hint}`}
            aria-expanded={open}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen((v) => !v)
            }}
          >
            <HelpCircle className="h-3 w-3 shrink-0" aria-hidden />
          </button>
          {open ? (
            <>
              <button
                type="button"
                className="fixed inset-0 z-[48] bg-black/40"
                aria-label="Close hint"
                onClick={() => setOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                className="fixed bottom-0 left-0 right-0 z-[49] max-h-[42vh] overflow-y-auto border-t border-border bg-card px-4 pt-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)]"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
              >
                <p className="text-sm leading-relaxed text-foreground">{hint}</p>
                <button
                  type="button"
                  className="mt-3 text-xs font-semibold uppercase tracking-wide text-brand-green"
                  onClick={() => setOpen(false)}
                >
                  Close
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : desktopHover && open ? (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 rounded-md border border-border bg-popover px-3 py-2.5 text-left text-xs leading-relaxed text-popover-foreground shadow-md sm:text-[13px]',
            /* Wide reading column — avoids tall skinny tooltips */
            'max-w-xl min-w-[min(17rem,calc(100vw-2rem))] w-[min(26rem,calc(100vw-1rem))]'
          )}
        >
          {hint}
        </span>
      ) : null}
    </div>
  )
}
