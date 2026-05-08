'use client'

import Link from 'next/link'
import { BackButton } from '@/components/layout/BackButton'
import { WEB3AUTH_ACCOUNT_DASHBOARD_URL, WEB3AUTH_DEVELOPER_DASHBOARD_URL } from '@/lib/web3auth/urls'

export default function UserGuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
        <BackButton href="/" label="Back" />
        <article className="mt-4 rounded-2xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground sm:p-6">
          <h1 className="mb-2 font-bebas text-3xl tracking-wide text-brand-green sm:text-4xl">User Guide</h1>
          <p className="mb-5">
            Practical guide for daily app usage on DeCleanup. This page is written for both social-login users
            (Web3Auth embedded wallet) and external wallet users.
          </p>

          <section className="mb-5">
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">1) Choose your login</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Use Email/Google for quick onboarding (embedded wallet created in background).</li>
              <li>Or connect an external wallet (MetaMask / WalletConnect).</li>
            </ul>
          </section>

          <section className="mb-5">
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">2) Network basics (Celo + Base context)</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Main app flows (cleanup submission, verifier workflow, rewards) run on Celo setup configured in app.</li>
              <li>Some analytics/impact views may aggregate across enabled chains (for example Celo + Base) when configured.</li>
              <li>Always verify your current chain in wallet before submitting transactions.</li>
            </ul>
            <p className="mt-2">
              Common guide on website:{' '}
              <a
                href="https://decleanup.net/user-guide"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green underline"
              >
                decleanup.net/user-guide
              </a>
            </p>
          </section>

          <section className="mb-5">
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">3) Import embedded wallet later (if needed)</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Log in with the same social account used in DeCleanup.</li>
              <li>
                Open{' '}
                <a
                  href={WEB3AUTH_ACCOUNT_DASHBOARD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-green underline"
                >
                  Manage Wallet (Web3Auth account dashboard)
                </a>{' '}
                to access wallet/account settings and official export/recovery flows.
              </li>
              <li>Import into external wallet app only if you understand key custody risks.</li>
              <li>After import, keep small CELO balance for gas if paymaster sponsorship is unavailable.</li>
            </ul>
            <p className="mt-2">
              If login services are unavailable, check your project/operator status in{' '}
              <a
                href={WEB3AUTH_DEVELOPER_DASHBOARD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-green underline"
              >
                Web3Auth dashboard
              </a>
              .
            </p>
          </section>

          <section className="mb-5">
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">4) Gas and submission tips</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Keep a small CELO buffer for fallback gas.</li>
              <li>If submission fails, retry after checking network + wallet session + image upload status.</li>
              <li>Use stable connection for before/after upload and impact form attachment.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">5) Useful pages</h2>
            <p>
              Home dashboard, verifier cabinet, hypercerts page, leaderboard, and public impact portfolio. Legal pages:{' '}
              <Link href="/terms" className="text-brand-green underline">Terms</Link>
              {' · '}
              <Link href="/privacy" className="text-brand-green underline">Privacy</Link>.
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
