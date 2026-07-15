'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server logs carry the detail; the digest links this render to them.
    console.error('Unhandled application error', error.digest ?? '')
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center px-4" role="alert">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4" aria-hidden="true">⚠️</div>
        <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
        <p className="text-muted-foreground text-sm mb-6">
          An unexpected error occurred. Your data is safe - try again, and if
          the problem continues, come back in a few minutes.
        </p>
        <Button onClick={reset} size="lg" className="rounded-xl">
          Try again
        </Button>
      </div>
    </main>
  )
}
