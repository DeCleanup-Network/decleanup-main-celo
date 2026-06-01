'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BackButton } from '@/components/layout/BackButton'
import { ChevronDown, Mail, Wallet, MessageCircle } from 'lucide-react'
const EMBEDDED_WALLET_DASHBOARD_PATH = '/wallet'

type StepId = 1 | 2 | 3

const bebasHeadingStyle = {
  fontFamily: 'var(--font-bebas-neue), sans-serif',
  letterSpacing: '0.05em',
} as const

function StepCard({
  step,
  title,
  activeStep,
  onOpen,
  children,
}: {
  step: StepId
  title: string
  activeStep: StepId
  onOpen: (step: StepId) => void
  children: React.ReactNode
}) {
  const isActive = activeStep === step

  return (
    <section
      className={`rounded-2xl border bg-card transition-all duration-300 ${
        isActive ? 'border-brand-green/50 shadow-[0_0_0_1px_rgba(88,177,47,0.15)]' : 'border-border hover:border-brand-green/30'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(step)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition-colors sm:px-5 ${
          isActive ? 'border-l-2 border-l-brand-green' : 'border-l-2 border-l-transparent'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-brand-green/40 bg-brand-green/10 text-xs font-semibold text-brand-green">
            {step}
          </span>
          <h2 className="font-bebas text-xl tracking-wide text-foreground sm:text-2xl">{title}</h2>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${isActive ? 'rotate-180 text-brand-green' : ''}`}
          aria-hidden
        />
      </button>

      <div
        className={`overflow-hidden px-4 transition-all duration-300 sm:px-5 ${
          isActive ? 'max-h-[2000px] pb-5 opacity-100' : 'max-h-0 pb-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </section>
  )
}

export default function UserGuidePage() {
  const [activeStep, setActiveStep] = useState<StepId>(1)
  const [showAdvancedExport, setShowAdvancedExport] = useState(false)

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <BackButton href="/" label="Back" />
        <article className="mt-4 space-y-4 rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground sm:p-6">
          <h1 className="font-bebas text-3xl tracking-wide text-brand-green sm:text-4xl">User Guide</h1>

          <div className="rounded-xl border border-border bg-background/40 p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Progress</span>
              <span>Step {activeStep} of 3</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setActiveStep(step as StepId)}
                  className={`h-2 rounded-full transition-all ${
                    activeStep >= step ? 'bg-brand-green' : 'bg-muted'
                  } hover:opacity-80`}
                  aria-label={`Open step ${step}`}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border/80 bg-background/30 p-4 text-sm text-muted-foreground">
            <p>
              This guide is for <strong className="text-foreground">DeCleanup Rewards</strong> at{' '}
              <a href="https://dapp.decleanup.net" className="text-brand-green underline">
                dapp.decleanup.net
              </a>
              . DeCleanup Network is the nonprofit behind the protocol; the app is where you log cleanups,
              earn DCU, claim $cDCU, and manage your smart account.
            </p>
          </div>

          <StepCard
            step={1}
            title="How do you want to sign in?"
            activeStep={activeStep}
            onOpen={setActiveStep}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-brand-green/40 bg-brand-green/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-brand-green" />
                    <h3 className="font-bebas text-lg tracking-wide text-foreground">Email or Google</h3>
                  </div>
                  <span className="rounded-full border border-brand-green/50 bg-brand-green/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-green">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Fastest way to start. We create a wallet for you automatically. Nothing to install.
                </p>
                <p className="mt-3 inline-flex rounded-full border border-brand-green/40 bg-brand-green/10 px-2.5 py-1 text-[11px] font-medium text-brand-green">
                  Gas fees covered for you
                </p>
              </div>

              <div className="rounded-xl border border-amber-500/35 bg-amber-500/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-300" />
                  <h3 className="font-bebas text-lg tracking-wide text-foreground">Your own wallet</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Connect MetaMask or any WalletConnect app. You keep full control of your keys.
                </p>
                <p className="mt-3 inline-flex rounded-full border border-amber-500/45 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                  You&apos;ll need a small CELO balance for gas
                </p>
                <p className="mt-3">
                  <a
                    href="https://docs.celo.org/home/gas-fees"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
                  >
                    How to get CELO →
                  </a>
                </p>
              </div>
            </div>
          </StepCard>

          <StepCard
            step={2}
            title="Actions and flow"
            activeStep={activeStep}
            onOpen={setActiveStep}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <h3 className="mb-2 font-bebas text-lg tracking-wide text-foreground">Do your first cleanup submission</h3>
                <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>Add one before cleanup photo and one after cleanup photo (up to 10 MB each).</li>
                  <li>
                    Allow location when prompted (required for geotagging). If it fails, turn on Location Services in
                    phone Settings, allow your browser to use location, and allow this site in browser site settings —
                    or enter coordinates manually on the submit screen.
                  </li>
                  <li>Add impact report and recyclables report (optional).</li>
                  <li>Submit the cleanup.</li>
                  <li>Wait for verifier approval.</li>
                  <li>Claim your level after approval.</li>
                </ol>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-4">
                <h3 className="mb-2 font-bebas text-lg tracking-wide text-foreground">Understand rewards breakdown</h3>
                <p className="mb-2 text-sm text-muted-foreground">
                  DCU are onchain participation points. You earn them from actions in the app:
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                  <li>
                    <span className="text-foreground">Impact Products:</span> 10 DCU per verified level claim.
                  </li>
                  <li>
                    <span className="text-foreground">Referrals:</span> 3 DCU when your invite completes a verified cleanup.
                  </li>
                  <li>
                    <span className="text-foreground">Streaks:</span> 3 DCU per streak level for weekly activity.
                  </li>
                  <li>
                    <span className="text-foreground">Impact report or recyclables report:</span> 5 DCU each when verified.
                  </li>
                  <li>
                    <span className="text-foreground">Verifier work:</span> 1 DCU per reviewed submission.
                  </li>
                  <li>
                    <span className="text-foreground">Hypercerts:</span> 10 DCU per ten verified cleanups when you create a Hypercert.
                  </li>
                </ul>
                <p className="mt-3 text-sm text-muted-foreground">
                  Impact Product is your onchain progression asset. Each approved cleanup can move your level forward.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  $cDCU is the claimable ERC-20 token. Every 50 DCU milestone can unlock a claim from the dashboard.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  More details:{' '}
                  <a
                    href="http://decleanup.net/litepaper"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                  >
                    Litepaper
                  </a>
                  {' · '}
                  <a
                    href="http://decleanup.net/tokenomics"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                  >
                    Tokenomics
                  </a>
                </p>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-4">
                <h3 className="mb-2 font-bebas text-lg tracking-wide text-foreground">Hypercerts and impact portfolio</h3>
                <p className="text-sm text-muted-foreground">
                  Hypercerts summarize verified impact across multiple cleanups. Open the Hypercerts page to check eligibility, submit a request, and mint after verifier approval.
                </p>
                <p className="mt-2">
                  <a
                    href="https://hypercerts.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                  >
                    Learn more about Hypercerts →
                  </a>
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  You can also update your profile with more info about your work and share your Impact Portfolio page with potential funders.
                </p>
              </div>
            </div>
          </StepCard>

          <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4 text-sm text-muted-foreground">
            <h3 className="mb-2 font-bebas text-lg tracking-wide text-foreground">Past contributor airdrop</h3>
            <p>
              If you were on the early supporter list, open{' '}
              <Link href="/airdrop" className="text-brand-green underline">
                /airdrop
              </Link>
              , paste your wallet address, and sign in with the same wallet. After a successful claim you earn a{' '}
              <strong className="text-foreground">Past contributor</strong> badge on your dashboard and Impact
              Portfolio.
            </p>
          </div>

          <StepCard
            step={3}
            title="Need to access your embedded wallet later?"
            activeStep={activeStep}
            onOpen={setActiveStep}
          >
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background/40 p-4">
                <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                  <li>
                    <h3 className="mb-1 font-bebas text-lg tracking-wide text-foreground" style={bebasHeadingStyle}>
                      Find your wallet
                    </h3>
                    <p className="mt-1">
                      Go to{' '}
                      <Link
                        href={EMBEDDED_WALLET_DASHBOARD_PATH}
                        className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                      >
                        your wallet dashboard
                      </Link>{' '}
                      and log in with the same Google or email you used in DeCleanup Rewards.
                    </p>
                  </li>
                  <li>
                    <h3 className="mb-1 font-bebas text-lg tracking-wide text-foreground" style={bebasHeadingStyle}>
                      Security setup
                    </h3>
                    <p className="mt-1">
                      Enable a <strong className="text-foreground">passkey</strong> so signing and claims can unlock with
                      Face ID / Touch ID / Windows Hello. Download an encrypted backup and store it safely offline.
                    </p>
                  </li>
                </ul>
              </div>

              <div className="rounded-xl border border-border bg-background/40 p-4">
                <button
                  type="button"
                  onClick={() => setShowAdvancedExport((prev) => !prev)}
                  className="flex w-full items-center justify-between rounded-md text-left transition-colors hover:text-foreground"
                >
                  <span className="font-bebas text-lg tracking-wide text-foreground" style={bebasHeadingStyle}>
                    Exporting your wallet (advanced)
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    I know what I&apos;m doing →
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-300 ${showAdvancedExport ? 'rotate-180 text-brand-green' : ''}`}
                      aria-hidden
                    />
                  </span>
                </button>

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    showAdvancedExport ? 'max-h-[600px] pt-3 opacity-100' : 'max-h-0 pt-0 opacity-0'
                  }`}
                >
                  <p className="text-sm text-muted-foreground">
                    In the Recovery phrase section, you can copy or download your seed phrase. Import it into MetaMask or any compatible wallet.
                  </p>
                  <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Anyone with your recovery phrase controls your funds. Never share it.
                  </div>
                  <p className="mt-2">
                    <a
                      href="https://www.quicknode.com/guides/web3-fundamentals-security/security/an-introduction-to-crypto-wallets-and-how-to-keep-them-secure"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-amber-300 underline underline-offset-2 hover:text-amber-200"
                    >
                      Learn about key custody →
                    </a>
                  </p>
                  <div className="my-3 h-px bg-border" />
                  <p className="text-sm text-muted-foreground">
                    Once exported, keep a small CELO balance for gas. Sponsored transactions may not always be available.
                  </p>
                  <p className="mt-2">
                    <a
                      href="https://docs.celo.org/home/gas-fees"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                    >
                      How to top up CELO →
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </StepCard>

          <footer className="pt-1 text-xs text-muted-foreground">
            <span>Something not working? </span>
            <a
              href="https://t.me/c/DecentralizedCleanup/17"
              target="_blank"
              rel="noopener noreferrer"
              className="footer-link inline-flex items-center gap-1 normal-case no-underline hover:underline"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Message us on Telegram
            </a>
          </footer>

          <div className="pt-1 text-xs text-muted-foreground">
            <a
              href="http://decleanup.net/user-guide"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Full Network guide
            </a>
            {' · '}
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">Terms</Link>
            {' · '}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy</Link>
          </div>
        </article>
      </div>
    </div>
  )
}
