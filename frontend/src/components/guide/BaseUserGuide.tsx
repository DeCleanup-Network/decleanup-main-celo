import Link from 'next/link'
import { Mail, MessageCircle, Wallet } from 'lucide-react'

const SUBMIT_STEPS = [
  'Take one before photo and one after photo of your cleanup site (up to 10 MB each).',
  {
    main: 'Allow location access when prompted — this is required for geotagging your submission.',
    sub: 'If location fails: enable Location Services, allow the browser, and allow this site. You can also enter coordinates manually.',
  },
  'Submit the cleanup.',
  'Wait for verifier review and approval.',
  'Once approved, claim your Impact Product level and $bDCU from the dashboard.',
] as const

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-[#141414] p-5 sm:p-6">{children}</section>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
      {children}
    </h2>
  )
}

export function BaseUserGuide() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="mb-10 space-y-4 border-b border-white/[0.08] pb-8">
          <Link
            href="/"
            className="inline-flex min-h-[44px] min-w-[44px] items-center transition-opacity hover:opacity-90"
            aria-label="DeCleanup Rewards home"
          >
            <img src="/logo.png" alt="DeCleanup Network" className="h-14 w-14 sm:h-16 sm:w-16" />
          </Link>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand-green sm:text-4xl">
              User Guide — Base
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
              Simple cleanup on Base: sign in, submit proof, get verified, earn $bDCU.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          <SectionCard>
            <SectionHeading>Step 1 — Sign in</SectionHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-green/35 bg-brand-green/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                  <h3 className="font-heading text-base font-semibold text-white">Email or Google</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/60">
                  We create a Base smart account for you. Routine cleanup transactions can be sponsored
                  (ETH gas covered when Pimlico is on).
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-background/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                  <h3 className="font-heading text-base font-semibold text-white">Connect your wallet</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/60">
                  MetaMask or WalletConnect on Base. You pay a small ETH fee for gas.
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard>
            <SectionHeading>Step 2 — Submit a cleanup</SectionHeading>
            <ol className="space-y-4">
              {SUBMIT_STEPS.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed text-white/60">
                  <span
                    className="font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-green/30 bg-brand-green/10 text-xs font-semibold text-brand-green"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    {typeof step === 'string' ? (
                      <p>{step}</p>
                    ) : (
                      <>
                        <p>{step.main}</p>
                        <p className="mt-1 text-xs text-white/50">{step.sub}</p>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-sm text-white/60">
              <Link href="/cleanup" className="text-brand-green underline underline-offset-2 hover:text-brand-green/90">
                Open cleanup submit
              </Link>
            </p>
          </SectionCard>

          <SectionCard>
            <SectionHeading>Step 3 — Rewards on Base</SectionHeading>
            <p className="text-sm leading-relaxed text-white/60">
              Verified cleanups advance your Impact Product on Base and can pay $bDCU.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
                <h3 className="font-heading mb-1.5 text-sm font-semibold text-brand-green">$bDCU</h3>
                <p className="text-xs leading-relaxed text-white/60">
                  The Base action token. Earn it after verified cleanups on this chain.
                </p>
              </div>
              <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
                <h3 className="font-heading mb-1.5 text-sm font-semibold text-brand-green">Impact Product</h3>
                <p className="text-xs leading-relaxed text-white/60">
                  Your cleanup level on Base. Claim it from the dashboard after approval.
                </p>
              </div>
            </div>
          </SectionCard>

          <footer className="space-y-4 border-t border-white/[0.08] pt-8 text-sm text-white/60">
            <p>
              Something not working?{' '}
              <a
                href="https://t.me/c/DecentralizedCleanup/17"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-brand-green underline underline-offset-2 hover:text-brand-green/90"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Message us on Telegram
              </a>
            </p>
            <p className="text-xs">
              <Link href="/terms" className="text-brand-green underline underline-offset-2 hover:text-brand-green/90">
                Terms of Service
              </Link>
              {' · '}
              <Link href="/privacy" className="text-brand-green underline underline-offset-2 hover:text-brand-green/90">
                Privacy Policy
              </Link>
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
