import type { Metadata } from 'next'
import Link from 'next/link'

const PRIVACY_EMAIL = 'decentralizedcleanup@gmail.com'

export const metadata: Metadata = {
  title: 'Privacy Policy | DeCleanup Network',
  description: 'Privacy Policy for the DeCleanup Rewards web application.',
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

        <article className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">1. Information We Collect</h2>
            <p className="mb-3">When you use DeCleanup Rewards, we may collect the following:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                Wallet address and on-chain activity you initiate. This information is inherently public on the Celo
                blockchain.
              </li>
              <li>
                Cleanup submissions including photographs and form data you upload, stored on our servers and/or via IPFS
                or equivalent decentralized storage.
              </li>
              <li>
                Technical data including IP address, browser type, and access logs, collected for security and
                operational purposes.
              </li>
              <li>
                Verifier and application records generated when your submission is processed through our backend
                (including Supabase), such as status updates, reviewer notes, and any contact information you
                voluntarily provide.
              </li>
            </ul>
            <p className="mt-3">
              DeCleanup Rewards does not request your seed phrase or private key under any circumstances. You should
              never share these with any party.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">2. How We Use Your Information</h2>
            <p>
              We use collected data to operate and secure DeCleanup Rewards, process cleanup submissions, prevent
              fraudulent or abusive activity, and fulfill legal obligations.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">3. Disclosure and Sharing</h2>
            <p>
              We engage subprocessors to support platform operations, including hosting providers, Celo RPC services,
              IPFS pinning services, and database providers. We may disclose personal information when required to do so
              by law or valid legal process. We do not sell personal information. If advertising technology is
              incorporated that constitutes a &quot;sale&quot; under applicable US state privacy statutes, this policy
              must be updated and required opt-out mechanisms provided.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">4. Retention and Security</h2>
            <p>
              We retain personal data for as long as necessary to support platform operations and satisfy legal
              obligations. Data is deleted or anonymized when retention is no longer required. Please be aware that
              content pinned to IPFS or stored on public decentralized networks may remain accessible beyond our
              control.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">5. Your Rights</h2>
            <p>
              Depending on your jurisdiction, you may have rights to access, correct, delete, restrict the processing
              of, or receive a portable copy of your personal data. To exercise any of these rights, contact us using
              the information published on decleanup.net or within the platform. You may also have the right to lodge a
              complaint with a competent supervisory authority in your region.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">6. Children</h2>
            <p>
              DeCleanup Rewards is not directed at children under the age of 13. We do not knowingly collect personal
              data from children.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">7. International Data Transfers</h2>
            <p>
              Your data may be processed in jurisdictions outside your country of residence. Where legally required, we
              apply appropriate transfer mechanisms to ensure adequate protection of personal data.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">8. Policy Updates</h2>
            <p>
              We may update this Privacy Policy from time to time. The revised effective date will be reflected at the
              top of this page.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">9. Contact</h2>
            <p>
              <a href={`mailto:${PRIVACY_EMAIL}`} className="text-brand-green hover:underline">
                {PRIVACY_EMAIL}
              </a>
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              For terms governing your use of the platform, see our{' '}
              <Link href="/terms" className="text-brand-green hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
