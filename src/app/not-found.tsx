import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="text-4xl mb-4" aria-hidden="true">🧭</div>
        <h1 className="text-xl font-semibold mb-2">Page not found</h1>
        <p className="text-muted-foreground text-sm mb-6">
          The page you are looking for does not exist or has moved.
        </p>
        <Link
          href="/"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent/80"
        >
          Back to Atlas
        </Link>
      </div>
    </main>
  )
}
