'use client'

import { useEffect } from 'react'

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
        <button
          onClick={reset}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent/80"
        >
          Try again
        </button>
      </div>
    </main>
  )
}
