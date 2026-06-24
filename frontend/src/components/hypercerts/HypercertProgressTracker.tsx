'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export type HypercertFlowStep = {
  number: string
  title: string
  description: string
  completed: boolean
  active: boolean
}

type Props = {
  steps: HypercertFlowStep[]
}

export function HypercertProgressTracker({ steps }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {steps.map((step) => (
        <div
          key={step.number}
          className={cn(
            'flex flex-col gap-2 rounded-2xl border border-border bg-card p-6 transition-all',
            step.active && 'border-l-2 border-l-brand-green',
            !step.active && !step.completed && 'opacity-70'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
              -- {step.number} --
            </span>
            {step.completed ? <Check className="h-3.5 w-3.5 text-brand-green" aria-hidden /> : null}
          </div>
          <p className="font-heading text-lg uppercase tracking-wider text-foreground">{step.title}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{step.description}</p>
        </div>
      ))}
    </div>
  )
}
