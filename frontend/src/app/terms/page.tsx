import type { Metadata } from 'next'
import Link from 'next/link'
import { buildPageMetadata } from '@/lib/seo/metadata'

const SUPPORT_EMAIL = 'support@decleanup.net'

export const metadata: Metadata = buildPageMetadata({
  title: 'Terms of Service',
  description: 'Terms of Service for the DeCleanup Rewards web application.',
  path: '/terms',
})

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <p className="mb-6 text-sm text-muted-foreground">
          <Link href="/" className="text-brand-green hover:underline">
            ← Home
          </Link>
        </p>
        <h1 className="mb-2 font-heading text-3xl tracking-wide text-brand-green sm:text-4xl">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted-foreground">Effective April 23, 2026 · DeCleanup Network</p>

        <article className="space-y-8 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">1. Acceptance</h2>
            <p>
              By accessing or using DeCleanup Rewards - including connecting a wallet, submitting cleanup evidence, or
              signing transactions - you agree to be bound by these Terms of Service. If you do not agree, you must not
              use the platform.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">2. Description of Service</h2>
            <p>
              DeCleanup Rewards provides interfaces for interacting with DeCleanup-related smart contracts deployed on
              the Celo blockchain. Functionality includes cleanup submissions, reward distribution, Impact Products, and
              optional $cDCU token claims via ClaimVault, subject to deployment configuration. Features may be modified,
              suspended, or discontinued at any time.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">3. Eligibility</h2>
            <p>
              DeCleanup Rewards is available globally. To use the platform, you must be at least 18 years of age (or the
              age of majority in your jurisdiction), have the legal capacity to enter binding agreements, and comply
              with all laws and regulations applicable to you. Use of the platform where prohibited by law is not
              permitted.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">4. Wallets and On-Chain Activity</h2>
            <p>
              You are solely responsible for the security of your wallet and private keys. DeCleanup Rewards cannot
              reverse on-chain transactions or recover lost or compromised keys. Gas fees are your responsibility.
              Network conditions and configurations (including testnet versus mainnet) may vary - always verify the
              active network in your wallet before signing any transaction.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">5. Acceptable Use</h2>
            <p>
              You agree not to submit fraudulent or fabricated cleanup evidence, attempt to circumvent security
              controls, interfere with the integrity of the platform, or engage in any activity that violates
              applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">6. User Content</h2>
            <p>
              By submitting content to DeCleanup Rewards, you grant DeCleanup Network a limited, non-exclusive license to
              host, process, and display that content solely for the purpose of operating the platform, including
              storage of media or content hashes via IPFS or equivalent decentralized storage as configured for your
              deployment.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">
              7. Points, Tokens, and Risk Disclosure
            </h2>
            <p>
              Participation metrics, DCU ledger balances, and $cDCU tokens may carry no monetary value, are subject to
              change, and do not constitute investment advice or an offer of securities. Claim eligibility and rules
              are governed by the deployed smart contracts and backend signing configuration in effect at the time of
              the claim.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">8. Third-Party Services</h2>
            <p>
              DeCleanup Rewards depends on third-party infrastructure including wallet providers, Celo RPC endpoints,
              IPFS pinning services, hosting providers, database services, and optional machine learning services. Your
              use of those services is subject to their respective terms and policies.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">
              9. Disclaimers and Limitation of Liability
            </h2>
            <p>
              DeCleanup Rewards is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties
              of any kind, express or implied. To the maximum extent permitted by applicable law, DeCleanup Network
              shall not be liable for any indirect, incidental, special, or consequential damages arising from your use
              of the platform or from the operation of underlying blockchain networks. Jurisdictions that do not permit
              certain limitations will apply those limitations only to the extent allowed.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">10. Indemnification</h2>
            <p>
              You agree to defend, indemnify, and hold harmless DeCleanup Network from and against any claims, losses, or
              expenses (including reasonable legal fees) arising from your use of DeCleanup Rewards, your submitted
              content, or your breach of these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">11. Privacy</h2>
            <p>
              Your use of DeCleanup Rewards is also governed by our{' '}
              <Link href="/privacy" className="text-brand-green hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">12. Amendments</h2>
            <p>
              DeCleanup Network reserves the right to update these Terms at any time by posting a revised version.
              Continued use of DeCleanup Rewards following the posting of changes constitutes acceptance of those
              changes.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">13. Governing Law and Disputes</h2>
            <p>
              DeCleanup Network operates as a global project without a single governing jurisdiction. Mandatory rights
              under your local laws remain unaffected by these Terms. In the event of a dispute, the parties agree to
              first attempt resolution in good faith through the published contact. Where that is not possible, claims
              shall be subject to the courts or tribunals of competent jurisdiction under applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 font-heading text-xl tracking-wide text-foreground">14. Contact</h2>
            <p>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-brand-green hover:underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          </section>
        </article>
      </div>
    </div>
  )
}
