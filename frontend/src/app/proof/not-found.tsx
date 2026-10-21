import Link from 'next/link'

export default function ProofNotFound() {
  return (
    <div className="space-y-4">
      <h1 className="font-heading text-2xl text-foreground">Cleanup not found</h1>
      <p className="text-sm text-muted-foreground">
        This record is missing, unused, or is not a usable Celo cleanup.
      </p>
      <Link href="/proof" className="text-sm text-brand-green hover:underline">
        Check a cleanup
      </Link>
    </div>
  )
}
