import Link from 'next/link'

const EXTERNAL_LINKS = [
  { label: 'Website', href: 'https://decleanup.net' },
  { label: 'GitHub', href: 'https://github.com/DeCleanup-Network' },
  { label: 'Litepaper', href: 'https://decleanup.net/litepaper' },
  { label: 'Tokenomics', href: 'https://decleanup.net/tokenomics' },
  { label: 'Follow on X', href: 'https://x.com/decleanupnet' },
  { label: 'Farcaster', href: 'https://farcaster.xyz/decleanupnet' },
  { label: 'Telegram', href: 'https://t.me/decentralizedcleanup' },
  {
    label: 'Donate on Giveth',
    href: 'https://giveth.io/project/decentralized-cleanup-network',
  },
] as const

/** Shared compact footer link rows (home + app shell). */
export function SiteFooterLinks() {
  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-5 sm:gap-y-3">
        {EXTERNAL_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            {link.label}
          </a>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-5">
        <Link href="/guide" className="footer-link">
          User Guide
        </Link>
        <Link href="/terms" className="footer-link">
          Terms of Service
        </Link>
        <Link href="/privacy" className="footer-link">
          Privacy Policy
        </Link>
      </div>
    </>
  )
}
