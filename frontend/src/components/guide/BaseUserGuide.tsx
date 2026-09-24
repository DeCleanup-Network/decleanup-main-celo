'use client'

import { Mail, Wallet } from 'lucide-react'
import {
  GuideCheckItem,
  GuideLink,
  InteractiveGuide,
  type GuideStep,
} from '@/components/guide/InteractiveGuide'

const BASE_STEPS: GuideStep[] = [
  {
    id: 'step-1',
    title: 'Step 1: Sign in',
    render: () => (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-brand-green/35 bg-brand-green/5 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
            <p className="font-heading text-base font-semibold text-white">Email or Google</p>
          </div>
          <p className="text-sm leading-relaxed text-white/60">
            We create a Base smart account, gas covered for routine transactions when Pimlico is
            active.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-background/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
            <p className="font-heading text-base font-semibold text-white">Connect your wallet</p>
          </div>
          <p className="text-sm leading-relaxed text-white/60">
            MetaMask or WalletConnect on Base, small ETH fee per transaction.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'step-2',
    title: 'Step 2: Submit your cleanup',
    render: ({ checks, toggleCheck }) => (
      <>
        <ul className="space-y-3">
          {[
            'Take a before photo and an after photo (up to 10 MB each, both required)',
            'Allow location access when prompted - required for geotagging. If it fails: enable Location Services, allow the browser, allow this site. Coordinates can also be entered manually.',
            'Submit the cleanup form',
            'Wait for verifier review and approval - a trained community verifier attests onchain',
          ].map((item, index) => (
            <li key={item}>
              <GuideCheckItem checked={checks[index]} onChange={() => toggleCheck(index)}>
                {item}
              </GuideCheckItem>
            </li>
          ))}
        </ul>
        <p className="pt-1">
          <GuideLink href="https://dapp.decleanup.net/cleanup">Open cleanup form →</GuideLink>
        </p>
      </>
    ),
  },
  {
    id: 'step-3',
    title: 'Step 3: Collect your rewards',
    render: () => (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
          <p className="font-heading mb-1.5 text-sm font-semibold text-brand-green">$bDCU</p>
          <p className="text-xs leading-relaxed text-white/60">
            The Base action token, earned after each verified cleanup, tradable
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
          <p className="font-heading mb-1.5 text-sm font-semibold text-brand-green">Impact Product</p>
          <p className="text-xs leading-relaxed text-white/60">
            Your cleanup level on Base, levels up with each verified event, claim from dashboard
          </p>
        </div>
      </div>
    ),
  },
]

export function BaseUserGuide() {
  return (
    <InteractiveGuide
      storageKey="decleanup-base-guide-v1"
      title="User Guide - Base"
      lede="Simple cleanup on Base: sign in, submit proof, get verified, earn $bDCU."
      doneCopy="All three steps are done. You are ready to clean up on Base."
      steps={BASE_STEPS}
      checkCount={4}
      footer={
        <>
          <p>
            Something not working?{' '}
            <GuideLink href="https://t.me/c/DecentralizedCleanup/17">
              Message us on Telegram
            </GuideLink>
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <GuideLink href="https://dapp.decleanup.net/terms">Terms of Service</GuideLink>
            <GuideLink href="https://dapp.decleanup.net/privacy">Privacy Policy</GuideLink>
          </p>
        </>
      }
    />
  )
}
