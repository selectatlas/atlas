import Link from 'next/link'
import { cn } from '@/lib/utils'

export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <nav className={cn('flex items-center justify-center gap-4 text-xs text-muted-foreground', className)}>
      <Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link>
      <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link>
    </nav>
  )
}
