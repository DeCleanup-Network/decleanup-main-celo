import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service | DeCleanup Network',
  description: 'Terms of Service for the DeCleanup Rewards web application.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="text-brand-green hover:underline">
            ← Home
          </Link>
        </p>
        <h1 className="mb-2 font-bebas text-3xl tracking-wide text-brand-green sm:text-4xl">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">Effective April 23, 2026 · DeCleanup Network</p>

        <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100/90">
          <strong className="text-amber-200">Template - not legal advice.</strong> Have qualified counsel review before
          production. Repository copy: <code className="rounded bg-black/40 px-1">docs/TERMS_OF_SERVICE.md</code>
        </div>

        <article className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">1. Acceptance</h2>
            <p>
              By using this application (including connecting a wallet, submitting cleanups, or signing transactions),
              you agree to these Terms. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">2. The Service</h2>
            <p>
              The Service provides interfaces to interact with DeCleanup-related smart contracts on{' '}
              <strong className="text-foreground">Celo</strong> (for example submissions, rewards, Impact Products, and
              optional <strong className="text-foreground">$cDCU</strong> claims via ClaimVault, depending on deployment
              configuration). Features may change, pause, or be removed.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">3. Eligibility (global)</h2>
            <p>
              The Service is offered worldwide. You must be at least <strong className="text-foreground">18</strong> (or
              the age of majority where you live), able to enter a binding agreement, and comply with{' '}
              <strong className="text-foreground">all laws that apply to you</strong>. Do not use the Service where it is
              prohibited.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">4. Wallets and onchain activity</h2>
            <p>
              You control your wallet keys. <strong className="text-foreground">We cannot reverse onchain transactions</strong>{' '}
              or recover lost keys. Gas fees apply; networks may fail or differ (testnet vs mainnet). Verify the network
              in your wallet before signing.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">5. Acceptable use</h2>
            <p>You agree not to submit fraudulent evidence, attack the Service, bypass security controls, or break the law.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">6. Your content</h2>
            <p>
              You grant DeCleanup Network a limited license to host, process, and display your submissions{' '}
              <strong className="text-foreground">to operate the Service</strong>, including storing media or hashes with
              providers such as IPFS as configured for your deployment.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">7. Points, tokens, and risks</h2>
            <p>
              Onchain participation metrics and tokens (including <strong className="text-foreground">DCU</strong> ledger
              balances and <strong className="text-foreground">$cDCU</strong>) may have no monetary value, may change, and
              are not investment advice or an offer of securities. Claim rules follow the deployed contracts and backend
              signing configuration.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">8. Third parties</h2>
            <p>
              The Service relies on wallet providers, RPC endpoints, IPFS pinning, hosting, databases, and optional ML
              services. Their terms apply to your use of those products.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">9. Disclaimers and liability</h2>
            <p>
              The Service is provided <strong className="text-foreground">“as is”</strong> without warranties. To the
              maximum extent permitted by law, DeCleanup Network is not liable for indirect or consequential damages arising from
              your use of the Service or onchain networks. Some jurisdictions do not allow certain limitations; those
              apply only to the extent permitted.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">10. Indemnity</h2>
            <p>
              You will defend and indemnify DeCleanup Network against claims arising from your use of the Service, your content,
              or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">11. Privacy</h2>
            <p>
              See our{' '}
              <Link href="/privacy" className="text-brand-green hover:underline">
                Privacy Policy
              </Link>{' '}
              and <code className="rounded bg-muted px-1 text-foreground">docs/PRIVACY_POLICY.md</code>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">12. Changes</h2>
            <p>We may update these Terms by posting a new version. Continued use after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">13. Global users; law and disputes</h2>
            <p>
              DeCleanup Network is global. These Terms do not pick one country for everyone. Mandatory rights under{' '}
              <strong className="text-foreground">your local laws</strong> still apply. Try to resolve disputes in good
              faith via your published contact first. If that fails, courts or tribunals with{' '}
              <strong className="text-foreground">jurisdiction under applicable law</strong> may hear claims. See{' '}
              <code className="rounded bg-muted px-1 text-foreground">docs/TERMS_OF_SERVICE.md</code> section 14 for the
              full wording.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-bebas text-xl tracking-wide text-foreground">14. Contact</h2>
            <p>Insert your official support or legal contact for this deployment.</p>
          </section>
        </article>
      </div>
    </div>
  )
}
