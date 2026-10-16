import Link from 'next/link'
import { SiteFooterLinks } from '@/components/layout/SiteFooterLinks'

export function ProofPublicChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-black text-foreground">
      <header className="border-b border-white/[0.08] bg-black pt-safe">
        <div className="mx-auto flex h-[4.5rem] max-w-4xl items-center justify-between gap-3 px-4 sm:h-[5.5rem] sm:px-6">
          <Link href="/proof" className="flex min-w-0 items-center gap-3" aria-label="Cleanup proof home">
            <img src="/logo.png" alt="" className="h-12 w-12 sm:h-14 sm:w-14" />
            <span className="font-heading text-sm tracking-wide text-brand-green sm:text-base">
              Check a cleanup
            </span>
          </Link>
          <a
            href="https://decleanup.net"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            DeCleanup Network
          </a>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
      <footer className="border-t border-white/10 bg-background/80 py-6">
        <div className="container mx-auto flex flex-col items-center gap-4 px-4">
          <SiteFooterLinks />
          <div className="font-meta flex items-center justify-center gap-2 opacity-50">
            <span>Built on</span>
            <img src="/celo-celo-logo.svg" alt="Celo" className="h-5 w-auto rounded-sm sm:h-6" />
          </div>
        </div>
      </footer>
    </div>
  )
}
