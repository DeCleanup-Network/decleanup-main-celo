import Link from 'next/link'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
}

/** Consistent link back to home from wallet / recovery flows */
export function BackToDeCleanupLink({ className }: Props) {
  return (
    <Link
      href="/"
      className={cn(
        'inline-block text-xs font-medium text-brand-green hover:underline whitespace-nowrap',
        className
      )}
    >
      ← Back
    </Link>
  )
}
