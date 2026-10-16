import { organizerDonateHref } from '@/lib/proof/display'

export function ProofDonateButton({
  organizerAddress,
  cleanupId,
  place,
}: {
  organizerAddress?: string | null
  cleanupId: string
  place?: string | null
}) {
  if (!organizerAddress) return null
  const href = organizerDonateHref({
    address: organizerAddress,
    cleanupId,
    place,
  })
  if (!href) return null
  return (
    <a
      href={href}
      className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl bg-brand-green px-4 py-2.5 text-center font-heading text-sm tracking-wide text-black hover:bg-brand-green/90"
    >
      Donate to organizer
    </a>
  )
}
