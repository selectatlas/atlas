'use client'

import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type ComingSoonButtonProps = {
  children: React.ReactNode
  /** Toast description shown when the CTA is pressed. */
  description?: string
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  className?: string
}

/**
 * Mockup-grade purchase CTA - deliberately non-functional.
 * Pressing it only shows a "coming soon" toast; no billing exists.
 */
export function ComingSoonButton({
  children,
  description = 'Payments are not enabled in this demo yet.',
  variant = 'default',
  size = 'default',
  className,
}: ComingSoonButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => toast('Coming soon', { description })}
    >
      {children}
    </Button>
  )
}
