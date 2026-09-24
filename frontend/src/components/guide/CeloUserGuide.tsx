'use client'

import { Mail, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  GuideCheckItem,
  GuideLink,
  InteractiveGuide,
  type GuideStep,
} from '@/components/guide/InteractiveGuide'

const REWARDS_ROWS = [
  ['Verified cleanup (Impact Product level claim)', '10 DCU'],
  ['Referral: invited user completes a verified cleanup', '3 DCU'],
  ['Streak level (weekly activity)', '3 DCU per level'],
  ['Impact report (verified)', '5 DCU'],
  ['Recyclables report (verified)', '5 DCU'],
  ['Verifier work (reviewing a submission)', '1 DCU per review'],
  ['Hypercert creation (per 10 verified cleanups)', '10 DCU'],
] as const

const SUBMIT_CHECKS = [
  'Take a before photo and an after photo (up to 10 MB each, both required)',
  'Allow location access when prompted - required for geotagging. If it fails: enable Location Services in phone Settings, allow browser to use location, allow this site in browser site settings. Coordinates can also be entered manually on the submit screen.',
  'Optionally add an impact report and/or recyclables report',
  'Submit the cleanup form',
  'Wait for verifier review and approval - a trained community verifier attests onchain',
  'Once approved, claim your Impact Product level from the dashboard',
] as const

const WALLET_CHECKS = [
  {
    text: (
      <>
        Go to <GuideLink href="/wallet">Account Settings</GuideLink> and sign in with the same
        Google account used in DeCleanup Rewards.
      </>
    ),
  },
  {
    text: 'Create a 6-digit account passcode. Confirm it, then optionally enable Face ID, Touch ID, or Windows Hello.',
  },
  {
    text: 'On a new phone or browser, sign in with the same account and enter your passcode to unlock.',
  },
  {
    text: 'Optional: export your signer key to MetaMask as your own backup if you forget the passkey later.',
  },
] as const

const CELO_STEPS: GuideStep[] = [
  {
    id: 'step-1',
    title: 'Step 1: Sign in',
    render: () => (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-brand-green/35 bg-brand-green/5 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-brand-green" aria-hidden />
              <p className="font-heading text-base font-semibold text-white">Email or Google</p>
            </div>
            <span className="rounded-full border border-brand-green/50 bg-brand-green/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-green">
              Recommended
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/60">
            Fastest way to start, we create a wallet automatically, nothing to install.
          </p>
          <p className="mt-3 inline-flex rounded-lg border border-brand-green/40 bg-brand-green/10 px-2.5 py-1 text-[11px] font-medium text-brand-green">
            Gas fees covered
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-background/40 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Wallet className="h-4 w-4 shrink-0 text-white/70" aria-hidden />
            <p className="font-heading text-base font-semibold text-white">Connect your wallet</p>
          </div>
          <p className="text-sm leading-relaxed text-white/60">
            MetaMask or any WalletConnect-compatible app, full key custody, small CELO balance
            needed for gas.{' '}
            <GuideLink href="#">How to get CELO</GuideLink>
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'step-2',
    title: 'Step 2: Submit a cleanup',
    render: ({ checks, toggleCheck }) => (
      <>
        <ul className="space-y-3">
          {SUBMIT_CHECKS.map((item, index) => (
            <li key={item}>
              <GuideCheckItem checked={checks[index]} onChange={() => toggleCheck(index)}>
                {item}
              </GuideCheckItem>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-brand-green/25 bg-brand-green/5 px-4 py-3 text-sm leading-relaxed text-white/70">
          <strong className="text-white">Tip:</strong> iPhone users should avoid HEIC format. Use
          JPEG when possible, or enable &quot;Most Compatible&quot; in iPhone camera settings:
          Settings &gt; Camera &gt; Formats.
        </div>
        <p>
          <GuideLink href="https://dapp.decleanup.net/cleanup">Open cleanup form →</GuideLink>
        </p>
      </>
    ),
  },
  {
    id: 'step-3',
    title: 'Step 3: Understand your rewards',
    render: () => (
      <>
        <p className="text-sm leading-relaxed text-white/60">
          DCU are your onchain participation points. Every 50 DCU unlocks a $cDCU claim from your
          dashboard.
        </p>
        <div className="overflow-x-auto rounded-lg border border-white/[0.08]">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                <th className="px-4 py-3 font-heading font-semibold text-white">Action</th>
                <th className="whitespace-nowrap px-4 py-3 font-heading font-semibold text-white">
                  DCU Earned
                </th>
              </tr>
            </thead>
            <tbody>
              {REWARDS_ROWS.map(([action, dcu]) => (
                <tr key={action} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3 text-white/60">{action}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-brand-green">
                    {dcu}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
            <p className="font-heading mb-1.5 text-sm font-semibold text-brand-green">DCU</p>
            <p className="text-xs leading-relaxed text-white/60">
              Onchain participation points, earned from verified actions in the app
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
            <p className="font-heading mb-1.5 text-sm font-semibold text-brand-green">
              Impact Product
            </p>
            <p className="text-xs leading-relaxed text-white/60">
              Onchain progression asset, each approved cleanup can advance your level
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.08] bg-background/50 p-4">
            <p className="font-heading mb-1.5 text-sm font-semibold text-brand-green">$cDCU</p>
            <p className="text-xs leading-relaxed text-white/60">
              Claimable ERC-20 token, every 50 DCU milestone unlocks a claim
            </p>
          </div>
        </div>
        <p className="text-sm">
          <GuideLink href="https://decleanup.net/litepaper">Litepaper</GuideLink>
          {' · '}
          <GuideLink href="https://decleanup.net/tokenomics">Tokenomics</GuideLink>
        </p>
      </>
    ),
  },
  {
    id: 'step-4',
    title: 'Step 4: Hypercerts and impact portfolio',
    render: () => (
      <div className="space-y-5">
        <div>
          <p className="font-heading mb-2 text-base font-semibold text-white">Hypercerts</p>
          <p className="text-sm leading-relaxed text-white/60">
            Hypercerts summarize your verified impact across multiple cleanups into a published
            certificate. Open the Hypercerts hub from the dashboard, check eligibility, submit a
            request, wait for verifier approval. DeCleanup publishes the certificate to Hyperscan
            when approved.
          </p>
          <p className="mt-2 text-sm">
            <GuideLink href="https://hypercerts.org/">Learn more about Hypercerts</GuideLink>
            {' · '}
            <GuideLink href="/hypercerts">Open Hypercerts hub</GuideLink>
          </p>
        </div>
        <div className="border-t border-white/[0.08] pt-5">
          <p className="font-heading mb-2 text-base font-semibold text-white">Impact Portfolio</p>
          <p className="text-sm leading-relaxed text-white/60">
            Update your profile with information about your cleanup work and share your Impact
            Portfolio page with funders, grant programs, or impact investors.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 'step-5',
    title: 'Step 5: Past contributor airdrop',
    render: () => (
      <>
        <p className="text-sm leading-relaxed text-white/60">
          If you were on the early supporter list, go to /airdrop, paste your wallet address, and
          sign in with the same wallet used during the early period. After a successful claim you
          receive a Past Contributor badge on your dashboard and Impact Portfolio.
        </p>
        <p>
          <GuideLink href="https://dapp.decleanup.net/airdrop">Go to airdrop →</GuideLink>
        </p>
      </>
    ),
  },
  {
    id: 'embedded-wallet',
    title: 'Step 6: Access and secure your wallet',
    account: true,
    render: ({ checks, toggleCheck }) => (
      <>
        <div className="rounded-lg border border-brand-yellow/30 bg-brand-yellow/10 px-4 py-3 text-sm leading-relaxed text-foreground">
          DeCleanup Rewards is non-custodial. The team cannot see, reset, or recover your passkey
          or private key. Your Google sign-in opens the app - it does not store or recover your
          wallet.
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/[0.08] bg-background/40 p-4">
            <p className="font-heading mb-1.5 text-base font-semibold text-white">
              Smart account (Safe)
            </p>
            <p className="text-sm leading-relaxed text-white/60">
              Owns your submissions and Impact Products. This is the address shown on your Impact
              Portfolio.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-background/40 p-4">
            <p className="font-heading mb-1.5 text-base font-semibold text-white">Signer address</p>
            <p className="text-sm leading-relaxed text-white/60">
              The key that unlocks your smart account. Both are visible in{' '}
              <GuideLink href="/wallet">Account Settings</GuideLink>.
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-white/60">
          <strong className="text-white">Push notifications:</strong> enable them in Account
          Settings. On iPhone they only work after you add DeCleanup Rewards to your Home Screen:
          Safari &gt; Share &gt; Add to Home Screen.
        </div>
        <p className="font-heading text-base font-semibold text-white">Securing your wallet</p>
        <ul className="space-y-3">
          {WALLET_CHECKS.map((item, index) => (
            <li key={index}>
              <GuideCheckItem
                number={index + 1}
                checked={checks[6 + index]}
                onChange={() => toggleCheck(6 + index)}
              >
                {item.text}
              </GuideCheckItem>
            </li>
          ))}
        </ul>
        <div className="rounded-lg border border-white/[0.08] bg-background/40 px-4 py-3 text-sm text-white/60">
          Forgot your passcode? If you exported your signer key to MetaMask, connect MetaMask from
          the home page. Otherwise email{' '}
          <GuideLink href="mailto:support@decleanup.net">support@decleanup.net</GuideLink> for a
          team reset (new onchain address; old cleanups stay on the previous address).
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-background/40 px-4 py-3 text-sm text-white/60">
          <strong className="text-white">Back up to MetaMask (optional):</strong> In Account
          Settings, unlock your wallet and open Back up to MetaMask. Reveal the signer private key
          and import it in MetaMask. Your smart account address stays the same. Anyone with that
          key has full control of your signer.
        </div>
      </>
    ),
  },
]

export function CeloUserGuide() {
  const [walletDeepLink, setWalletDeepLink] = useState(false)

  useEffect(() => {
    setWalletDeepLink(window.location.hash === '#embedded-wallet')
  }, [])

  return (
    <InteractiveGuide
      storageKey="decleanup-celo-guide-v1"
      title="User Guide"
      lede={
        <>
          DeCleanup Rewards at <GuideLink href="https://dapp.decleanup.net">dapp.decleanup.net</GuideLink>{' '}
          - log cleanups, earn DCU, and claim $cDCU.
        </>
      }
      doneCopy="All six steps are done. You are ready to clean up, earn DCU, and secure your wallet on Celo."
      steps={CELO_STEPS}
      checkCount={10}
      initialOpenIndex={walletDeepLink ? 5 : undefined}
      initialScrollId={walletDeepLink ? 'embedded-wallet' : undefined}
      footer={
        <>
          <p>
            Something not working?{' '}
            <GuideLink href="https://t.me/c/DecentralizedCleanup/17">
              Message us on Telegram
            </GuideLink>
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            <GuideLink href="http://decleanup.net/user-guide">Full Network Guide</GuideLink>
            <GuideLink href="https://dapp.decleanup.net/terms">Terms of Service</GuideLink>
            <GuideLink href="https://dapp.decleanup.net/privacy">Privacy Policy</GuideLink>
          </p>
        </>
      }
    />
  )
}
