import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronDown, Mail, MessageCircle, Wallet } from 'lucide-react'
import { buildPageMetadata } from '@/lib/seo/metadata'

export const metadata: Metadata = buildPageMetadata({
  title: 'User Guide',
  description:
    'How to sign in, submit cleanups, earn DCU, claim $cDCU, and secure your embedded wallet on DeCleanup Rewards.',
  path: '/guide',
})

const ACCOUNT_SETTINGS_PATH = '/wallet'

const REWARDS_ROWS = [
  { action: 'Verified cleanup (Impact Product level claim)', dcu: '10 DCU' },
  { action: 'Referral - invited user completes a verified cleanup', dcu: '3 DCU' },
  { action: 'Streak level (weekly activity)', dcu: '3 DCU per level' },
  { action: 'Impact report (verified)', dcu: '5 DCU' },
  { action: 'Recyclables report (verified)', dcu: '5 DCU' },
  { action: 'Verifier work (reviewing a submission)', dcu: '1 DCU per review' },
  { action: 'Hypercert creation (per 10 verified cleanups)', dcu: '10 DCU' },
] as const

const TOKEN_CONCEPTS = [
  {
    title: 'DCU',
    body: 'On-chain participation points. Earned from verified actions in the app.',
  },
  {
    title: 'Impact Product',
    body: 'Your on-chain progression asset. Each approved cleanup can advance your level.',
  },
  {
    title: '$cDCU',
    body: 'The claimable ERC-20 token. Every 50 DCU milestone unlocks a claim.',
  },
] as const

const SUBMIT_STEPS = [
  'Take one before photo and one after photo of your cleanup site (up to 10 MB each).',
  {
    main: 'Allow location access when prompted - this is required for geotagging your submission.',
    sub: 'If location fails: enable Location Services in your phone Settings, allow your browser to use location, and allow this site in your browser\'s site settings. You can also enter coordinates manually on the submit screen.',
  },
  'Optionally add an impact report and/or recyclables report.',
  'Submit the cleanup.',
  'Wait for verifier review and approval.',
  'Once approved, claim your Impact Product level from the dashboard.',
] as const

const WALLET_SECURITY_STEPS = [
  'Go to Account Settings and sign in with the same Google account you used in DeCleanup Rewards.',
  'Create a wallet passkey. Enable Face ID, Touch ID, or Windows Hello for faster unlock on this device.',
  'On a new phone or browser, sign in with the same account and enter your wallet passkey to unlock.',
  'Optional: when you are ready, export your signer key to MetaMask. That is your own backup if you forget the app passkey later.',
] as const

function SectionCard({
  id,
  children,
  className = '',
}: {
  id?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-white/[0.08] bg-[#141414] p-5 sm:p-6 ${className}`}
    >
      {children}
    </section>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-heading mb-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">
      {children}
    </h2>
  )
}

function ExternalLink({
  href,
  children,
  className = 'text-brand-green underline underline-offset-2 hover:text-brand-green/90',
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  )
}

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Page header */}
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
              User Guide
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
              DeCleanup Rewards at{' '}
              <ExternalLink href="https://dapp.decleanup.net" className="text-brand-green underline underline-offset-2">
                dapp.decleanup.net
              </ExternalLink>{' '}
              - where you log cleanups, earn DCU, and claim $cDCU.
            </p>
          </div>
        </header>

        <div className="space-y-8">
          {/* Step 1: Sign In */}
          <SectionCard>
            <SectionHeading>Step 1 - Sign In</SectionHeading>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-green/35 bg-brand-green/5 p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
                    <h3 className="font-heading text-base font-semibold text-white">Email or Google</h3>
                  </div>
                  <span className="rounded-full border border-brand-green/50 bg-brand-green/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-green">
                    Recommended
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-white/60">
                  The fastest way to start. We create a wallet for you automatically. Nothing to install, no browser
                  extension needed.
                </p>
                <p className="mt-3 inline-flex rounded-lg border border-brand-green/40 bg-brand-green/10 px-2.5 py-1 text-[11px] font-medium text-brand-green">
                  Gas fees are covered for you
                </p>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-background/40 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
                  <h3 className="font-heading text-base font-semibold text-white">Connect your wallet</h3>
                </div>
                <p className="text-sm leading-relaxed text-white/60">
                  Connect MetaMask or any WalletConnect-compatible app. You keep full custody of your keys.
                </p>
                <p className="mt-3 text-sm text-white/60">
                  You will need a small CELO balance for gas.{' '}
                  <ExternalLink href="https://docs.celo.org/home/gas-fees">How to get CELO</ExternalLink>
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Step 2: Submit a Cleanup */}
          <SectionCard>
            <SectionHeading>Step 2 - Submit a Cleanup</SectionHeading>
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
            <div className="mt-5 rounded-lg border border-brand-green/25 bg-brand-green/5 px-4 py-3 text-sm leading-relaxed text-white/70">
              <strong className="text-white">Tip:</strong> iPhone users should avoid HEIC format. Use JPEG when
              possible, or enable &quot;Most Compatible&quot; format in your iPhone camera settings (Settings &gt; Camera
              &gt; Formats).
            </div>
          </SectionCard>

          {/* Step 3: Rewards */}
          <SectionCard>
            <SectionHeading>Step 3 - Understand Your Rewards</SectionHeading>
            <p className="mb-5 text-sm leading-relaxed text-white/60">
              DCU are your on-chain participation points. You earn them through verified actions in the app. Every 50
              DCU unlocks a $cDCU claim from your dashboard.
            </p>

            <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                    <th className="px-4 py-3 font-heading font-semibold text-white">Action</th>
                    <th className="px-4 py-3 font-heading font-semibold text-white whitespace-nowrap">DCU Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {REWARDS_ROWS.map((row) => (
                    <tr key={row.action} className="border-b border-white/[0.06] last:border-0">
                      <td className="px-4 py-3 text-white/60">{row.action}</td>
                      <td className="px-4 py-3 font-mono text-xs text-brand-green whitespace-nowrap">{row.dcu}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TOKEN_CONCEPTS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-lg border border-white/[0.08] bg-background/50 p-4"
                >
                  <h3 className="font-heading mb-1.5 text-sm font-semibold text-brand-green">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-white/60">{item.body}</p>
                </div>
              ))}
            </div>

            <p className="mt-5 text-sm text-white/60">
              <ExternalLink href="http://decleanup.net/litepaper">Litepaper</ExternalLink>
              {' · '}
              <ExternalLink href="http://decleanup.net/tokenomics">Tokenomics</ExternalLink>
            </p>
          </SectionCard>

          {/* Hypercerts and Impact Portfolio */}
          <SectionCard>
            <SectionHeading>Hypercerts and Impact Portfolio</SectionHeading>
            <div className="space-y-5 text-sm leading-relaxed text-white/60">
              <div>
                <h3 className="font-heading mb-2 text-base font-semibold text-white">Hypercerts</h3>
                <p>
                  Hypercerts summarize your verified impact across multiple cleanups into a single on-chain
                  attestation. To mint one: open the Hypercerts page, check your eligibility, submit a request, and
                  mint after verifier approval.
                </p>
                <p className="mt-2">
                  <ExternalLink href="https://hypercerts.org/">Learn more about Hypercerts</ExternalLink>
                </p>
              </div>
              <div>
                <h3 className="font-heading mb-2 text-base font-semibold text-white">Impact Portfolio</h3>
                <p>
                  Update your profile with information about your cleanup work and share your Impact Portfolio page with
                  potential funders, grant programs, or impact investors.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Past Contributor Airdrop */}
          <SectionCard className="border-l-2 border-l-brand-green">
            <SectionHeading>Past Contributor Airdrop</SectionHeading>
            <p className="text-sm leading-relaxed text-white/60">
              If you were on the early supporter list, go to{' '}
              <Link href="/airdrop" className="text-brand-green underline underline-offset-2 hover:text-brand-green/90">
                /airdrop
              </Link>
              , paste your wallet address, and sign in with the same wallet used during the early period. After a
              successful claim, you will receive a <strong className="text-white">Past Contributor</strong> badge on
              your dashboard and Impact Portfolio.
            </p>
          </SectionCard>

          {/* Wallet Recovery */}
          <SectionCard id="embedded-wallet" className="scroll-mt-24">
            <SectionHeading>Accessing Your Embedded Wallet</SectionHeading>

            <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-relaxed text-amber-100/90">
              DeCleanup Rewards is non-custodial. Our team cannot see, reset, or recover your passkey or private key.
              Your Google sign-in opens the app - it does not store or recover your wallet.
            </div>

            <div className="mb-5 space-y-2 text-sm leading-relaxed text-white/60">
              <p className="font-medium text-white">You have two on-chain addresses:</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  <strong className="text-white">Smart account (Safe):</strong> owns your submissions and Impact
                  Products. This is the address shown on your Impact Portfolio.
                </li>
                <li>
                  <strong className="text-white">Signer address:</strong> the key that unlocks your smart account. Both
                  are visible in Account Settings.
                </li>
              </ul>
            </div>

            <h3 className="font-heading mb-3 text-base font-semibold text-white">Steps to secure your wallet</h3>
            <ol className="mb-5 space-y-3">
              {WALLET_SECURITY_STEPS.map((step, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed text-white/60">
                  <span
                    className="font-mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs font-semibold text-white/80"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 pt-0.5">
                    {index === 0 ? (
                      <>
                        Go to{' '}
                        <Link
                          href={ACCOUNT_SETTINGS_PATH}
                          className="text-brand-green underline underline-offset-2 hover:text-brand-green/90"
                        >
                          Account Settings
                        </Link>{' '}
                        and sign in with the same Google account you used in DeCleanup Rewards.
                      </>
                    ) : (
                      step
                    )}
                  </span>
                </li>
              ))}
            </ol>

            <div className="mb-5 rounded-lg border border-white/[0.08] bg-background/40 px-4 py-3 text-sm text-white/60">
              Forgot your wallet passkey? If you exported your signer key to MetaMask, connect MetaMask from the home
              page. Otherwise email support@decleanup.net for a team reset (new onchain address; old cleanups stay on
              the previous address).
            </div>

            <details className="group rounded-lg border border-white/[0.08] bg-background/30">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-white marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="font-heading">Back up to MetaMask (optional)</span>
                <ChevronDown
                  className="h-4 w-4 shrink-0 text-white/50 transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <div className="space-y-4 border-t border-white/[0.08] px-4 pb-4 pt-3 text-sm leading-relaxed text-white/60">
                <p>
                  In Account Settings, unlock your wallet and open Back up to MetaMask. Reveal the signer private
                  key and import it in MetaMask. Your DeCleanup smart account address stays the same; MetaMask holds
                  the signing key. If you forget the app wallet passkey later, connect MetaMask from the home page
                  instead of using Google unlock.
                </p>
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-100">
                  Anyone with your private key has full control of your signer. Never share it with anyone.
                </div>
                <p>
                  Once exported, keep a small CELO balance for gas. Sponsored transactions may not always be available.
                </p>
                <p>
                  <ExternalLink href="https://docs.celo.org/home/gas-fees">How to top up CELO</ExternalLink>
                </p>
              </div>
            </details>
          </SectionCard>

          {/* In-page footer */}
          <footer className="space-y-4 border-t border-white/[0.08] pt-8 text-sm text-white/60">
            <p>
              Something not working?{' '}
              <ExternalLink
                href="https://t.me/c/DecentralizedCleanup/17"
                className="inline-flex items-center gap-1.5 text-brand-green underline underline-offset-2 hover:text-brand-green/90"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Message us on Telegram
              </ExternalLink>
            </p>
            <p className="text-xs">
              <ExternalLink href="http://decleanup.net/user-guide">Full Network Guide</ExternalLink>
              {' · '}
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
