import Image from 'next/image'

export function GasSponsorshipBadge({ enabled }: { enabled: boolean }) {
  if (!enabled) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
        Paymaster not configured
      </span>
    )
  }

  return (
    <a
      href="https://pimlico.io"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-md bg-black/40 px-2 py-1.5"
      aria-label="Gas sponsored by Pimlico"
      title="Gas sponsored by Pimlico"
    >
      <Image
        src="/pimlico-logo.png"
        alt="Pimlico"
        width={88}
        height={18}
        className="h-[18px] w-auto object-contain"
        priority={false}
      />
    </a>
  )
}
