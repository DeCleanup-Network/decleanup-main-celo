import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy | DeCleanup Network',
  description: 'Privacy Policy for the DeCleanup web application.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="text-brand-green hover:underline">
            ← Home
          </Link>
        </p>
        <h1 className="mb-2 font-bebas text-3xl tracking-wide text-brand-green sm:text-4xl">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted-foreground">Effective April 23, 2026 · DeCleanup Network</p>

        <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          <strong className="text-amber-200">Template - not legal advice.</strong> Have privacy counsel review for GDPR /
          CPRA or other regimes before production. Full text: <code className="rounded bg-black/40 px-1">docs/PRIVACY_POLICY.md</code>
        </div>

        <article className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">1. What we collect</h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-foreground">Wallet address</strong> and onchain activity you initiate (public onchain).
              </li>
              <li>
                <strong className="text-foreground">Cleanup media and forms</strong> you upload (often stored on IPFS or
                similar via our servers).
              </li>
              <li>
                <strong className="text-foreground">Technical data</strong> such as IP address, browser type, and logs for
                security and debugging.
              </li>
              <li>
                <strong className="text-foreground">Verifier / application records</strong> if you use flows backed by
                Supabase or another database (status fields, notes, optional contact info you provide).
              </li>
            </ul>
            <p className="mt-3">We do not ask for your seed phrase. Never share it with anyone.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">2. How we use data</h2>
            <p>To run and secure the Service, process submissions, prevent abuse, and meet legal obligations.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">3. Sharing</h2>
            <p>
              We use subprocessors (hosting, RPC, IPFS, databases). We may disclose information when required by law. We
              do not sell personal information in the traditional sense; if you add ad-tech that qualifies as “sale” under
              US state privacy laws, update this policy and offer required opt-outs.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">4. Retention and security</h2>
            <p>
              We retain data as needed for operations and legal compliance, then delete or anonymize where reasonable.
              Public IPFS content may remain reproducible outside our control.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">5. Your rights</h2>
            <p>
              Depending on <strong className="text-foreground">where you live</strong>, you may have rights to access,
              correct, delete, or export personal data. Use the contact published on decleanup.net or in the app. You may
              also complain to a supervisory authority in your region where the law allows.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">6. Children</h2>
            <p>The Service is not directed at children under 13.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">7. International users</h2>
            <p>Data may be processed in multiple countries; use appropriate transfer mechanisms where required.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">8. Changes</h2>
            <p>We may update this policy with a new effective date.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">9. Contact</h2>
            <p>Insert privacy contact for this deployment.</p>
          </section>

          <p className="text-xs text-muted-foreground">
            See also{' '}
            <Link href="/terms" className="text-brand-green hover:underline">
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </div>
    </div>
  )
}
