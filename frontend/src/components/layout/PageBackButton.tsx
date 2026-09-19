import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  href?: string
  label?: string
}

/** Top-of-page back control used on Hypercerts and funding apply. */
export function PageBackButton({ href = '/', label = 'Back' }: Props) {
  return (
    <Link href={href}>
      <Button variant="outline" size="sm" className="gap-2 border-border bg-card font-heading tracking-wider">
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Button>
    </Link>
  )
}
